import { create } from "zustand";

import type { WordSort } from "@/services/database-service";

type VocabularyStore = {
  query: string;
  sort: WordSort;
  refreshToken: number;
  setQuery: (query: string) => void;
  setSort: (sort: WordSort) => void;
  requestRefresh: () => void;
};

export const useVocabularyStore = create<VocabularyStore>((set) => ({
  query: "",
  sort: "last_lookup",
  refreshToken: 0,
  setQuery: (query) => set({ query }),
  setSort: (sort) => set({ sort }),
  requestRefresh: () => set((state) => ({ refreshToken: state.refreshToken + 1 })),
}));
