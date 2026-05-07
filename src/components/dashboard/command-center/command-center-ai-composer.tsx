"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";

export function CommandCenterAiComposer() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      router.push(`/dashboard?q=${encodeURIComponent(trimmed)}`);
      setText("");
    } finally {
      setBusy(false);
    }
  }, [busy, router, text]);

  return (
    <div className="w-full border-t border-[#282828] bg-[#0B0B0B]/98 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md supports-[backdrop-filter]:bg-[#0B0B0B]/90 md:pb-5 md:pt-4">
      <div className="mx-auto w-full max-w-4xl px-4 md:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mx-auto w-full"
        >
          <div className="flex items-center border border-[#282828] bg-[#1A1A1A] p-1.5 shadow-lg">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="Ask Letora..."
              className="flex-1 bg-transparent px-4 py-3 text-[13px] text-zinc-200 placeholder-[#444748] outline-none"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="flex items-center gap-2 bg-white px-6 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0B0B0B] transition-all hover:bg-zinc-200 disabled:opacity-50 active:scale-95"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  Send Message
                  <ArrowUpRight className="size-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
