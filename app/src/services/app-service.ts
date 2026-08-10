import { invoke } from "@tauri-apps/api/core";

import { appHealthSchema } from "@/schemas/app-health-schema";

export type AppHealth = {
  message: string;
  platform: string;
  version: string;
};

export async function getAppHealth(): Promise<AppHealth> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return {
      message: "Frontend em modo navegador",
      platform: "browser",
      version: "0.1.0",
    };
  }

  const response = await invoke("app_health");

  return appHealthSchema.parse(response);
}
