/**
 * In-memory throttling for admin alerts (best-effort per server instance).
 * Prevents email/DB spam when the same failure repeats (e.g. bad model id every request).
 */

const DEFAULT_EMAIL_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_DB_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function emailCooldownMs(): number {
  const raw = process.env.ADMIN_ALERT_EMAIL_COOLDOWN_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_EMAIL_COOLDOWN_MS;
}

function dbCooldownMs(): number {
  const raw = process.env.ADMIN_ALERT_DB_COOLDOWN_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DB_COOLDOWN_MS;
}

const lastEmailAt = new Map<string, number>();
const lastDbAt = new Map<string, number>();

/** Clears cooldown state (Vitest only). */
export function resetAlertThrottleForTests(): void {
  lastEmailAt.clear();
  lastDbAt.clear();
}

export function shouldSendAdminAlertEmail(key: string): boolean {
  const now = Date.now();
  const windowMs = emailCooldownMs();
  if (windowMs === 0) return true;
  const last = lastEmailAt.get(key) ?? 0;
  if (now - last < windowMs) return false;
  lastEmailAt.set(key, now);
  return true;
}

export function shouldInsertSystemAlertRow(key: string): boolean {
  const now = Date.now();
  const windowMs = dbCooldownMs();
  if (windowMs === 0) return true;
  const last = lastDbAt.get(key) ?? 0;
  if (now - last < windowMs) return false;
  lastDbAt.set(key, now);
  return true;
}

/** Stable key for repeated Anthropic CEO failures (same stage + error class). */
export function buildCeoFailureThrottleKey(
  stage: "anthropic_loop" | "anthropic_summary",
  errorMessage: string,
): { emailKey: string; dbKey: string } {
  const lower = errorMessage.toLowerCase();
  let bucket = "unknown";
  if (lower.includes("not_found") || lower.includes("404")) bucket = "model_not_found";
  else if (lower.includes("credit") || lower.includes("billing") || lower.includes("402")) bucket = "billing";
  else if (lower.includes("429") || lower.includes("rate")) bucket = "rate_limit";
  else if (lower.includes("401") || lower.includes("authentication")) bucket = "auth";
  else if (lower.includes("timeout") || lower.includes("timed out")) bucket = "timeout";

  const emailKey = `ceo_primary_failure:${stage}:${bucket}`;
  const dbKey = emailKey;
  return { emailKey, dbKey };
}
