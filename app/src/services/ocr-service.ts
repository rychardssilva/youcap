import { invoke } from "@tauri-apps/api/core";

import { ocrResultSchema, ocrStatusSchema } from "@/schemas/ocr-schema";

export type OcrResult = {
  image_path: string;
  text: string;
  provider: string;
  warnings: string[];
};

export type OcrStatus = {
  image_path: string | null;
  result: OcrResult | null;
  error: string | null;
  is_loading: boolean;
};

export async function recognizeImageText(imagePath: string): Promise<OcrResult> {
  const response = await invoke("recognize_image_text", {
    request: {
      image_path: imagePath,
    },
  });

  return ocrResultSchema.parse(response);
}

export async function getCurrentOcrResult(): Promise<OcrResult> {
  const response = await invoke("current_ocr_result");

  return ocrResultSchema.parse(response);
}

export async function getCurrentOcrStatus(): Promise<OcrStatus> {
  const response = await invoke("current_ocr_status");

  return ocrStatusSchema.parse(response);
}

export async function closeOcrReview(): Promise<void> {
  await invoke("close_ocr_review");
}
