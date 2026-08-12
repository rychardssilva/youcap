type PageHeaderProps = {
  title: string;
  description: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="truncate text-muted-foreground">Yocab</span>
        <span className="text-muted-foreground/70">/</span>
        <h1 className="truncate font-medium">{title}</h1>
      </div>
      <p className="sr-only">{description}</p>
    </div>
  );
}
