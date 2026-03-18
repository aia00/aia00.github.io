# Cloudflare Analytics Setup

This site can record page-view data with a small Cloudflare Worker and a KV namespace.

## What this implementation does

- Records page views for the whole site
- Aggregates totals by page type
- Tracks per-page counts
- Tracks blog-post counts separately
- Exposes a `top-blogs` endpoint so the homepage can render the five most-viewed blog posts

## Why this design fits GitHub Pages

The site itself stays fully static. All counting happens in a Worker:

- the site sends a lightweight `POST /track`
- the Worker writes counters into KV
- the homepage requests `GET /top-blogs?limit=5`

This is a good fit for a personal site with low write volume. KV is eventually consistent, so this design is appropriate for lightweight analytics, not billing-grade counters.

## Files

- Worker: [analytics-worker.js](/home/ykwang/personal_stuff/aia00.github.io/cloudflare/analytics-worker.js)
- Wrangler template: [wrangler.toml.example](/home/ykwang/personal_stuff/aia00.github.io/cloudflare/wrangler.toml.example)
- Public site env example: [.env.example](/home/ykwang/personal_stuff/aia00.github.io/.env.example)

## 1. Create a KV namespace

```bash
wrangler kv namespace create SITE_ANALYTICS
```

Copy the namespace id into `cloudflare/wrangler.toml.example`, then save it as `cloudflare/wrangler.toml`.

## 2. Deploy the Worker

From the repository root:

```bash
wrangler deploy -c cloudflare/wrangler.toml
```

After deployment you should get a URL like:

```text
https://aia00-site-analytics.<your-subdomain>.workers.dev
```

## 3. Configure the Astro site

Create a local `.env` file in the repository root:

```bash
cp .env.example .env
```

Then set:

```bash
PUBLIC_ANALYTICS_ENDPOINT="https://aia00-site-analytics.<your-subdomain>.workers.dev"
```

Restart `npm run dev` after changing `.env`.

## 4. Configure GitHub Pages build

Because the Astro build injects `PUBLIC_ANALYTICS_ENDPOINT` at build time, add the same value to your GitHub Pages workflow environment.

Example:

```yml
env:
  PUBLIC_ANALYTICS_ENDPOINT: https://aia00-site-analytics.<your-subdomain>.workers.dev
```

## 5. Available endpoints

### `POST /track`

Request body:

```json
{
  "path": "/blog/grpo-variants-llm-rl/",
  "pageType": "blog",
  "slug": "grpo-variants-llm-rl"
}
```

### `GET /top-blogs?limit=5`

Example response:

```json
{
  "items": [
    {
      "slug": "grpo-variants-llm-rl",
      "views": 42,
      "lastSeen": "2026-03-17T20:11:00.000Z"
    }
  ]
}
```

### `GET /summary`

Returns whole-site totals by page type.

### `GET /page-stats?path=/blog/grpo-variants-llm-rl/`

Returns view counts for a specific path.

## 6. View blog counts locally

Once `.env` contains `PUBLIC_ANALYTICS_ENDPOINT`, you can inspect the most-viewed blog posts from the project root:

```bash
npm run analytics:blogs
```

To request a different number of posts:

```bash
npm run analytics:blogs -- --limit=10
```

This command maps the Worker response back to your local blog titles and prints a table with:

- rank
- title
- slug
- views
- published date
- last seen time

## Notes

- The site-side script respects `Do Not Track`.
- The client deduplicates repeated views from the same browser for 30 minutes.
- Basic bot user agents are ignored in the Worker.
