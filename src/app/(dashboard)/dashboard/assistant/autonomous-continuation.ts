const CONTINUATION_PATTERNS: RegExp[] = [
  /\bplease\s+wait\b/i,
  /\blet\s+me\s+(fetch|check|look|search|find|pull|get)\b/i,
  /\bone\s+(moment|sec(ond)?)\b/i,
  /\bworking\s+on\s+it\b/i,
  /\bfetching\b/i,
  /\blooking\s+that\s+up\b/i,
  /\bsearching\s+your\s+account\b/i,
  /\bi['\u2019]ll\s+(check|fetch|look|search|find|pull|get)\b/i,
  /\bi\s+will\s+(check|fetch|look|search|find|pull|get)\b/i,
  /\bstand\s+by\b/i,
  /\bpulling\s+that\s+up\b/i,
  /\bgive\s+me\s+a\s+moment\b/i,
];

const MAX_CONTINUATION_TEXT_LENGTH = 300;

/**
 * Returns `true` when the assistant reply is a short transitional "hold on" message
 * rather than a substantive answer. Replies longer than 300 characters are considered
 * substantive even if they happen to contain one of the trigger phrases.
 */
export function isAutonomousContinuationSignal(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_CONTINUATION_TEXT_LENGTH) return false;
  return CONTINUATION_PATTERNS.some((p) => p.test(trimmed));
}

export const MAX_AUTONOMOUS_FOLLOWUPS = 3;
export const AUTONOMOUS_FOLLOWUP_DELAY_MS = 800;

export function autonomousDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
