import { z } from "zod";

export const ocrResultSchema = z.object({
  image_path: z.string(),
  text: z.string(),
  provider: z.string(),
  warnings: z.array(z.string()),
});

export const ocrStatusSchema = z.object({
  image_path: z.string().nullable(),
  result: ocrResultSchema.nullable(),
  error: z.string().nullable(),
  is_loading: z.boolean(),
});
