import { convertFileSrc, invoke } from "@tauri-apps/api/core";

import {
  captureResultSchema,
  captureSessionSchema,
  captureShortcutStatusSchema,
} from "@/schemas/capture-schema";

export type CaptureShortcutStatus = {
  shortcut: string;
  registered: boolean;
};

export type CaptureSelection = {
  session_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CaptureResult = {
  image_path: string;
  width: number;
  height: number;
};

export type CaptureSession = {
  id: string;
  image_path: string;
  monitor_x: number;
  monitor_y: number;
  width: number;
  height: number;
  scale_factor: number;
};

export async function openCaptureOverlay(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return;
  }

  await invoke("open_capture_overlay");
}

export async function getCurrentCaptureSession(): Promise<CaptureSession> {
  const response = await invoke("current_capture_session");

  return captureSessionSchema.parse(response);
}

export function captureImageSrc(path: string): string {
  return convertFileSrc(path);
}

export async function registerCaptureShortcut(shortcut: string): Promise<CaptureShortcutStatus> {
  const response = await invoke("register_capture_shortcut", { shortcut });

  return captureShortcutStatusSchema.parse(response);
}

export async function unregisterCaptureShortcut(): Promise<CaptureShortcutStatus> {
  const response = await invoke("unregister_capture_shortcut");

  return captureShortcutStatusSchema.parse(response);
}

export async function getCaptureShortcutStatus(): Promise<CaptureShortcutStatus> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return {
      shortcut: "CommandOrControl+Shift+E",
      registered: false,
    };
  }

  const response = await invoke("capture_shortcut_status");

  return captureShortcutStatusSchema.parse(response);
}

export async function completeCaptureSelection(selection: CaptureSelection): Promise<CaptureResult> {
  const response = await invoke("complete_capture_selection", {
    selection,
  });

  return captureResultSchema.parse(response);
}

export async function cancelCapture(): Promise<void> {
  await invoke("cancel_capture");
}
