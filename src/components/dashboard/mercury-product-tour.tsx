"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { markProductTourComplete } from "@/lib/actions/user-settings";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const TOUR_TARGETS = ["compliance", "assistant-input", "portfolio"] as const;
type TourTarget = (typeof TOUR_TARGETS)[number];

const STEP_COPY: Record<
  TourTarget,
  { title: string; body: string }
> = {
  compliance: {
    title: "Compliance",
    body: "Legal safety. Store your EPCs and Gas certs here to stay protected.",
  },
  "assistant-input": {
    title: "Assistant",
    body: 'Ask Letora anything. "Draft a lease," "Check my rent," or "Explain UK tax rules."',
  },
  portfolio: {
    title: "Portfolio snapshot",
    body: "Your bird's-eye view. We track your performance so you don't have to.",
  },
};

const PAD = 10;

function queryTarget(step: number): HTMLElement | null {
  const key = TOUR_TARGETS[step];
  if (!key) return null;
  return document.querySelector<HTMLElement>(`[data-mercury-tour="${key}"]`);
}

type TourRect = { top: number; left: number; width: number; height: number };

const CELEBRATION_COLORS = ["#BD9952", "#c9a660", "#e5d4b0", "#f8f4eb", "#ffffff"];

function fireMercuryConfetti() {
  void import("canvas-confetti").then(({ default: confetti }) => {
    const zIndex = 400;
    const burst = (opts: Parameters<typeof confetti>[0]) => confetti({ ...opts, zIndex });

    burst({
      particleCount: 110,
      spread: 78,
      origin: { x: 0.5, y: 0.58 },
      startVelocity: 38,
      gravity: 0.92,
      ticks: 260,
      scalar: 0.9,
      colors: CELEBRATION_COLORS,
    });
    window.setTimeout(() => {
      burst({
        particleCount: 45,
        angle: 58,
        spread: 48,
        origin: { x: 0.34, y: 0.62 },
        colors: ["#BD9952", "#d4b06a"],
      });
      burst({
        particleCount: 45,
        angle: 122,
        spread: 48,
        origin: { x: 0.66, y: 0.62 },
        colors: ["#BD9952", "#d4b06a"],
      });
    }, 160);
  });
}

function MercuryTourCelebration({ onComplete }: { onComplete: () => void }) {
  const doneRef = useRef(false);
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (!confettiFiredRef.current) {
      confettiFiredRef.current = true;
      fireMercuryConfetti();
    }
    const id = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete();
    }, 2900);
    return () => window.clearTimeout(id);
  }, [onComplete]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[320] flex flex-col items-center justify-center overflow-hidden"
      role="status"
      aria-live="polite"
    >
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_42%,rgba(189,153,82,0.34)_0%,rgba(15,16,20,0.55)_45%,rgba(6,7,10,0.92)_100%)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(189,153,82,0.12)_0%,transparent_42%)]"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: [0, 1, 0.85], scale: [0.92, 1, 1.02] }}
        transition={{ duration: 2.4, ease: "easeOut", times: [0, 0.35, 1] }}
        aria-hidden
      />
      <motion.div
        className="relative z-[1] max-w-md px-8 text-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[#BD9952]/95">
          Mercury complete
        </p>
        <p className="mt-4 font-headline text-xl font-extralight leading-snug tracking-[-0.02em] text-white sm:text-2xl">
          You&apos;re all set. Welcome to the future of landlording.
        </p>
      </motion.div>
    </div>
  );
}

function SpotlightPanels({ rect }: { rect: TourRect | null }) {
  if (!rect) {
    return (
      <div
        className="pointer-events-auto fixed inset-0 z-[260] bg-[rgba(6,7,10,0.78)] backdrop-blur-[2px]"
        aria-hidden
      />
    );
  }

  const { top, left, width, height } = rect;
  const t = Math.max(0, top);
  const l = Math.max(0, left);
  const r = l + width;
  const b = t + height;

  return (
    <>
      <div
        className="pointer-events-auto fixed left-0 right-0 top-0 z-[260] bg-[rgba(6,7,10,0.78)] backdrop-blur-[2px]"
        style={{ height: t }}
        aria-hidden
      />
      <div
        className="pointer-events-auto fixed left-0 z-[260] bg-[rgba(6,7,10,0.78)] backdrop-blur-[2px]"
        style={{ top: t, width: l, height: Math.max(0, b - t) }}
        aria-hidden
      />
      <div
        className="pointer-events-auto fixed z-[260] bg-[rgba(6,7,10,0.78)] backdrop-blur-[2px]"
        style={{ top: t, left: r, right: 0, height: Math.max(0, b - t) }}
        aria-hidden
      />
      <div
        className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[260] bg-[rgba(6,7,10,0.78)] backdrop-blur-[2px]"
        style={{ top: b }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed z-[261] rounded-md border border-white/25 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
        style={{ top: t, left: l, width, height }}
        aria-hidden
      />
    </>
  );
}

export function MercuryProductTour({
  active,
  onDismissed,
}: {
  /** Server flag: user has not completed the tour */
  active: boolean;
  onDismissed?: () => void;
}) {
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<TourRect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number; placement: "above" | "below" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"tour" | "celebrate">("tour");
  const tourActive = active && mounted;
  const rafRef = useRef<number>(0);

  const onCelebrationComplete = useCallback(() => {
    onDismissed?.();
    router.refresh();
  }, [onDismissed, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const measure = useCallback(() => {
    if (typeof window === "undefined" || phase === "celebrate") return;
    const el = queryTarget(step);
    if (!el) {
      setRect(null);
      setCardPos(null);
      return;
    }
    if (step === 0 && isMobile) {
      setOpenMobile(true);
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    window.requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const padded: TourRect = {
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      };
      setRect(padded);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cardH = 200;
      const cardW = Math.min(360, vw - 32);
      const margin = 16;
      const spaceBelow = vh - (padded.top + padded.height);
      const placeBelow = spaceBelow >= cardH + margin || padded.top < cardH + margin;
      const placement = placeBelow ? "below" : "above";
      let top = placement === "below" ? padded.top + padded.height + 12 : padded.top - 12 - cardH;
      top = Math.max(margin, Math.min(top, vh - cardH - margin));
      let left = padded.left + padded.width / 2 - cardW / 2;
      left = Math.max(margin, Math.min(left, vw - cardW - margin));
      setCardPos({ top, left, placement });
    });
  }, [step, isMobile, setOpenMobile, phase]);

  useLayoutEffect(() => {
    if (!tourActive || phase === "celebrate") return;
    measure();
  }, [tourActive, phase, measure, step]);

  useEffect(() => {
    if (!tourActive || phase === "celebrate") return;
    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = window.requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [tourActive, phase, measure]);

  /** Mobile sheet sidebar: open first, then measure after the panel animates in. */
  useEffect(() => {
    if (!tourActive || phase === "celebrate" || step !== 0 || !isMobile) return;
    const id = window.setTimeout(() => measure(), 380);
    return () => window.clearTimeout(id);
  }, [tourActive, phase, step, isMobile, measure]);

  const finish = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await markProductTourComplete();
      if (res.ok) {
        setPhase("celebrate");
      }
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const onSkip = useCallback(() => {
    void finish();
  }, [finish]);

  const onNext = useCallback(() => {
    if (step >= TOUR_TARGETS.length - 1) {
      void finish();
      return;
    }
    setStep((s) => s + 1);
  }, [step, finish]);

  if (!mounted || !tourActive) return null;

  if (phase === "celebrate") {
    return createPortal(<MercuryTourCelebration onComplete={onCelebrationComplete} />, document.body);
  }

  const key = TOUR_TARGETS[step];
  const copy = key ? STEP_COPY[key] : null;
  const isLast = step >= TOUR_TARGETS.length - 1;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[250]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mercury-tour-title"
      aria-describedby="mercury-tour-desc"
    >
      <SpotlightPanels rect={rect} />

      <button
        type="button"
        onClick={onSkip}
        disabled={busy}
        className="pointer-events-auto fixed right-5 top-5 z-[270] font-headline text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white/55 transition-colors hover:text-white/90 disabled:opacity-50"
      >
        Skip
      </button>

      {copy && cardPos ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: cardPos.placement === "below" ? 8 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto fixed z-[270] w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-white/15 bg-[rgba(14,15,18,0.92)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-md"
            style={{ top: cardPos.top, left: cardPos.left }}
          >
            <p className="font-headline text-[0.58rem] font-semibold uppercase tracking-[0.28em] text-[#BD9952]/90">
              Mercury · Step {step + 1} of {TOUR_TARGETS.length}
            </p>
            <h2 id="mercury-tour-title" className="mt-2 font-headline text-lg font-light tracking-tight text-white">
              {copy.title}
            </h2>
            <p id="mercury-tour-desc" className="mt-2 font-headline text-sm font-light leading-relaxed text-white/75">
              {copy.body}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onNext}
                disabled={busy}
                className={cn(
                  "font-headline text-[0.7rem] font-medium uppercase tracking-[0.18em]",
                  "rounded-md border border-white/35 bg-transparent px-5 py-2.5 text-white transition-colors",
                  "hover:border-white/55 hover:bg-white/[0.04] disabled:opacity-50",
                )}
              >
                {busy ? "…" : isLast ? "Done" : "Next"}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="pointer-events-auto fixed bottom-8 left-1/2 z-[270] -translate-x-1/2 rounded-md border border-white/20 px-4 py-2 font-headline text-xs text-white/70">
          Looking for tour targets…
        </div>
      )}
    </div>,
    document.body,
  );
}
