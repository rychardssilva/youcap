import { AlertTriangle } from "lucide-react";

import { StateView } from "@/components/shared/state-view";

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <StateView
      icon={AlertTriangle}
      title="Não foi possível carregar"
      description={message}
      actionLabel={onRetry ? "Tentar novamente" : undefined}
      onAction={onRetry}
    />
  );
}
