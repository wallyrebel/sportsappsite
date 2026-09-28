CREATE TABLE IF NOT EXISTS source_snapshots (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  last_attempt TEXT NOT NULL,
  last_success TEXT,
  failures INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS broadcast_alerts (
  id TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);
