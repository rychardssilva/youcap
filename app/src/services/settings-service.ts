import { invoke } from "@tauri-apps/api/core";

import { settingSchema, settingsSchema } from "@/schemas/settings-schema";

export type Setting = {
  key: string;
  value: string;
  updated_at: string;
};

export async function upsertSetting(key: string, value: string): Promise<Setting> {
  const response = await invoke("upsert_setting", {
    request: {
      key,
      value,
    },
  });

  return settingSchema.parse(response);
}

export async function listSettings(): Promise<Setting[]> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return [];
  }

  const response = await invoke("list_settings");

  return settingsSchema.parse(response);
}
