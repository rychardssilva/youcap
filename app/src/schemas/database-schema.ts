import { z } from "zod";

export const databaseHealthSchema = z.object({
  status: z.string(),
  words_count: z.number(),
  lookups_count: z.number(),
  settings_count: z.number(),
});

export const wordSchema = z.object({
  id: z.string(),
  term: z.string(),
  normalized_term: z.string(),
  language: z.string(),
  pronunciation: z.string().nullable(),
  ipa: z.string().nullable(),
  part_of_speech: z.string().nullable(),
  difficulty: z.number(),
  status: z.string(),
  frequency_rank: z.number().nullable(),
  frequency_band: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const wordsSchema = z.array(wordSchema);

export const wordListItemSchema = wordSchema.extend({
  main_translation: z.string().nullable(),
  latest_context: z.string().nullable(),
  first_lookup_at: z.string().nullable(),
  last_lookup_at: z.string().nullable(),
  lookups_count: z.number(),
});

export const searchWordsResponseSchema = z.object({
  items: z.array(wordListItemSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export const wordTranslationSchema = z.object({
  id: z.string(),
  language: z.string(),
  translation: z.string(),
  kind: z.string(),
  source: z.string().nullable(),
  created_at: z.string(),
});

export const wordContextSchema = z.object({
  id: z.string(),
  original_text: z.string(),
  highlighted_text: z.string().nullable(),
  source: z.string().nullable(),
  created_at: z.string(),
});

export const wordExampleSchema = z.object({
  id: z.string(),
  original_text: z.string(),
  translated_text: z.string().nullable(),
  source: z.string().nullable(),
  created_at: z.string(),
});

export const wordLookupSchema = z.object({
  id: z.string(),
  query: z.string(),
  source: z.string().nullable(),
  duration_ms: z.number().nullable(),
  created_at: z.string(),
});

export const wordLexicalRelationSchema = z.object({
  id: z.string(),
  term: z.string(),
  relation_type: z.string(),
  translation: z.string().nullable(),
  source: z.string().nullable(),
  created_at: z.string(),
});

export const wordPersonalNoteSchema = z.object({
  id: z.string(),
  note: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const wordPersonalSentenceSchema = z.object({
  id: z.string(),
  original_text: z.string(),
  translated_text: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const wordReviewSchema = z.object({
  id: z.string(),
  rating: z.string(),
  scheduled_for: z.string().nullable(),
  reviewed_at: z.string(),
  created_at: z.string(),
});

export const wordTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  normalized_name: z.string(),
  created_at: z.string(),
});

export const wordHistorySummarySchema = z.object({
  first_lookup_at: z.string().nullable(),
  last_lookup_at: z.string().nullable(),
  lookups_count: z.number(),
});

export const wordDetailsSchema = z.object({
  word: wordSchema,
  translations: z.array(wordTranslationSchema),
  contexts: z.array(wordContextSchema),
  examples: z.array(wordExampleSchema),
  lookups: z.array(wordLookupSchema),
  history_summary: wordHistorySummarySchema,
  lexical_relations: z.array(wordLexicalRelationSchema),
  personal_notes: z.array(wordPersonalNoteSchema),
  personal_sentences: z.array(wordPersonalSentenceSchema),
  tags: z.array(wordTagSchema),
  reviews: z.array(wordReviewSchema),
});

export const referenceImagesSchema = z.array(z.string());

export const relatedWordSchema = z.object({
  term: z.string(),
  translation: z.string().nullable(),
  source: z.string(),
});

export const relatedWordsSchema = z.array(relatedWordSchema);
