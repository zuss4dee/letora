const REF_TOKEN_LINE = /LETORA_REF:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** Used by inbound webhook — extract tenancy correlation token from email text. */
export function extractReferencingTokenFromText(text: string): string | null {
  const m = text.match(REF_TOKEN_LINE);
  if (m?.[1]) return m[1];
  const uuid =
    /([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i.exec(text);
  return uuid?.[1] ?? null;
}

/**
 * Labels inbound agency mail for auto-advance (contract_sent + reference tasks) when **positive**
 * and no conflicting negative cues. Phrases cover common UK referencing email wording.
 */
export function classifyReferencingReply(text: string): "positive" | "negative" | "unknown" {
  const t = text.toLowerCase();

  const negative =
    /\b(decline|declined|reject|rejected|fail|failed|unsatisfactory|adverse|unable to accept|cannot proceed)\b/.test(
      t,
    );

  const phrasePositive =
    /\b(?:referencing|references?)\s+(?:has\s+)?(?:passed|completed|cleared|satisfied)\b/.test(t) ||
    /\breferencing\s+passed\b/.test(t) ||
    /\b(?:referencing|reference)\s+is\s+(?:complete|passed|clear|ok|satisfactory|successful)\b/.test(t) ||
    /\bpassed\s+and\s+completed\b/.test(t) ||
    /\ball\s+(?:references?|checks?)\s+(?:are\s+)?(?:complete|passed|clear|satisfactory|ok)\b/.test(t) ||
    /\bgood\s+to\s+go\b/.test(t) ||
    /\ball\s+clear\b/.test(t);

  const wordPositive =
    /\b(complete|completed|passed|pass|clear|cleared|satisfactory|acceptable|approved|all clear|successful)\b/.test(
      t,
    );

  const positive = phrasePositive || wordPositive;

  if (negative && !positive) return "negative";
  if (positive && !negative) return "positive";
  if (positive && negative) return "unknown";
  return "unknown";
}
