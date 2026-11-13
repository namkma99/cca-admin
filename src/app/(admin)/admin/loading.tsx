export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <p className="text-sm text-muted-foreground">Loading administration…</p>
      <div aria-hidden="true" className="animate-pulse space-y-5">
        <div className="h-10 w-56 rounded-lg bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
