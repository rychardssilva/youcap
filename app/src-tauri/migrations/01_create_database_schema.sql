PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY NOT NULL,
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  pronunciation TEXT,
  ipa TEXT,
  part_of_speech TEXT,
  difficulty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(normalized_term, language)
);

CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY NOT NULL,
  word_id TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  translation TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'main',
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contexts (
  id TEXT PRIMARY KEY NOT NULL,
  word_id TEXT NOT NULL,
  original_text TEXT NOT NULL,
  highlighted_text TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lookups (
  id TEXT PRIMARY KEY NOT NULL,
  word_id TEXT,
  query TEXT NOT NULL,
  source TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS examples (
  id TEXT PRIMARY KEY NOT NULL,
  word_id TEXT NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(word_id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_words_normalized_term ON words(normalized_term);
CREATE INDEX IF NOT EXISTS idx_words_language ON words(language);
CREATE INDEX IF NOT EXISTS idx_words_status ON words(status);
CREATE INDEX IF NOT EXISTS idx_words_updated_at ON words(updated_at);
CREATE INDEX IF NOT EXISTS idx_translations_word_id ON translations(word_id);
CREATE INDEX IF NOT EXISTS idx_contexts_word_id ON contexts(word_id);
CREATE INDEX IF NOT EXISTS idx_lookups_word_id ON lookups(word_id);
CREATE INDEX IF NOT EXISTS idx_lookups_created_at ON lookups(created_at);
CREATE INDEX IF NOT EXISTS idx_examples_word_id ON examples(word_id);
