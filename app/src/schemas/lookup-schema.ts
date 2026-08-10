import { z } from "zod";

export const lookupExampleSchema = z.object({
  original_text: z.string(),
  translated_text: z.string().nullable(),
});

export const lookupResultSchema = z.object({
  query: z.string(),
  word: z.string(),
  translation: z.string(),
  meaning: z.string(),
  meaning_translation: z.string().nullable().optional(),
  contextual_explanation: z.string(),
  contextual_explanation_translation: z.string().nullable().optional(),
  pronunciation: z.string().nullable(),
  ipa: z.string().nullable(),
  part_of_speech: z.string().nullable(),
  reference_image_url: z.string().nullable().optional(),
  examples: z.array(lookupExampleSchema),
  source: z.string(),
  warnings: z.array(z.string()),
});

export const lookupStatusSchema = z.object({
  query: z.string().nullable(),
  result: lookupResultSchema.nullable(),
  error: z.string().nullable(),
  is_loading: z.boolean(),
});
