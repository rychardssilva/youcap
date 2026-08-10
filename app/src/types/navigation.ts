import type { LucideIcon } from "lucide-react";

export type AppView =
  "capture" | "vocabulary" | "word" | "notes" | "history" | "review" | "settings";

export type NavigationItem = {
  id: AppView;
  label: string;
  description: string;
  icon: LucideIcon;
};
