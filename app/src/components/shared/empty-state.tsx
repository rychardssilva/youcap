import type { LucideIcon } from "lucide-react";

import { StateView } from "@/components/shared/state-view";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState(props: EmptyStateProps) {
  return <StateView {...props} />;
}
