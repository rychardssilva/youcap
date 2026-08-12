import { invoke } from "@tauri-apps/api/core";

import { lookupResultSchema, lookupStatusSchema } from "@/schemas/lookup-schema";

export type LookupExample = {
  original_text: string;
  translated_text: string | null;
};

export type LookupResult = {
  query: string;
  word: string;
  translation: string;
  meaning: string;
  meaning_translation?: string | null;
  contextual_explanation: string;
  contextual_explanation_translation?: string | null;
  part_of_speech: string | null;
  synonyms: Array<{ term: string; translation: string | null }>;
  antonyms: Array<{ term: string; translation: string | null }>;
  reference_image_url?: string | null;
  examples: LookupExample[];
  source: string;
  warnings: string[];
};

export type LookupStatus = {
  query: string | null;
  result: LookupResult | null;
  error: string | null;
  is_loading: boolean;
};

export async function lookupText(text: string): Promise<LookupResult | void> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return lookupResultSchema.parse({
      query: text,
      word: text.split(/\s+/)[0] || "context",
      translation: "contexto",
      meaning: "Resultado demonstrativo fora do Tauri.",
      meaning_translation: "Resultado demonstrativo fora do Tauri.",
      contextual_explanation: "Execute pelo aplicativo desktop para consultar o provider real.",
      contextual_explanation_translation:
        "Execute pelo aplicativo desktop para consultar o provider real.",
      part_of_speech: null,
      synonyms: [],
      antonyms: [],
      reference_image_url: null,
      examples: [{ original_text: text, translated_text: null }],
      source: "browser-preview",
      warnings: [],
    });
  }

  await invoke("lookup_text", {
    request: {
      text,
    },
  });
}

export async function getCurrentLookupResult(): Promise<LookupResult> {
  const response = await invoke("current_lookup_result");

  return lookupResultSchema.parse(response);
}

export async function getCurrentLookupStatus(): Promise<LookupStatus> {
  const response = await invoke("current_lookup_status");

  return lookupStatusSchema.parse(response);
}

export async function saveLookupResult(result: LookupResult): Promise<void> {
  await invoke("save_lookup_result", {
    request: {
      result,
    },
  });
}

export async function openLookupDetails(result: LookupResult): Promise<void> {
  await invoke("open_lookup_details", {
    request: {
      result,
    },
  });
}

export async function closeLookupPopup(): Promise<void> {
  await invoke("close_lookup_popup");
}
