const REF_TOKEN_LINE = /LETORA_REF:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** Used by inbound webhook — extract tenancy correlation token from email text. */
export function extractReferencingTokenFromText(text: string): string | null {
  const m = text.match(REF_TOKEN_LINE);
  if (m?.[1]) return m[1];
  const uuid =
    /([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i.exec(text);
  return uuid?.[1] ?? null;
}

export function classifyReferencingReply(text: string): "positive" | "negative" | "unknown" {
  const t = text.toLowerCase();
  const negative =
    /\b(decline|declined|reject|rejected|fail|failed|unsatisfactory|adverse|unable to accept|cannot proceed)\b/.test(
      t,
    );
  const positive =
    /\b(complete|completed|passed|pass|clear|cleared|satisfactory|acceptable|approved|all clear|successful)\b/.test(
      t,
    );
  if (negative && !positive) return "negative";
  if (positive && !negative) return "positive";
  if (positive && negative) return "unknown";
  return "unknown";
}
