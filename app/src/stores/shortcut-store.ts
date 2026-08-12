import { create } from "zustand";

import {
  getCaptureShortcutStatus,
  registerCaptureShortcut,
  unregisterCaptureShortcut,
  type CaptureShortcutStatus,
} from "@/services/capture-service";
import { upsertSetting } from "@/services/settings-service";

export const defaultCaptureShortcut = "CommandOrControl+Shift+E";

type ShortcutState = {
  shortcut: string;
  registered: boolean;
  isLoading: boolean;
  loadShortcutStatus: () => Promise<CaptureShortcutStatus>;
  registerShortcut: (shortcut: string) => Promise<CaptureShortcutStatus>;
  unregisterShortcut: () => Promise<CaptureShortcutStatus>;
};

export const useShortcutStore = create<ShortcutState>((set) => ({
  shortcut: defaultCaptureShortcut,
  registered: false,
  isLoading: false,

  async loadShortcutStatus() {
    set({ isLoading: true });
    try {
      const status = await getCaptureShortcutStatus();
      set({
        shortcut: status.shortcut || defaultCaptureShortcut,
        registered: status.registered,
      });
      return status;
    } finally {
      set({ isLoading: false });
    }
  },

  async registerShortcut(shortcut: string) {
    set({ isLoading: true });
    try {
      const status = await registerCaptureShortcut(shortcut);
      await upsertSetting("global_shortcut", status.shortcut);
      set({ shortcut: status.shortcut, registered: status.registered });
      return status;
    } finally {
      set({ isLoading: false });
    }
  },

  async unregisterShortcut() {
    set({ isLoading: true });
    try {
      const status = await unregisterCaptureShortcut();
      set({ shortcut: status.shortcut, registered: status.registered });
      return status;
    } finally {
      set({ isLoading: false });
    }
  },
}));
