import { Clock3 } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";

export function HistoryPage() {
  return (
    <EmptyState
      icon={Clock3}
      title="Histórico vazio"
      description="As consultas realizadas pelo popup serão registradas aqui com data, palavra, origem e quantidade de aparições."
    />
  );
}
