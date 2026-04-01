/**
 * Simple in-memory rate limiter for chat API (best-effort per server instance).
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

type Entry = { count: number; windowStart: number };

const buckets = new Map<string, Entry>();

export function checkChatRateLimit(userId: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const key = userId;
  let e = buckets.get(key);
  if (!e || now - e.windowStart >= WINDOW_MS) {
    e = { count: 1, windowStart: now };
    buckets.set(key, e);
    return { ok: true };
  }
  e.count += 1;
  if (e.count > MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((e.windowStart + WINDOW_MS - now) / 1000);
    return { ok: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }
  return { ok: true };
}
