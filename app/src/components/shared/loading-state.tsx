export function LoadingState() {
  return (
    <div className="space-y-3 rounded-md border bg-card p-5 text-card-foreground">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="h-10 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-24 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
