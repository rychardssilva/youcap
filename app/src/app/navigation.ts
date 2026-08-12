import {
  BookOpen,
  Crosshair,
  Library,
  NotebookPen,
  Settings,
  WholeWord,
} from "lucide-react";

import type { NavigationItem } from "@/types/navigation";

export const navigationItems: NavigationItem[] = [
  {
    id: "capture",
    label: "Captura",
    description: "Atalho global e seleção de área",
    icon: Crosshair,
  },
  {
    id: "vocabulary",
    label: "Biblioteca",
    description: "Organização do vocabulário salvo",
    icon: Library,
  },
  {
    id: "word",
    label: "Palavra",
    description: "Detalhes da palavra selecionada",
    icon: WholeWord,
  },
  {
    id: "notes",
    label: "Caderno",
    description: "Anotações, frases e tags",
    icon: NotebookPen,
  },
  {
    id: "review",
    label: "Revisão",
    description: "Reforço do aprendizado",
    icon: BookOpen,
  },
  {
    id: "settings",
    label: "Configurações",
    description: "Preferências do aplicativo",
    icon: Settings,
  },
];
