# Visitor Worker

Cloudflare Worker backend for the footer visitor map.

What it does:

- `POST /api/visit` records the visitor IP, Cloudflare geolocation, user agent, path, referrer, language, timezone, and screen size in D1.
- `GET /api/summary` returns only aggregated location data for the public map. It does not expose raw IPs.
- `GET /admin` shows the private IP dashboard behind Basic Auth.
- `GET /admin.csv` exports the latest IP rows as CSV behind the same auth.

IP addresses can be personal data. Keep the admin password private, consider adding a privacy notice if your site targets regions that require it, and tune `RETENTION_DAYS` in `wrangler.toml` if 180 days is not right for you.

## Deploy

From this directory:

```bash
npx wrangler login
npx wrangler d1 create ganchengguang_visitor_map
```

Copy the returned `database_id` into `wrangler.toml`, replacing `REPLACE_WITH_D1_DATABASE_ID`.

Create the schema in the remote D1 database:

```bash
npx wrangler d1 execute ganchengguang_visitor_map --remote --file=./schema.sql
```

Set the private admin password. Do not commit this value.

```bash
npx wrangler secret put ADMIN_PASSWORD
```

Deploy:

```bash
npx wrangler deploy
```

Wrangler prints a URL like:

```text
https://ganchengguang-visitor-map.YOUR_SUBDOMAIN.workers.dev
```

Put that URL into `index.html`:

```html
<div class="visitor-map" id="visitorMap"
  data-api-base="https://ganchengguang-visitor-map.YOUR_SUBDOMAIN.workers.dev"
  data-site-id="ganchengguang.github.io">
```

Then push the site to GitHub Pages.

## Admin

Open:

```text
https://ganchengguang-visitor-map.YOUR_SUBDOMAIN.workers.dev/admin
```

Username is `ADMIN_USER` from `wrangler.toml` (`admin` by default). Password is the `ADMIN_PASSWORD` secret.

## Local check

After deployment, this should return JSON:

```bash
curl "https://ganchengguang-visitor-map.YOUR_SUBDOMAIN.workers.dev/api/summary?site=ganchengguang.github.io"
```
