import { CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToastStore, type AppToast } from "@/stores/toast-store";

const toastIcon = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

function ToastItem({ toast }: { toast: AppToast }) {
  const removeToast = useToastStore((state) => state.removeToast);
  const Icon = toastIcon[toast.variant];

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-[360px] items-start gap-3 rounded-md border bg-popover p-4 text-popover-foreground shadow-sm",
        toast.variant === "success" && "border-primary/35",
        toast.variant === "error" && "border-destructive/40",
      )}
      role="status"
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          toast.variant === "success" && "text-primary",
          toast.variant === "error" && "text-destructive",
          toast.variant === "info" && "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description ? <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p> : null}
      </div>
      <button
        className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
        onClick={() => removeToast(toast.id)}
        aria-label="Fechar notificacao"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
