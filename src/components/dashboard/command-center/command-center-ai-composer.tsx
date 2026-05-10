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
    <div className="w-full border-t border-zinc-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 dark:border-zinc-800 dark:bg-[#1a1a1a] dark:supports-[backdrop-filter]:bg-background dark:bg-[#1a1a1a]/90 md:pb-5 md:pt-4">
      <div className="mx-auto w-full max-w-4xl px-4 md:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mx-auto w-full"
        >
          <div className="flex items-center border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-[#1a1a1a]">
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
              className="flex-1 bg-transparent px-4 py-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="flex items-center gap-2 bg-zinc-900 px-6 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-zinc-700 disabled:opacity-50 active:scale-95 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 [&_svg]:text-white dark:[&_svg]:text-zinc-900"
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
