CREATE TABLE IF NOT EXISTS visitor_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  ip TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  visits INTEGER NOT NULL DEFAULT 1,
  country TEXT,
  region TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  user_agent TEXT,
  last_path TEXT,
  referrer TEXT,
  language TEXT,
  timezone TEXT,
  screen TEXT,
  UNIQUE(site, ip)
);

CREATE INDEX IF NOT EXISTS idx_visitor_visits_site_last_seen
  ON visitor_visits(site, last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_visitor_visits_site_location
  ON visitor_visits(site, country, region, city);
