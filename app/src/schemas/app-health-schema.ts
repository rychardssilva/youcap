import { z } from "zod";

export const appHealthSchema = z.object({
  message: z.string(),
  platform: z.string(),
  version: z.string(),
});
