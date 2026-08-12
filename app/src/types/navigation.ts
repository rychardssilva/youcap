import type { LucideIcon } from "lucide-react";

export type AppView =
  "capture" | "vocabulary" | "word" | "notes" | "review" | "settings";

export type NavigationItem = {
  id: AppView;
  label: string;
  description: string;
  icon: LucideIcon;
};
