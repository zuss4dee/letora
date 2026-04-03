import type { CEOToolName } from "./tools";

/** Deep-link to Settings → Email & Automation (referencing agency fields). */
export const LETORA_REFERRING_SETTINGS_PATH = "/dashboard/settings?tab=email";

export type LetoraSuggestedAction = {
  id: string;
  label: string;
  kind: "link" | "message";
  href?: string;
  message?: string;
};

const LETORA_ACTIONS_LINE = /\nLETORA_SUGGESTED_ACTIONS:\s*([\s\S]+)$/i;

function parseJsonArray(raw: string): unknown {
  try {
    return JSON.parse(raw.trim()) as unknown;
  } catch {
    return null;
  }
}

function isSuggestedActionRow(v: unknown): v is LetoraSuggestedAction {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.label !== "string" || typeof o.kind !== "string") return false;
  if (o.kind !== "link" && o.kind !== "message") return false;
  if (o.kind === "link" && typeof o.href !== "string") return false;
  if (o.kind === "message" && typeof o.message !== "string") return false;
  return true;
}

/**
 * Strips the LETORA_SUGGESTED_ACTIONS line from the model reply and parses the JSON array.
 */
export function stripLetoraSuggestedActionsLine(reply: string): {
  reply: string;
  actions: LetoraSuggestedAction[];
} {
  const m = LETORA_ACTIONS_LINE.exec(reply);
  if (!m) {
    return { reply: reply.trimEnd(), actions: [] };
  }
  const without = reply.slice(0, m.index).trimEnd();
  const parsed = parseJsonArray(m[1] ?? "[]");
  if (!Array.isArray(parsed)) {
    return { reply: without, actions: [] };
  }
  const actions = parsed.filter(isSuggestedActionRow);
  return { reply: without, actions };
}

function dedupeById(actions: LetoraSuggestedAction[]): LetoraSuggestedAction[] {
  const seen = new Set<string>();
  const out: LetoraSuggestedAction[] = [];
  for (const a of actions) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}

/** Same href should not produce two link chips (tool JSON + pasted path in prose). */
function dedupeSuggestedActionsForUi(actions: LetoraSuggestedAction[]): LetoraSuggestedAction[] {
  const seenId = new Set<string>();
  const seenHref = new Set<string>();
  const out: LetoraSuggestedAction[] = [];
  for (const a of actions) {
    if (seenId.has(a.id)) continue;
    if (a.kind === "link" && a.href) {
      if (seenHref.has(a.href)) continue;
      seenHref.add(a.href);
    }
    seenId.add(a.id);
    out.push(a);
  }
  return out;
}

const TENANCY_ONBOARDING_PATH =
  /(?:\*\*)?\/?(dashboard\/tenancies\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}))(?:\*\*)?/gi;

/**
 * When the model pastes a tenancy onboarding path as text (often bold markdown), the chat
 * does not make it clickable. Extract paths and emit link chips; strip them from the visible reply.
 */
export function extractTenancyOnboardingLinksFromReply(reply: string): {
  actions: LetoraSuggestedAction[];
  cleanedReply: string;
} {
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(TENANCY_ONBOARDING_PATH.source, "gi");
  while ((m = re.exec(reply)) !== null) {
    const id = m[2];
    if (id) ids.add(id);
  }
  if (ids.size === 0) {
    return { actions: [], cleanedReply: reply };
  }

  const actions: LetoraSuggestedAction[] = [...ids].map((id, i) => ({
    id: `extracted-onboarding-${id}`,
    label: ids.size === 1 ? "Open onboarding" : `Open onboarding (${i + 1})`,
    kind: "link" as const,
    href: `/dashboard/tenancies/${id}`,
  }));

  let cleaned = reply;
  cleaned = cleaned.replace(new RegExp(TENANCY_ONBOARDING_PATH.source, "gi"), "");
  cleaned = cleaned.replace(/^\s*[-*•]\s*$/gm, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return { actions, cleanedReply: cleaned };
}

type PreparePayload =
  | {
      ok: false;
      code?: string;
      redirect_path?: string;
      error?: string;
      message?: string;
    }
  | {
      ok: true;
      tenancy_id: string;
      agency_email: string;
      agency_name: string;
      tenant_name?: string;
      onboarding_status: string;
      referencing_complete: boolean;
      handoff_sent?: boolean;
      referencing_last_outbound_at?: string | null;
      referencing_last_inbound_at?: string | null;
      tasks?: { task_name: string; status: string }[];
      tasks_complete?: number;
      tasks_total?: number;
    };

function parseToolJson(raw: string): Record<string, unknown> | null {
  try {
    const j = JSON.parse(raw) as unknown;
    return typeof j === "object" && j !== null ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Derives UI chips from prepare_referencing / send_referencing_handoff tool JSON.
 */
export function suggestedActionsFromReferencingTool(
  toolName: CEOToolName,
  raw: string,
): LetoraSuggestedAction[] {
  const o = parseToolJson(raw);
  if (!o) return [];

  if (toolName === "prepare_referencing") {
    const p = o as unknown as PreparePayload;
    if ("ok" in p && p.ok === false && p.code === "missing_agency_email") {
      const href = typeof p.redirect_path === "string" ? p.redirect_path : LETORA_REFERRING_SETTINGS_PATH;
      return [
        {
          id: "settings-referencing",
          label: "Go to Settings (referencing)",
          kind: "link",
          href,
        },
      ];
    }
    if ("ok" in p && p.ok === true && !p.referencing_complete && typeof p.tenancy_id === "string") {
      const handoffAlreadySent = p.handoff_sent === true;
      if (handoffAlreadySent) {
        return [];
      }
      const tenant = typeof p.tenant_name === "string" && p.tenant_name.trim() ? p.tenant_name.trim() : "this tenant";
      const agency =
        typeof p.agency_name === "string" && p.agency_name.trim() ? p.agency_name.trim() : "the referencing agency";
      return [
        {
          id: "confirm-send-referencing",
          label: `Email ${tenant}’s details to ${agency}`,
          kind: "message",
          message: `Please send the referencing handoff for ${tenant}.`,
        },
      ];
    }
    return [];
  }

  if (toolName === "send_referencing_handoff") {
    if (typeof o.error === "string" && o.code === "missing_agency_email") {
      const href = typeof o.redirect_path === "string" ? o.redirect_path : LETORA_REFERRING_SETTINGS_PATH;
      return [
        {
          id: "settings-referencing",
          label: "Go to Settings (referencing)",
          kind: "link",
          href,
        },
      ];
    }
  }

  return [];
}

/**
 * Deep links from resolve_onboarding_navigation tool JSON.
 */
export function suggestedActionsFromOnboardingNavigation(raw: string): LetoraSuggestedAction[] {
  const o = parseToolJson(raw);
  if (!o) return [];

  if (o.ok === true && typeof o.href === "string") {
    return [
      {
        id: "open-tenancy-onboarding",
        label: "Open onboarding",
        kind: "link",
        href: o.href,
      },
    ];
  }

  if (o.code === "multiple_tenancies" && Array.isArray(o.candidates)) {
    return (o.candidates as { tenancy_id?: string; label?: string; href?: string }[]).map(
      (c, i) => ({
        id: `onboarding-pick-${c.tenancy_id ?? i}`,
        label: typeof c.label === "string" ? c.label : `Tenancy ${i + 1}`,
        kind: "link" as const,
        href:
          typeof c.href === "string"
            ? c.href
            : typeof c.tenancy_id === "string"
              ? `/dashboard/tenancies/${c.tenancy_id}`
              : "/dashboard/tenancies",
      }),
    );
  }

  if (o.code === "multiple_tenants" && Array.isArray(o.candidates)) {
    return (o.candidates as { id?: string; full_name?: string | null }[]).map((c, i) => ({
      id: `pick-tenant-${c.id ?? i}`,
      label: c.full_name?.trim()
        ? `${c.full_name.trim()} · open profile`
        : `Tenant ${i + 1} · open profile`,
      kind: "link" as const,
      href: typeof c.id === "string" ? `/dashboard/tenants/${c.id}` : "/dashboard/tenants",
    }));
  }

  return [];
}

export function mergeSuggestedActionsFromTools(
  toolBatch: readonly { name: CEOToolName; raw: string }[],
): LetoraSuggestedAction[] {
  const out: LetoraSuggestedAction[] = [];
  for (const t of toolBatch) {
    if (t.name === "prepare_referencing" || t.name === "send_referencing_handoff") {
      out.push(...suggestedActionsFromReferencingTool(t.name, t.raw));
    }
    if (t.name === "resolve_onboarding_navigation") {
      out.push(...suggestedActionsFromOnboardingNavigation(t.raw));
    }
  }
  return dedupeById(out);
}

export function mergeCompleteReplySuggestedActions(
  reply: string,
  toolBatch: readonly { name: CEOToolName; raw: string }[],
): { reply: string; suggestedActions: LetoraSuggestedAction[] } {
  const stripped = stripLetoraSuggestedActionsLine(reply);
  const fromTools = mergeSuggestedActionsFromTools(toolBatch);
  const fromPaths = extractTenancyOnboardingLinksFromReply(stripped.reply);
  const mergedActions = dedupeSuggestedActionsForUi([
    ...fromTools,
    ...stripped.actions,
    ...fromPaths.actions,
  ]);
  const useCleanedPathReply = fromPaths.actions.length > 0;
  return {
    reply: useCleanedPathReply ? fromPaths.cleanedReply : stripped.reply,
    suggestedActions: mergedActions,
  };
}
