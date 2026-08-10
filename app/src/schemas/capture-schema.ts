import { z } from "zod";

export const captureShortcutStatusSchema = z.object({
  shortcut: z.string(),
  registered: z.boolean(),
});

export const captureResultSchema = z.object({
  image_path: z.string(),
  width: z.number(),
  height: z.number(),
});

export const captureSessionSchema = z.object({
  id: z.string(),
  image_path: z.string(),
  monitor_x: z.number(),
  monitor_y: z.number(),
  width: z.number(),
  height: z.number(),
  scale_factor: z.number(),
});
