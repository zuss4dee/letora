"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Loader2, Send, Zap } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";

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
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-5 pt-2 md:left-[var(--sidebar-width)]">
      <div className="pointer-events-auto w-full max-w-5xl px-4 sm:px-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex min-h-[8.5rem] flex-col rounded border border-[#333333] bg-[#1A1A1A] p-2 transition-colors focus-within:border-white sm:min-h-[9rem]"
          data-mercury-tour="assistant-input"
        >
          <div className="mb-2 flex items-center gap-3 border border-[#333333] bg-black px-3 py-1.5">
            <Zap className="size-4 shrink-0 fill-white text-white" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">LETORA AI</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-1 sm:flex-row sm:items-end">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="Ask Letora about a tenant, rent issue, maintenance request, or approval…"
              rows={4}
              className="min-h-[6.25rem] flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-relaxed text-zinc-100 shadow-none outline-none ring-0 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-h-[6.75rem]"
              aria-label="Letora AI input"
            />
            <div className="flex shrink-0 items-center justify-end gap-2 pb-1 sm:flex-col sm:items-end sm:pb-0 sm:pt-0">
              <span className="hidden font-mono text-[10px] text-zinc-600 sm:inline">CMD + ENTER to send</span>
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="p-1.5 text-zinc-400 transition-colors hover:bg-[#242424] hover:text-white disabled:opacity-40"
                aria-label="Send message"
              >
                {busy ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
