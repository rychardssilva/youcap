PRAGMA foreign_keys = OFF;

CREATE TABLE words_new (
  id TEXT PRIMARY KEY NOT NULL,
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  part_of_speech TEXT,
  difficulty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  frequency_rank INTEGER,
  frequency_band TEXT,
  UNIQUE(normalized_term, language)
);

INSERT INTO words_new (
  id,
  term,
  normalized_term,
  language,
  part_of_speech,
  difficulty,
  status,
  created_at,
  updated_at,
  frequency_rank,
  frequency_band
)
SELECT
  id,
  term,
  normalized_term,
  language,
  part_of_speech,
  difficulty,
  status,
  created_at,
  updated_at,
  frequency_rank,
  frequency_band
FROM words;

DROP TABLE words;
ALTER TABLE words_new RENAME TO words;

CREATE INDEX IF NOT EXISTS idx_words_normalized_term ON words(normalized_term);
CREATE INDEX IF NOT EXISTS idx_words_language ON words(language);
CREATE INDEX IF NOT EXISTS idx_words_status ON words(status);
CREATE INDEX IF NOT EXISTS idx_words_updated_at ON words(updated_at);
CREATE INDEX IF NOT EXISTS idx_words_frequency_rank ON words(frequency_rank);

PRAGMA foreign_keys = ON;
