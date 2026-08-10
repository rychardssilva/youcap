import { invoke } from "@tauri-apps/api/core";

import {
  databaseHealthSchema,
  referenceImagesSchema,
  relatedWordsSchema,
  searchWordsResponseSchema,
  wordDetailsSchema,
  wordSchema,
  wordsSchema,
} from "@/schemas/database-schema";

export type DatabaseHealth = {
  status: string;
  words_count: number;
  lookups_count: number;
  settings_count: number;
};

export type Word = {
  id: string;
  term: string;
  normalized_term: string;
  language: string;
  pronunciation: string | null;
  ipa: string | null;
  part_of_speech: string | null;
  difficulty: number;
  status: string;
  frequency_rank: number | null;
  frequency_band: string | null;
  created_at: string;
  updated_at: string;
};

export type WordSort = "alphabetical" | "created_at" | "last_lookup";

export type WordListItem = Word & {
  main_translation: string | null;
  latest_context: string | null;
  first_lookup_at: string | null;
  last_lookup_at: string | null;
  lookups_count: number;
};

export type SearchWordsResponse = {
  items: WordListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type WordDetails = {
  word: Word;
  translations: Array<{
    id: string;
    language: string;
    translation: string;
    kind: string;
    source: string | null;
    created_at: string;
  }>;
  contexts: Array<{
    id: string;
    original_text: string;
    highlighted_text: string | null;
    source: string | null;
    created_at: string;
  }>;
  examples: Array<{
    id: string;
    original_text: string;
    translated_text: string | null;
    source: string | null;
    created_at: string;
  }>;
  lookups: Array<{
    id: string;
    query: string;
    source: string | null;
    duration_ms: number | null;
    created_at: string;
  }>;
  lexical_relations: Array<{
    id: string;
    term: string;
    relation_type: string;
    translation: string | null;
    source: string | null;
    created_at: string;
  }>;
  personal_notes: Array<{
    id: string;
    note: string;
    created_at: string;
    updated_at: string;
  }>;
  personal_sentences: Array<{
    id: string;
    original_text: string;
    translated_text: string | null;
    created_at: string;
    updated_at: string;
  }>;
  tags: Array<{
    id: string;
    name: string;
    normalized_name: string;
    created_at: string;
  }>;
  reviews: Array<{
    id: string;
    rating: string;
    scheduled_for: string | null;
    reviewed_at: string;
    created_at: string;
  }>;
  history_summary: {
    first_lookup_at: string | null;
    last_lookup_at: string | null;
    lookups_count: number;
  };
};

export type RelatedWord = {
  term: string;
  translation: string | null;
  source: string;
};

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return {
      status: "browser-preview",
      words_count: 0,
      lookups_count: 0,
      settings_count: 0,
    };
  }

  const response = await invoke("database_health");

  return databaseHealthSchema.parse(response);
}

export async function createWord(term: string): Promise<Word> {
  const response = await invoke("create_word", {
    request: {
      term,
      language: "en",
      translation: "contexto",
      context: "The word context helps explain meaning.",
    },
  });

  return wordSchema.parse(response);
}

export async function listWords(): Promise<Word[]> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return [];
  }

  const response = await invoke("list_words");

  return wordsSchema.parse(response);
}

export async function searchWords(params: {
  query?: string;
  sort?: WordSort;
  limit?: number;
  offset?: number;
}): Promise<SearchWordsResponse> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return {
      items: [],
      total: 0,
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    };
  }

  const response = await invoke("search_words", {
    request: params,
  });

  return searchWordsResponseSchema.parse(response);
}

export async function getWordDetails(wordId: string): Promise<WordDetails> {
  const response = await invoke("get_word_details", {
    request: {
      id: wordId,
    },
  });

  return wordDetailsSchema.parse(response);
}

export async function updateWordDetails(params: {
  id: string;
  term?: string;
  translation?: string;
  meaning?: string;
  status?: string;
  pronunciation?: string;
  ipa?: string;
  part_of_speech?: string;
  difficulty?: number;
  frequency_rank?: number | null;
  frequency_band?: string;
  example_original?: string;
  example_translation?: string;
  synonyms?: string;
  antonyms?: string;
  personal_note?: string;
  personal_sentence?: string;
  personal_sentence_translation?: string;
  tags?: string;
  review_rating?: string;
  review_scheduled_for?: string;
}): Promise<WordDetails> {
  const response = await invoke("update_word_details", {
    request: params,
  });

  return wordDetailsSchema.parse(response);
}

export async function getReferenceImages(term: string, limit = 4): Promise<string[]> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return [];
  }

  const response = await invoke("get_reference_images", {
    request: {
      term,
      limit,
    },
  });

  return referenceImagesSchema.parse(response);
}

export async function getRelatedWords(params: {
  word_id: string;
  term: string;
  limit?: number;
}): Promise<RelatedWord[]> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return [];
  }

  const response = await invoke("get_related_words", {
    request: params,
  });

  return relatedWordsSchema.parse(response);
}
