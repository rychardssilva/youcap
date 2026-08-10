import { create } from "zustand";

type ToastVariant = "success" | "error" | "info";

export type AppToast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastInput = Omit<AppToast, "id">;

type ToastStore = {
  toasts: AppToast[];
  addToast: (toast: ToastInput) => void;
  removeToast: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    window.setTimeout(() => {
      useToastStore.getState().removeToast(id);
    }, 3600);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));
