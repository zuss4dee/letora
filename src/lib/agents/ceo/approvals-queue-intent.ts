/**
 * Detects read-only “what’s in Approvals / pending approvals” questions.
 * Mutations (approve/reject/send items) must stay gated — excluded here.
 */
export function isApprovalsQueueInspectionMessage(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (!/\bapprovals?\b/.test(t) && !/\bapproval\s+queue\b/.test(t)) return false;

  if (
    /\b(approve|reject)\b/.test(t) &&
    (/\b(applicant|application|applied)\b/.test(t) || /\b(this|that|the)\s+lead\b/.test(t))
  ) {
    return false;
  }

  if (/\b(approve|reject|deny)\b/.test(t) && /\bapprovals?\b/.test(t)) return false;
  if (/\b(send|dispatch|execute)\b/.test(t) && /\bapprovals?\b/.test(t)) return false;

  if (/\b(pending\s+approvals?|approvals?\s+queue|approval\s+queue)\b/.test(t)) return true;
  if (/\bwhat'?s\s+in\s+(?:the\s+)?approvals?\b/.test(t)) return true;
  if (/\breview\s+(?:the\s+)?(?:pending\s+)?approvals?\b/.test(t)) return true;
  if (/\b(list|show|see|check)\s+(?:me\s+)?(?:the\s+)?(?:pending\s+)?approvals?\b/.test(t)) return true;
  if (/\b(list|show|see|check)\b[\s\S]{0,48}\bapprovals?\b/.test(t)) return true;
  if (/\bwhat\s+('?s|is)\s+[\s\S]{0,40}\bapprovals?\b/.test(t)) return true;

  return false;
}
