import { z } from "zod";

export const settingSchema = z.object({
  key: z.string(),
  value: z.string(),
  updated_at: z.string(),
});

export const settingsSchema = z.array(settingSchema);
