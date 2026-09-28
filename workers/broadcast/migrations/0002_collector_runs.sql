CREATE TABLE IF NOT EXISTS collector_runs (
  id INTEGER PRIMARY KEY CHECK(id=1),
  last_started TEXT NOT NULL,
  last_finished TEXT,
  processed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0
);
