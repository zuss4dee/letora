"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ExpandableInstructionTextProps = {
  text: string;
  /** Applied to the paragraph that holds the instruction body. */
  className?: string;
  /** Tailwind line-clamp classes when collapsed (e.g. line-clamp-1, line-clamp-3). */
  collapsedClampClassName?: string;
  /**
   * When this block sits inside `<details><summary>`, prevent the toggle button
   * from opening/closing the details panel.
   */
  stopDetailsToggle?: boolean;
};

/**
 * Instruction / attention copy: short text shows in full; long text clamps when collapsed
 * with an explicit Show more / Show less control (not hover-only).
 */
export function ExpandableInstructionText({
  text,
  className,
  collapsedClampClassName = "line-clamp-3",
  stopDetailsToggle = false,
}: ExpandableInstructionTextProps) {
  const autoId = useId();
  const bodyId = `${autoId}-body`;
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);

  const normalized = text.trim();
  if (!normalized) return null;

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (expanded) {
      setNeedsToggle(true);
      return;
    }
    setNeedsToggle(el.scrollHeight > el.clientHeight + 1);
  }, [normalized, expanded, collapsedClampClassName]);

  return (
    <div className="min-w-0 space-y-1">
      <p
        ref={contentRef}
        id={bodyId}
        className={cn(
          "whitespace-pre-wrap break-words",
          className,
          !expanded && collapsedClampClassName,
        )}
      >
        {normalized}
      </p>
      {needsToggle ? (
        <button
          type="button"
          className="inline-flex border border-[#333333] bg-[#141414] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#afefdd]/90 hover:border-[#afefdd]/40 hover:text-[#afefdd]"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={(e) => {
            if (stopDetailsToggle) {
              e.preventDefault();
              e.stopPropagation();
            }
            setExpanded((v) => !v);
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
