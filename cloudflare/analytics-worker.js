const BOT_UA_PATTERN = /bot|spider|crawl|preview|slurp|facebookexternalhit|discordbot|whatsapp|telegrambot|linkedinbot/i;

const PAGE_TYPES = new Set([
    'home',
    'blog',
    'blog-index',
    'note',
    'notes-index',
    'project',
    'projects-index',
    'tag',
    'tags-index',
    'page'
]);

function corsHeaders(env) {
    return {
        'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
    };
}

function json(data, env, init = {}) {
    return new Response(JSON.stringify(data, null, 2), {
        ...init,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders(env),
            ...(init.headers || {})
        }
    });
}

function normalizeSlug(slug) {
    if (!slug || typeof slug !== 'string') {
        return null;
    }

    return slug.trim().replace(/^\/+|\/+$/g, '');
}

function isValidTrackPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    if (typeof payload.path !== 'string' || !payload.path.startsWith('/')) {
        return false;
    }

    if (!PAGE_TYPES.has(payload.pageType)) {
        return false;
    }

    if (payload.slug && typeof payload.slug !== 'string') {
        return false;
    }

    return true;
}

async function readJson(kv, key, fallback) {
    const raw = await kv.get(key);
    if (!raw) {
        return fallback;
    }

    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

async function putJson(kv, key, value, metadata) {
    await kv.put(key, JSON.stringify(value), metadata ? { metadata } : undefined);
}

async function incrementSummary(kv, pageType, timestamp) {
    const summaryKey = 'stats:summary';
    const summary = await readJson(kv, summaryKey, {
        totalViews: 0,
        byPageType: {},
        lastSeen: null
    });

    summary.totalViews += 1;
    summary.byPageType[pageType] = (summary.byPageType[pageType] || 0) + 1;
    summary.lastSeen = timestamp;

    await putJson(kv, summaryKey, summary);
}

async function incrementPageStat(kv, { path, pageType, slug, timestamp }) {
    const key = `stats:page:${path}`;
    const current = await readJson(kv, key, {
        path,
        pageType,
        slug: slug || null,
        views: 0,
        lastSeen: null
    });

    current.views += 1;
    current.lastSeen = timestamp;

    await putJson(kv, key, current, {
        path,
        pageType,
        slug: slug || null,
        views: current.views,
        lastSeen: current.lastSeen
    });
}

async function incrementBlogStat(kv, slug, timestamp) {
    const key = `stats:blog:${slug}`;
    const current = await readJson(kv, key, {
        slug,
        views: 0,
        lastSeen: null
    });

    current.views += 1;
    current.lastSeen = timestamp;

    await putJson(kv, key, current, {
        slug,
        views: current.views,
        lastSeen: current.lastSeen
    });
}

async function listTopBlogs(kv, limit) {
    const prefix = 'stats:blog:';
    let cursor;
    const keys = [];

    do {
        const result = await kv.list({ prefix, cursor });
        keys.push(...result.keys);
        cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);

    return keys
        .map((key) => ({
            slug: key.name.slice(prefix.length),
            views: Number(key.metadata?.views || 0),
            lastSeen: key.metadata?.lastSeen || null
        }))
        .sort((a, b) => {
            if (b.views !== a.views) {
                return b.views - a.views;
            }

            return String(b.lastSeen || '').localeCompare(String(a.lastSeen || ''));
        })
        .slice(0, limit);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(env)
            });
        }

        if (request.method === 'GET' && url.pathname === '/top-blogs') {
            const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') || 5)));
            const items = await listTopBlogs(env.SITE_ANALYTICS, limit);
            return json({ items }, env);
        }

        if (request.method === 'GET' && url.pathname === '/summary') {
            const summary = await readJson(env.SITE_ANALYTICS, 'stats:summary', {
                totalViews: 0,
                byPageType: {},
                lastSeen: null
            });

            return json(summary, env);
        }

        if (request.method === 'GET' && url.pathname === '/page-stats') {
            const path = url.searchParams.get('path');
            if (!path) {
                return json({ error: 'Missing path query parameter.' }, env, { status: 400 });
            }

            const stats = await readJson(env.SITE_ANALYTICS, `stats:page:${path}`, {
                path,
                views: 0,
                lastSeen: null
            });

            return json(stats, env);
        }

        if (request.method === 'POST' && url.pathname === '/track') {
            const userAgent = request.headers.get('user-agent') || '';
            if (BOT_UA_PATTERN.test(userAgent)) {
                return json({ ok: true, ignored: 'bot' }, env, { status: 202 });
            }

            let payload;
            try {
                payload = await request.json();
            } catch {
                return json({ error: 'Invalid JSON body.' }, env, { status: 400 });
            }

            if (!isValidTrackPayload(payload)) {
                return json({ error: 'Invalid track payload.' }, env, { status: 400 });
            }

            const slug = normalizeSlug(payload.slug);
            const timestamp = new Date().toISOString();

            await incrementSummary(env.SITE_ANALYTICS, payload.pageType, timestamp);
            await incrementPageStat(env.SITE_ANALYTICS, {
                path: payload.path,
                pageType: payload.pageType,
                slug,
                timestamp
            });

            if (payload.pageType === 'blog' && slug) {
                await incrementBlogStat(env.SITE_ANALYTICS, slug, timestamp);
            }

            return json({ ok: true }, env, { status: 202 });
        }

        return json({ error: 'Not found.' }, env, { status: 404 });
    }
};
