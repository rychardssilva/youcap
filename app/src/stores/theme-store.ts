import { create } from "zustand";

type Theme = "light" | "dark";

type ThemeStore = {
  theme: Theme;
  hydrateTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const storageKey = "yocab-theme";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(storageKey);

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: "light",
  hydrateTheme: () => set({ theme: getStoredTheme() }),
  setTheme: (theme) => {
    window.localStorage.setItem(storageKey, theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => ({
      theme: (() => {
        const nextTheme = state.theme === "light" ? "dark" : "light";
        window.localStorage.setItem(storageKey, nextTheme);
        return nextTheme;
      })(),
    })),
}));
