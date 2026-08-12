import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type StateViewProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StateView({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: StateViewProps) {
  return (
    <div className="surface-soft flex min-h-[260px] flex-col items-center justify-center border-dashed px-8 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-medium">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionLabel ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
