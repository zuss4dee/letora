import type { BatchImportDetailRow } from "@/lib/actions/batch-onboarding";

/** User-facing triage for Needs review rows */
export type ReviewPriority = "fix_now" | "check_soon" | "informational";

export function reviewPriorityRank(p: ReviewPriority): number {
  switch (p) {
    case "fix_now":
      return 0;
    case "check_soon":
      return 1;
    case "informational":
      return 2;
    default:
      return 3;
  }
}

function combinedReviewText(r: BatchImportDetailRow): string {
  return [
    ...r.previewErrors,
    ...r.previewWarnings,
    ...r.prepareWarnings,
    ...(r.tags ?? []),
    r.runtimeError ?? "",
    r.skipReason ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Classify a row already placed in the "needs review" queue.
 * @param involvedInDuplicate — line appears in duplicate address/email heuristics
 */
export function classifyNeedsReviewPriority(
  r: BatchImportDetailRow,
  involvedInDuplicate: boolean,
): ReviewPriority {
  if (involvedInDuplicate) return "fix_now";

  const haystack = combinedReviewText(r);

  if (r.previewErrors.length > 0) return "fix_now";

  if (
    /right\s*to\s*rent|r2r|deposit\s*protection|section\s*21|section\s*8|eviction|hmo|licens(e|ing)|gdpr|illegal|fraud|verification\s*failed|failed\s*check/i.test(
      haystack,
    )
  ) {
    return "fix_now";
  }

  if (
    /arrears|overdue|rent\s*tracker|mapping|stripe\s*connect|payment\s*intent|notice|contract\s*pending|prescribed\s*information/i.test(
      haystack,
    )
  ) {
    return "check_soon";
  }

  return "informational";
}

export function priorityLabel(p: ReviewPriority): { label: string; className: string } {
  switch (p) {
    case "fix_now":
      return {
        label: "Fix now",
        className:
          "border-border dark:border-[#BB5551]/45 bg-muted dark:bg-[#2a1514]/80 text-[#ee7d77]",
      };
    case "check_soon":
      return {
        label: "Check soon",
        className:
          "border-border dark:border-[#f8cf83]/35 bg-muted dark:bg-[#2a2210]/75 text-[#f8cf83]",
      };
    case "informational":
      return {
        label: "Informational",
        className:
          "border-zinc-200 dark:border-zinc-600/50 bg-zinc-100 dark:bg-zinc-900/70 text-zinc-600 dark:text-zinc-400",
      };
    default:
      return {
        label: p,
        className:
          "border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-500",
      };
  }
}
