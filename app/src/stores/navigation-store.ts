import { create } from "zustand";

import type { AppView } from "@/types/navigation";

type NavigationStore = {
  currentView: AppView;
  selectedWordId: string | null;
  setCurrentView: (view: AppView) => void;
  setSelectedWordId: (wordId: string | null) => void;
};

export const useNavigationStore = create<NavigationStore>((set) => ({
  currentView: "capture",
  selectedWordId: null,
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedWordId: (wordId) => set({ selectedWordId: wordId }),
}));
