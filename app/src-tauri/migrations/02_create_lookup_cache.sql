CREATE TABLE IF NOT EXISTS lookup_cache (
  normalized_query TEXT PRIMARY KEY NOT NULL,
  query TEXT NOT NULL,
  result_json TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lookup_cache_updated_at ON lookup_cache(updated_at);
