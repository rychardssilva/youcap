import { Clock3 } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";

export function HistoryPage() {
  return (
    <EmptyState
      icon={Clock3}
      title="Historico vazio"
      description="As consultas realizadas pelo popup serao registradas aqui com data, palavra, origem e quantidade de aparicoes."
    />
  );
}
