const DEFAULT_ALLOWED_ORIGINS = [
  "https://ganchengguang.github.io",
  "http://localhost:4173"
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      if (url.pathname === "/health") return textResponse("ok", 200);
      if (!env.DB) return jsonResponse(request, env, { error: "missing_d1_binding" }, 500);

      if (url.pathname === "/api/visit" && request.method === "POST") {
        return handleVisit(request, env, ctx);
      }
      if (url.pathname === "/api/summary" && request.method === "GET") {
        return handleSummary(request, env);
      }
      if (url.pathname === "/admin" && request.method === "GET") {
        return handleAdmin(request, env);
      }
      if (url.pathname === "/admin.csv" && request.method === "GET") {
        return handleAdminCsv(request, env);
      }

      return jsonResponse(request, env, { error: "not_found" }, 404);
    } catch (error) {
      return jsonResponse(request, env, { error: "internal_error" }, 500);
    }
  }
};

async function handleVisit(request, env, ctx) {
  if (!isAllowedOrigin(request.headers.get("Origin"), env)) {
    return jsonResponse(request, env, { error: "origin_not_allowed" }, 403);
  }

  let body = {};
  try {
    body = await request.json();
  } catch (error) {
    body = {};
  }

  const now = new Date().toISOString();
  const site = cleanText(body.site, 120) || cleanText(env.SITE_ID, 120) || "default";
  const ip = getClientIp(request);
  const cf = request.cf || {};
  const country = cleanText(cf.country, 80);
  const region = cleanText(cf.region || cf.regionCode, 120);
  const city = cleanText(cf.city, 120);
  const latitude = cleanNumber(cf.latitude);
  const longitude = cleanNumber(cf.longitude);
  const userAgent = cleanText(request.headers.get("User-Agent"), 500);
  const path = cleanText(body.path, 300) || "/";
  const referrer = cleanText(body.referrer || request.headers.get("Referer"), 500);
  const language = cleanText(body.language, 80);
  const timezone = cleanText(body.timezone, 120);
  const screen = cleanText(body.screen, 80);

  await env.DB.prepare(`
    INSERT INTO visitor_visits (
      site, ip, first_seen, last_seen, visits, country, region, city,
      latitude, longitude, user_agent, last_path, referrer, language, timezone, screen
    )
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(site, ip) DO UPDATE SET
      last_seen = excluded.last_seen,
      visits = visitor_visits.visits + 1,
      country = COALESCE(excluded.country, visitor_visits.country),
      region = COALESCE(excluded.region, visitor_visits.region),
      city = COALESCE(excluded.city, visitor_visits.city),
      latitude = COALESCE(excluded.latitude, visitor_visits.latitude),
      longitude = COALESCE(excluded.longitude, visitor_visits.longitude),
      user_agent = COALESCE(excluded.user_agent, visitor_visits.user_agent),
      last_path = excluded.last_path,
      referrer = COALESCE(excluded.referrer, visitor_visits.referrer),
      language = COALESCE(excluded.language, visitor_visits.language),
      timezone = COALESCE(excluded.timezone, visitor_visits.timezone),
      screen = COALESCE(excluded.screen, visitor_visits.screen)
  `).bind(
    site, ip, now, now, country, region, city, latitude, longitude,
    userAgent, path, referrer, language, timezone, screen
  ).run();

  ctx.waitUntil(purgeOldVisits(env));
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

async function handleSummary(request, env) {
  const url = new URL(request.url);
  const site = cleanText(url.searchParams.get("site"), 120) || cleanText(env.SITE_ID, 120) || "default";

  const totals = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(visits), 0) AS totalVisits,
      COUNT(*) AS uniqueIps,
      COUNT(DISTINCT CASE
        WHEN latitude IS NOT NULL AND longitude IS NOT NULL
        THEN COALESCE(country, '') || '|' || COALESCE(region, '') || '|' || COALESCE(city, '')
      END) AS uniqueLocations,
      MAX(last_seen) AS lastSeen
    FROM visitor_visits
    WHERE site = ?
  `).bind(site).first();

  const locations = await env.DB.prepare(`
    SELECT
      country,
      region,
      city,
      ROUND(latitude, 2) AS latitude,
      ROUND(longitude, 2) AS longitude,
      SUM(visits) AS visits,
      COUNT(*) AS uniqueIps,
      MAX(last_seen) AS lastSeen
    FROM visitor_visits
    WHERE site = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
    GROUP BY country, region, city, ROUND(latitude, 2), ROUND(longitude, 2)
    ORDER BY visits DESC, lastSeen DESC
    LIMIT 80
  `).bind(site).all();

  return jsonResponse(request, env, {
    site,
    generatedAt: new Date().toISOString(),
    totalVisits: Number(totals.totalVisits || 0),
    uniqueIps: Number(totals.uniqueIps || 0),
    uniqueLocations: Number(totals.uniqueLocations || 0),
    lastSeen: totals.lastSeen || null,
    locations: locations.results || []
  }, 200, "public, max-age=60");
}

async function handleAdmin(request, env) {
  if (!isAdminAuthorized(request, env)) return adminChallenge();

  const site = cleanText(new URL(request.url).searchParams.get("site"), 120) || cleanText(env.SITE_ID, 120) || "default";
  const totals = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(visits), 0) AS totalVisits,
      COUNT(*) AS uniqueIps,
      MAX(last_seen) AS lastSeen
    FROM visitor_visits
    WHERE site = ?
  `).bind(site).first();

  const rows = await env.DB.prepare(`
    SELECT
      site, ip, visits, first_seen, last_seen, country, region, city,
      latitude, longitude, language, timezone, screen, last_path, referrer, user_agent
    FROM visitor_visits
    WHERE site = ?
    ORDER BY last_seen DESC
    LIMIT 500
  `).bind(site).all();

  const tableRows = (rows.results || []).map((row) => {
    const location = [row.city, row.region, row.country].filter(Boolean).join(", ") || "Unknown";
    return `<tr>
      <td><code>${escapeHtml(row.ip)}</code></td>
      <td>${escapeHtml(location)}</td>
      <td>${escapeHtml(row.visits)}</td>
      <td>${escapeHtml(row.first_seen)}</td>
      <td>${escapeHtml(row.last_seen)}</td>
      <td>${escapeHtml(row.last_path || "")}</td>
      <td>${escapeHtml(row.referrer || "")}</td>
      <td>${escapeHtml(row.user_agent || "")}</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Visitor Admin</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, system-ui, sans-serif; }
    body { margin: 0; background: Canvas; color: CanvasText; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 28px; }
    .muted { color: color-mix(in srgb, CanvasText 58%, transparent); }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stat { border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 10px; padding: 16px; }
    .stat strong { display: block; font-size: 26px; }
    .toolbar { display: flex; justify-content: space-between; gap: 12px; margin: 18px 0; }
    a { color: #4f46e5; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid color-mix(in srgb, CanvasText 14%, transparent); padding: 10px; text-align: left; vertical-align: top; }
    th { position: sticky; top: 0; background: Canvas; }
    td { max-width: 260px; overflow-wrap: anywhere; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .table-wrap { overflow: auto; border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 10px; }
    @media (max-width: 760px) { header, .toolbar { display: block; } .stats { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Visitor Admin</h1>
        <p class="muted">Site: ${escapeHtml(site)}. Showing the latest 500 IP rows.</p>
      </div>
      <a href="/admin.csv?site=${encodeURIComponent(site)}">Download CSV</a>
    </header>
    <section class="stats" aria-label="Visitor totals">
      <div class="stat"><strong>${escapeHtml(totals.totalVisits || 0)}</strong><span class="muted">Total visits</span></div>
      <div class="stat"><strong>${escapeHtml(totals.uniqueIps || 0)}</strong><span class="muted">Unique IPs</span></div>
      <div class="stat"><strong>${escapeHtml(totals.lastSeen || "--")}</strong><span class="muted">Latest visit</span></div>
    </section>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>IP</th>
            <th>Location</th>
            <th>Visits</th>
            <th>First seen</th>
            <th>Last seen</th>
            <th>Path</th>
            <th>Referrer</th>
            <th>User agent</th>
          </tr>
        </thead>
        <tbody>${tableRows || '<tr><td colspan="8">No visits recorded yet.</td></tr>'}</tbody>
      </table>
    </div>
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

async function handleAdminCsv(request, env) {
  if (!isAdminAuthorized(request, env)) return adminChallenge();

  const site = cleanText(new URL(request.url).searchParams.get("site"), 120) || cleanText(env.SITE_ID, 120) || "default";
  const rows = await env.DB.prepare(`
    SELECT site, ip, visits, first_seen, last_seen, country, region, city, latitude, longitude,
      language, timezone, screen, last_path, referrer, user_agent
    FROM visitor_visits
    WHERE site = ?
    ORDER BY last_seen DESC
    LIMIT 5000
  `).bind(site).all();

  const headers = [
    "site", "ip", "visits", "first_seen", "last_seen", "country", "region", "city",
    "latitude", "longitude", "language", "timezone", "screen", "last_path", "referrer", "user_agent"
  ];
  const lines = [headers.join(",")].concat((rows.results || []).map((row) => {
    return headers.map((key) => csvCell(row[key])).join(",");
  }));

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="visitor-ips.csv"',
      "Cache-Control": "no-store"
    }
  });
}

async function purgeOldVisits(env) {
  const rawDays = Number(env.RETENTION_DAYS || 180);
  const days = Math.min(Math.max(Number.isFinite(rawDays) ? rawDays : 180, 1), 3650);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("DELETE FROM visitor_visits WHERE last_seen < ?").bind(cutoff).run();
}

function getClientIp(request) {
  const cfIp = cleanText(request.headers.get("CF-Connecting-IP"), 80);
  if (cfIp) return cfIp;
  const forwarded = cleanText(request.headers.get("X-Forwarded-For"), 200);
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isAllowedOrigin(origin, env) {
  if (!origin) return true;
  const configured = String(env.ALLOWED_ORIGIN || "").split(",").map((item) => item.trim()).filter(Boolean);
  const allowed = configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
  return allowed.includes("*") || allowed.includes(origin);
}

function corsHeaders(request, env) {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (origin && isAllowedOrigin(origin, env)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

function jsonResponse(request, env, payload, status = 200, cacheControl = "no-store") {
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", cacheControl);
  return new Response(JSON.stringify(payload), { status, headers });
}

function textResponse(value, status = 200) {
  return new Response(value, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function isAdminAuthorized(request, env) {
  const expectedUser = String(env.ADMIN_USER || "admin");
  const expectedPassword = String(env.ADMIN_PASSWORD || "");
  if (!expectedPassword) return false;

  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Basic ")) return false;

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator === -1) return false;
    const user = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return constantTimeEqual(user, expectedUser) && constantTimeEqual(password, expectedPassword);
  } catch (error) {
    return false;
  }
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function adminChallenge() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Visitor Map Admin"',
      "Cache-Control": "no-store"
    }
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
