export default function ComplianceLoading() {
  return (
    <div className="@container/main relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-x-0 top-0 h-[min(48vh,480px)] bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(189,153,82,0.12),transparent_62%)]" />
      </div>
      <div className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-10 md:px-8 md:py-12 lg:px-12">
        <div className="mb-10 h-28 max-w-5xl animate-pulse rounded-2xl border border-border/40 bg-muted/20" />
        <div className="mb-12 max-w-3xl space-y-4">
          <div className="h-4 w-24 animate-pulse rounded bg-muted/30" />
          <div className="h-10 w-3/4 max-w-md animate-pulse rounded bg-muted/25" />
          <div className="h-16 max-w-xl animate-pulse rounded bg-muted/15" />
        </div>
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-border/40 bg-muted/15"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
