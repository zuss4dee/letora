import Link from "next/link";

/** Shown on tenant/property/tenancy detail when opened from import batch review (returnTo query). */
export function BatchReviewReturnBanner({ href }: { href: string }) {
  return (
    <div className="sticky top-0 z-30 border-b border-zinc-700/80 bg-zinc-950/95 px-4 py-2 backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-950/95">
      <Link
        href={href}
        className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#afefdd] hover:text-white"
      >
        ← Back to batch review
      </Link>
    </div>
  );
}
