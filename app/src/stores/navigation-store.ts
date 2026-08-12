import { create } from "zustand";

import type { AppView } from "@/types/navigation";

type NavigationStore = {
  currentView: AppView;
  selectedWordId: string | null;
  shouldOpenNotesFocused: boolean;
  setCurrentView: (view: AppView) => void;
  setSelectedWordId: (wordId: string | null) => void;
  openNotesForWord: (wordId: string) => void;
  consumeNotesFocusRequest: () => void;
};

export const useNavigationStore = create<NavigationStore>((set) => ({
  currentView: "capture",
  selectedWordId: null,
  shouldOpenNotesFocused: false,
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedWordId: (wordId) => set({ selectedWordId: wordId }),
  openNotesForWord: (wordId) =>
    set({
      currentView: "notes",
      selectedWordId: wordId,
      shouldOpenNotesFocused: true,
    }),
  consumeNotesFocusRequest: () => set({ shouldOpenNotesFocused: false }),
}));
