PRAGMA foreign_keys = ON;

ALTER TABLE words ADD COLUMN frequency_rank INTEGER;
ALTER TABLE words ADD COLUMN frequency_band TEXT;

CREATE TABLE IF NOT EXISTS lexical_relations (
  id TEXT PRIMARY KEY NOT NULL,
  word_id TEXT NOT NULL,
  term TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  translation TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(word_id, relation_type, term),
  FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS personal_notes (
  id TEXT PRIMARY KEY NOT NULL,
  word_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS personal_sentences (
  id TEXT PRIMARY KEY NOT NULL,
  word_id TEXT NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY NOT NULL,
  word_id TEXT NOT NULL,
  rating TEXT NOT NULL,
  scheduled_for TEXT,
  reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_words_frequency_rank ON words(frequency_rank);
CREATE INDEX IF NOT EXISTS idx_lexical_relations_word_id ON lexical_relations(word_id);
CREATE INDEX IF NOT EXISTS idx_lexical_relations_type ON lexical_relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_personal_notes_word_id ON personal_notes(word_id);
CREATE INDEX IF NOT EXISTS idx_personal_sentences_word_id ON personal_sentences(word_id);
CREATE INDEX IF NOT EXISTS idx_reviews_word_id ON reviews(word_id);
CREATE INDEX IF NOT EXISTS idx_reviews_scheduled_for ON reviews(scheduled_for);
