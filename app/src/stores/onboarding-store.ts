import { create } from "zustand";

type OnboardingStore = {
  isOpen: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  setOnboardingOpen: (isOpen: boolean) => void;
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  isOpen: false,
  openOnboarding: () => set({ isOpen: true }),
  closeOnboarding: () => set({ isOpen: false }),
  setOnboardingOpen: (isOpen) => set({ isOpen }),
}));
