import {
  BookOpen,
  Crosshair,
  History,
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
    description: "Atalho global e selecao de area",
    icon: Crosshair,
  },
  {
    id: "vocabulary",
    label: "Biblioteca",
    description: "Organizacao do vocabulario salvo",
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
    description: "Anotacoes, frases e tags",
    icon: NotebookPen,
  },
  {
    id: "history",
    label: "Historico",
    description: "Registro das consultas realizadas",
    icon: History,
  },
  {
    id: "review",
    label: "Revisao",
    description: "Reforco do aprendizado",
    icon: BookOpen,
  },
  {
    id: "settings",
    label: "Configuracoes",
    description: "Preferencias do aplicativo",
    icon: Settings,
  },
];
