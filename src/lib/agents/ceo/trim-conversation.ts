/** Upper bound on how many prior user/assistant messages are sent to the model (aligned with UI load). */
export const DEFAULT_MAX_CEO_CONVERSATION_MESSAGES = 30;

type Turn = { role: "user" | "assistant"; content: string };

/**
 * Keeps the most recent messages up to `maxMessages`. If trimming leaves a leading
 * assistant message (no preceding user in the window), drops those so the window
 * starts with a user turn when possible.
 */
export function trimConversationMessages<T extends Turn>(
  messages: readonly T[],
  maxMessages: number,
): T[] {
  if (messages.length <= maxMessages) {
    return messages.slice();
  }

  const slice = messages.slice(-maxMessages);
  let start = 0;
  while (start < slice.length && slice[start].role === "assistant") {
    start += 1;
  }

  return slice.slice(start);
}
