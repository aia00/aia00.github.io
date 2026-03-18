import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env');
const blogDir = path.join(repoRoot, 'src', 'content', 'blog');

function parseEnvValue(raw) {
    if (!raw) {
        return '';
    }

    const trimmed = raw.trim();

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
}

async function readAnalyticsEndpoint() {
    if (process.env.PUBLIC_ANALYTICS_ENDPOINT) {
        return process.env.PUBLIC_ANALYTICS_ENDPOINT.trim();
    }

    try {
        const envText = await fs.readFile(envPath, 'utf8');
        const line = envText
            .split('\n')
            .map((entry) => entry.trim())
            .find((entry) => entry.startsWith('PUBLIC_ANALYTICS_ENDPOINT='));

        if (!line) {
            return '';
        }

        return parseEnvValue(line.split('=').slice(1).join('='));
    } catch {
        return '';
    }
}

function extractFrontmatterField(frontmatter, key) {
    const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (!match) {
        return '';
    }

    return parseEnvValue(match[1]);
}

async function loadBlogMetadata() {
    const files = await fs.readdir(blogDir);
    const entries = await Promise.all(
        files
            .filter((file) => file.endsWith('.md') || file.endsWith('.mdx'))
            .map(async (file) => {
                const fullPath = path.join(blogDir, file);
                const text = await fs.readFile(fullPath, 'utf8');
                const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---/);
                const frontmatter = frontmatterMatch?.[1] || '';
                const slug = file.replace(/\.(md|mdx)$/, '');

                return {
                    slug,
                    title: extractFrontmatterField(frontmatter, 'title') || slug,
                    publishDate: extractFrontmatterField(frontmatter, 'publishDate') || '',
                    excerpt: extractFrontmatterField(frontmatter, 'excerpt') || ''
                };
            })
    );

    return new Map(entries.map((entry) => [entry.slug, entry]));
}

function formatDate(dateValue) {
    if (!dateValue) {
        return '';
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return dateValue;
    }

    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function parseLimit() {
    const arg = process.argv.slice(2).find((value) => value.startsWith('--limit=')) || process.argv[2];
    const numeric = Number(String(arg || '').replace('--limit=', ''));

    if (!numeric || Number.isNaN(numeric)) {
        return 5;
    }

    return Math.min(50, Math.max(1, numeric));
}

async function main() {
    const endpoint = await readAnalyticsEndpoint();
    const limit = parseLimit();

    if (!endpoint) {
        console.error('Missing PUBLIC_ANALYTICS_ENDPOINT. Set it in .env or export it before running this command.');
        process.exit(1);
    }

    const normalizedEndpoint = endpoint.replace(/\/+$/, '');
    const [metadataMap, response] = await Promise.all([
        loadBlogMetadata(),
        fetch(`${normalizedEndpoint}/top-blogs?limit=${limit}`)
    ]);

    if (!response.ok) {
        console.error(`Analytics request failed with status ${response.status}.`);
        process.exit(1);
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (items.length === 0) {
        console.log('No tracked blog views yet.');
        return;
    }

    const rows = items.map((item, index) => {
        const metadata = metadataMap.get(item.slug) || {};
        return {
            rank: index + 1,
            title: metadata.title || item.slug,
            slug: item.slug,
            views: Number(item.views || 0),
            published: formatDate(metadata.publishDate),
            last_seen: formatDate(item.lastSeen)
        };
    });

    console.table(rows);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
