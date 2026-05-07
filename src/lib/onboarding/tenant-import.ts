import { z } from "zod";

import type { LLMRequestOptions } from "@/lib/llm/types";
import {
  type PortfolioImportRowKind,
  isLikelyUkPostcode,
  normalizeUkPostcodeSpaces,
} from "@/lib/onboarding/portfolio-import-schema";
import { isValidEmailAddress } from "@/lib/validations/email";

export type LooseTenantRow = {
  fullName: string;
  email: string | null;
  phone: string | null;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_LLM_CHARS = 28_000;

const llmPayloadSchema = z.object({
  tenants: z.array(
    z.object({
      fullName: z.string(),
      email: z.union([z.string(), z.null()]).optional(),
      phone: z.union([z.string(), z.null()]).optional(),
    }),
  ),
});

function extractJsonObject(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in model output");
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

export function normalizeLooseTenantRow(row: {
  fullName: string;
  email?: string | null;
  phone?: string | null;
}): LooseTenantRow | null {
  const fullName = row.fullName.replace(/\s+/g, " ").trim();
  if (fullName.length < 2) return null;

  const emailRaw = typeof row.email === "string" ? row.email.trim() : "";
  const email = emailRaw.length > 0 && isValidEmailAddress(emailRaw) ? emailRaw : null;

  const phoneRaw = typeof row.phone === "string" ? row.phone.replace(/\s+/g, " ").trim() : "";
  const digits = phoneRaw.replace(/[^\d+]/g, "");
  const phone = phoneRaw.length >= 5 && digits.length >= 5 ? phoneRaw : null;

  return { fullName, email, phone };
}

/** Naive CSV / TSV: header row with name + email + phone columns, or three columns without header. */
export function parseLooseTenantsFromDelimitedText(text: string): LooseTenantRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const delim = lines[0].includes("\t") && !lines[0].includes(",") ? "\t" : ",";

  function splitLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
        continue;
      }
      if ((c === delim || (delim === "\t" && c === "\t")) && !inQ) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += c;
    }
    out.push(cur.trim());
    return out.map((c) => c.replace(/^"|"$/g, ""));
  }

  const firstCells = splitLine(lines[0]).map((c) => c.toLowerCase());
  const looksLikeHeader =
    firstCells.some((c) => c.includes("name")) ||
    firstCells.some((c) => c.includes("email")) ||
    firstCells.includes("phone") ||
    firstCells.includes("mobile") ||
    firstCells.includes("tel");

  const findIdx = (...hints: string[]) => {
    for (const h of hints) {
      const i = firstCells.findIndex((cell) => cell.includes(h));
      if (i >= 0) return i;
    }
    return -1;
  };

  const rows: LooseTenantRow[] = [];

  if (looksLikeHeader) {
    const iName = findIdx("name", "tenant");
    const iEmail = findIdx("email", "e-mail");
    const iPhone = findIdx("phone", "mobile", "tel");
    if (iName < 0) return [];

    for (let li = 1; li < lines.length; li++) {
      const cells = splitLine(lines[li]);
      const name = cells[iName] ?? "";
      const email = iEmail >= 0 ? (cells[iEmail] ?? "") : "";
      const phone = iPhone >= 0 ? (cells[iPhone] ?? "") : "";
      const n = normalizeLooseTenantRow({
        fullName: name,
        email: email || null,
        phone: phone || null,
      });
      if (n) rows.push(n);
    }
    return rows;
  }

  for (const line of lines) {
    const cells = splitLine(line);
    if (cells.length === 0) continue;
    const name = cells[0] ?? "";
    const col1 = cells[1] ?? "";
    const col2 = cells[2] ?? "";
    let email: string | null = null;
    let phone: string | null = null;
    if (col1.includes("@")) {
      email = col1;
      phone = col2 || null;
    } else {
      phone = col1 || null;
      email = col2.includes("@") ? col2 : null;
    }
    const n = normalizeLooseTenantRow({ fullName: name, email, phone });
    if (n) rows.push(n);
  }

  return rows;
}

export async function extractTextFromTenantImportFile(
  buffer: Buffer,
  filename: string,
  mime: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (buffer.length > MAX_FILE_BYTES) {
    return { ok: false, error: "File is too large (max 5 MB)." };
  }

  const lower = filename.toLowerCase();
  const isCsv = lower.endsWith(".csv") || mime.includes("csv");
  const isTsv = lower.endsWith(".tsv") || mime.includes("tab-separated-values");
  const isTxt = lower.endsWith(".txt") || mime === "text/plain";
  if (isCsv || isTsv || isTxt) {
    return { ok: true, text: buffer.toString("utf8") };
  }

  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const { value, messages } = await mammoth.extractRawText({ buffer });
    if (messages?.length && !value?.trim()) {
      return { ok: false, error: "Could not read that Word document." };
    }
    return { ok: true, text: value ?? "" };
  }

  if (lower.endsWith(".pdf") || mime === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      await parser.destroy();
      return { ok: true, text: textResult.text ?? "" };
    } catch {
      return { ok: false, error: "Could not read that PDF." };
    }
  }

  return {
    ok: false,
    error: "Unsupported file type. Use CSV, TSV, TXT, PDF, or DOCX.",
  };
}

/** Lazy-loads the LLM router so importing CSV/parsing helpers does not pull providers (tests + cold paths stay key-free until this runs). */
async function invokeRunLLM(options: LLMRequestOptions) {
  const { runLLM } = await import("@/lib/llm/router");
  return runLLM(options);
}

export async function extractTenantsWithLlmFromText(documentText: string): Promise<
  { ok: true; rows: LooseTenantRow[] } | { ok: false; error: string }
> {
  const trimmed = documentText.trim();
  if (trimmed.length < 20) {
    return { ok: false, error: "Not enough text to extract tenants from." };
  }

  const slice = trimmed.length > MAX_LLM_CHARS ? trimmed.slice(0, MAX_LLM_CHARS) : trimmed;

  // We rely on runLLM to handle provider-specific key checks and fallbacks.

  const system = `You extract tenant contact rows from landlord documents and spreadsheets.
Return ONLY a JSON object (no markdown) with shape:
{"tenants":[{"fullName":"string","email":"string or null","phone":"string or null"}]}
Rules:
- fullName: required for each person (skip companies unless they are clearly the tenant contact).
- email: valid email or null if missing.
- phone: include country code if present; null if missing.
- UK context is typical.
- Do not invent emails or phone numbers.
- Maximum 50 tenants.`;

  let textOut: string;
  try {
    const res = await invokeRunLLM({
      agentName: "analytics",
      temperature: 0.1,
      maxTokens: 8192,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Extract tenants from:\n\n${slice}`,
        },
      ],
    });
    textOut = res.text;
  } catch (e) {
    console.error("[extractTenantsWithLlmFromText]", e);
    return { ok: false, error: "AI could not process this file. Try CSV or add tenants manually." };
  }

  let parsed: unknown;
  try {
    parsed = extractJsonObject(textOut);
  } catch {
    return { ok: false, error: "Could not parse AI output. Try a simpler file or CSV." };
  }

  const safe = llmPayloadSchema.safeParse(parsed);
  if (!safe.success) {
    return { ok: false, error: "AI returned an unexpected shape. Try CSV export instead." };
  }

  const rows: LooseTenantRow[] = [];
  for (const r of safe.data.tenants) {
    const n = normalizeLooseTenantRow({
      fullName: r.fullName,
      email: r.email ?? null,
      phone: r.phone ?? null,
    });
    if (n) rows.push(n);
  }

  if (rows.length === 0) {
    return { ok: false, error: "No tenants found in the document." };
  }

  return { ok: true, rows: rows.slice(0, 50) };
}

/* ─────────────────────────────────────────────────────────────────────────
 * Batch onboarding import (combined CSV: property + tenant + tenancy per row)
 * ────────────────────────────────────────────────────────────────────────── */

/** One CSV row = one portfolio line: property + optional tenant + tenancy (or property-only vacant). */
export type BatchOnboardingRow = {
  /** vacant: property only. occupied: live tenancy — no Letora onboarding agent. onboarding: pre-move-in — agent runs. */
  rowKind: PortfolioImportRowKind;
  propertyAddress: string;
  /** Optional portfolio label merged into saved address ("Name — line1"). */
  propertyDisplayName: string | null;
  city: string | null;
  postcode: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  tenantFullName: string;
  tenantEmail: string;
  tenantPhone: string | null;
  monthlyRent: number;
  /** Calendar day-of-month rent is due for seeded instalments; optional. */
  rentDueDay: number | null;
  startDate: string;
  moveInDate: string | null;
  endDate: string | null;
  depositAmount: number | null;
  /** Maps to DB `tenancies.status`: active | ended | pending. */
  tenancyStatusDb: "active" | "ended" | "pending";
  /** Seeds first instalment behaviour (arrears = past due + overdue marker). */
  rentPosition: "clear" | "arrears";
  notes: string | null;
  /** Populated by the parser — blocks committing this row until fixed. */
  rowErrors: string[];
  /** Non-blocking UX messages (missing postcode, onboarding hint, stray columns on vacant, etc.). */
  rowWarnings: string[];
};

const BATCH_MAX_ROWS = 100;

const batchLlmPayloadSchema = z.object({
  rows: z.array(
    z.object({
      rowKind: z.union([z.string(), z.null()]).optional(),
      propertyAddress: z.string(),
      propertyDisplayName: z.union([z.string(), z.null()]).optional(),
      city: z.union([z.string(), z.null()]).optional(),
      postcode: z.union([z.string(), z.null()]).optional(),
      propertyType: z.union([z.string(), z.null()]).optional(),
      bedrooms: z.union([z.number(), z.string(), z.null()]).optional(),
      bathrooms: z.union([z.number(), z.string(), z.null()]).optional(),
      tenantFullName: z.union([z.string(), z.null()]).optional(),
      tenantEmail: z.union([z.string(), z.null()]).optional(),
      tenantPhone: z.union([z.string(), z.null()]).optional(),
      monthlyRent: z.union([z.number(), z.string(), z.null()]).optional(),
      rentDueDay: z.union([z.number(), z.string(), z.null()]).optional(),
      startDate: z.union([z.string(), z.null()]).optional(),
      moveInDate: z.union([z.string(), z.null()]).optional(),
      endDate: z.union([z.string(), z.null()]).optional(),
      depositAmount: z.union([z.number(), z.string(), z.null()]).optional(),
      tenancyStatus: z.union([z.string(), z.null()]).optional(),
      rentPosition: z.union([z.string(), z.null()]).optional(),
      notes: z.union([z.string(), z.null()]).optional(),
    }),
  ),
});

function cellToIsoDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const ukMatch = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (ukMatch) {
    const [, dd, mm, yy] = ukMatch;
    const year = yy!.length === 2 ? `20${yy}` : yy!.padStart(4, "0");
    const month = mm!.padStart(2, "0");
    const day = dd!.padStart(2, "0");
    const n = Number(year);
    if (n < 1900 || n > 2100) return null;
    return `${year}-${month}-${day}`;
  }

  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) {
    return iso.toISOString().slice(0, 10);
  }
  return null;
}

function cellToMoneyAllowZero(raw: string): number | null {
  const cleaned = raw
    .replace(/[£€$,\s]/g, "")
    .replace(/pcm|p\/m|per\s*month/gi, "")
    .trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (Number.isNaN(n) || !Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Positive amount only — use for tenancy rent when occupancy requires >0. */
function cellToMoney(raw: string): number | null {
  const n = cellToMoneyAllowZero(raw);
  if (n == null || n <= 0) return null;
  return n;
}

function parseRowKindCell(raw: string | null | undefined): PortfolioImportRowKind {
  const s = (raw ?? "").trim().toLowerCase();
  if (["vacant", "empty", "void", "unoccupied"].includes(s)) return "vacant";
  if (["onboarding", "pipeline", "pre_move_in", "pre-move-in"].includes(s)) return "onboarding";
  return "occupied";
}

function parseOptionalIntBounded(raw: string | null | undefined, max: number): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return n;
}

function parseRentDueDayCell(raw: string | null | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1 || n > 31) return null;
  return n;
}

/** Rent/account health words belong in `rent_position`, not `tenancy_status` — map to active tenancy. */
function isTenancyStatusRentAccountOnly(raw: string | null | undefined): boolean {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return false;
  return ["arrears", "arrear", "in arrears", "behind", "late", "overdue"].some(
    (k) => s === k || s.includes(k),
  );
}

function parseTenancyStatusDb(raw: string | null | undefined): {
  status: "active" | "ended" | "pending";
  unknown: boolean;
} {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return { status: "active", unknown: false };
  if (isTenancyStatusRentAccountOnly(raw)) return { status: "active", unknown: false };
  if (["active", "live", "occupied", "current"].includes(s))
    return { status: "active", unknown: false };
  if (["ended", "past", "former", "expired", "terminated"].includes(s))
    return { status: "ended", unknown: false };
  if (["pending", "upcoming", "scheduled", "future", "onboarding"].includes(s))
    return { status: "pending", unknown: false };
  return { status: "active", unknown: true };
}

function parseRentPosition(raw: string | null | undefined): "clear" | "arrears" {
  const s = (raw ?? "").trim().toLowerCase();
  if (["arrears", "arrears_demo", "behind", "late", "overdue"].includes(s)) return "arrears";
  return "clear";
}

function buildStoredPropertyAddress(displayName: string | null, streetLine: string): string {
  const line = streetLine.trim();
  const name = (displayName ?? "").trim();
  if (name.length > 0) return `${name} — ${line}`;
  return line;
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === delim && !inQ) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out.map((c) => c.replace(/^"|"$/g, ""));
}

function findHeaderIdx(headers: string[], ...hints: string[]): number {
  for (const h of hints) {
    const i = headers.findIndex((cell) => cell === h);
    if (i >= 0) return i;
  }
  for (const h of hints) {
    const i = headers.findIndex((cell) => cell.includes(h));
    if (i >= 0) return i;
  }
  return -1;
}

function addDaysIsoLocal(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Normalizes one raw cell-map into a BatchOnboardingRow with errors (blocking) vs warnings (informational).
 * `propertyAddress` is always the street line only — optional `propertyDisplayName` is prefixed on insert by the importer.
 */
export function buildStoredAddressForImport(displayName: string | null, streetLine: string): string {
  return buildStoredPropertyAddress(displayName, streetLine);
}

/**
 * Normalizes one raw cell-map into a BatchOnboardingRow with per-row errors.
 * Always returns a row (never null) so the UI can show "fix this one" next to errors.
 */
export function normalizeBatchOnboardingRow(raw: {
  rowKind?: string | null;
  propertyAddress?: string | null;
  propertyDisplayName?: string | null;
  city?: string | null;
  postcode?: string | null;
  propertyType?: string | null;
  bedrooms?: string | number | null;
  bathrooms?: string | number | null;
  tenantFullName?: string | null;
  tenantEmail?: string | null;
  tenantPhone?: string | null;
  monthlyRent?: number | string | null;
  rentDueDay?: string | number | null;
  startDate?: string | null;
  moveInDate?: string | null;
  endDate?: string | null;
  depositAmount?: number | string | null;
  tenancyStatus?: string | null;
  rentPosition?: string | null;
  notes?: string | null;
}): BatchOnboardingRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rowKind = parseRowKindCell(raw.rowKind);

  const propertyAddress = (raw.propertyAddress ?? "").replace(/\s+/g, " ").trim();
  if (propertyAddress.length < 3) {
    errors.push("Property street/address line is required (at least a few characters).");
  }

  const propertyDisplayName = (raw.propertyDisplayName ?? "").replace(/\s+/g, " ").trim() || null;
  const city = (raw.city ?? "").trim() || null;
  let postcode: string | null = null;
  const postcodeInput = (raw.postcode ?? "").trim();
  if (postcodeInput.length > 0) {
    const norm = normalizeUkPostcodeSpaces(postcodeInput);
    if (!isLikelyUkPostcode(norm)) {
      errors.push(`Postcode "${postcodeInput}" does not look like a valid UK postcode.`);
    } else {
      postcode = norm;
    }
  } else {
    warnings.push(
      "Postcode is missing — matching uses address + city; add a postcode for cleaner deduplication.",
    );
  }

  const propertyType = (raw.propertyType ?? "").replace(/\s+/g, " ").trim() || null;

  const bedroomCell = typeof raw.bedrooms === "number" ? String(raw.bedrooms) : (raw.bedrooms ?? "");
  const bathroomCell = typeof raw.bathrooms === "number" ? String(raw.bathrooms) : (raw.bathrooms ?? "");
  let bedrooms = parseOptionalIntBounded(bedroomCell, 30);
  let bathrooms = parseOptionalIntBounded(bathroomCell, 20);
  if (bedroomCell.trim() && bedrooms == null) {
    warnings.push('Could not read "bedrooms" — leave blank or use a whole number (0–30).');
  }
  if (bathroomCell.trim() && bathrooms == null) {
    warnings.push('Could not read "bathrooms" — leave blank or use a whole number (0–20).');
  }

  let tenantFullName = (raw.tenantFullName ?? "").replace(/\s+/g, " ").trim();
  const emailRaw = (raw.tenantEmail ?? "").trim();
  let tenantEmail = emailRaw.length > 0 && isValidEmailAddress(emailRaw) ? emailRaw : "";

  const phoneRaw = (raw.tenantPhone ?? "").replace(/\s+/g, " ").trim();
  const phoneDigits = phoneRaw.replace(/[^\d+]/g, "");
  const tenantPhone = phoneRaw.length >= 5 && phoneDigits.length >= 5 ? phoneRaw : null;

  const rentDueDayRaw = typeof raw.rentDueDay === "number" ? String(raw.rentDueDay) : (raw.rentDueDay ?? "");
  let rentDueDay = parseRentDueDayCell(rentDueDayRaw);
  if (rentDueDayRaw.trim() && rentDueDay == null) {
    warnings.push('Could not read "rent_due_day" — use a whole number 1–31 or leave blank.');
  }

  let monthlyRent = 0;
  const rentCell =
    typeof raw.monthlyRent === "number"
      ? raw.monthlyRent
      : typeof raw.monthlyRent === "string"
        ? raw.monthlyRent
        : null;

  let startDate = "";
  let moveInDate: string | null = null;
  let endDate: string | null = null;

  const moveInRaw = (raw.moveInDate ?? "").trim();
  const endRaw = (raw.endDate ?? "").trim();

  let depositAmount: number | null = null;
  if (raw.depositAmount != null) {
    const d =
      typeof raw.depositAmount === "number"
        ? raw.depositAmount
        : cellToMoneyAllowZero(String(raw.depositAmount));
    if (d != null && d >= 0) depositAmount = d;
  }

  const { status: tenancyStatusDb, unknown: tenancyStatusUnknown } = parseTenancyStatusDb(
    raw.tenancyStatus,
  );
  let rentPosition = parseRentPosition(raw.rentPosition);
  if (isTenancyStatusRentAccountOnly(raw.tenancyStatus)) {
    rentPosition = "arrears";
    warnings.push(
      `Tenancy status "${(raw.tenancyStatus ?? "").trim()}" was read as arrears/account state — tenancy stays active; rent tracker uses arrears.`,
    );
  }
  if (tenancyStatusUnknown) {
    warnings.push(
      `Tenancy status "${(raw.tenancyStatus ?? "").trim()}" was not recognised — defaulting to active.`,
    );
  }
  const notes = (raw.notes ?? "").replace(/\s+/g, " ").trim() || null;

  if (rowKind === "vacant") {
    if (tenantFullName.length >= 2 || emailRaw.length > 0) {
      warnings.push("Vacant row: tenant fields are ignored because no tenancy is created.");
    }
    tenantFullName = "";
    tenantEmail = "";

    const rentParsed =
      rentCell === null ? null : typeof rentCell === "number" ? rentCell : cellToMoneyAllowZero(rentCell);
    if (rentParsed != null && rentParsed >= 0) monthlyRent = rentParsed;
    else monthlyRent = 0;

    if (rentParsed == null && typeof rentCell === "string" && rentCell.trim().length > 0) {
      errors.push(`Could not parse target rent "${rentCell}". Use a number (0 allowed for vacant units).`);
    }

    warnings.push(
      "Vacant import creates or updates portfolio property metadata only — no tenant, tenancy, or rent schedule.",
    );
  } else {
    /* occupied / onboarding */
    if (rowKind === "onboarding") {
      warnings.push(
        "Marked as onboarding: Letora runs the onboarding agent after import unless the tenancy is ended.",
      );
    }

    if (tenantFullName.length < 2) errors.push("Tenant full name is required for occupied and onboarding rows.");
    if (!tenantEmail) errors.push('Tenant email is required (or fix the spelling after the "@" symbol).');

    const rentNumeric =
      rentCell === null
        ? null
        : typeof rentCell === "number"
          ? rentCell > 0
            ? rentCell
            : null
          : cellToMoney(String(rentCell));
    if (rentNumeric == null) {
      errors.push("Monthly rent must be greater than £0 for rows with a tenancy.");
    } else {
      monthlyRent = rentNumeric;
    }

    const startRaw = (raw.startDate ?? "").trim();
    const parsedStart = startRaw ? cellToIsoDate(startRaw) : null;
    if (!parsedStart) {
      errors.push(
        startRaw.length === 0
          ? "Tenancy start date is required — use YYYY-MM-DD or DD/MM/YYYY."
          : `Start date "${startRaw}" is not recognised — use YYYY-MM-DD or DD/MM/YYYY.`,
      );
    } else {
      startDate = parsedStart;
    }

    moveInDate = moveInRaw ? cellToIsoDate(moveInRaw) : null;
    endDate = endRaw ? cellToIsoDate(endRaw) : null;

    if (moveInRaw && !moveInDate) {
      warnings.push("Move-in date could not be read — tenancy will default move-in to the start date.");
    }
    if (endRaw && !endDate) {
      errors.push("End date format was not recognised — use YYYY-MM-DD or DD/MM/YYYY.");
    }

    if (startDate && !endDate && !errors.some((e) => e.toLowerCase().includes("start date"))) {
      endDate = addDaysIsoLocal(startDate, 365);
    }

    if (tenancyStatusDb === "ended" && rentPosition === "arrears") {
      warnings.push(
        '"Rent position" arrears applies to ended tenancies only for demo labelling — you may archive these payments manually.',
      );
    }
  }

  const row: BatchOnboardingRow = {
    rowKind,
    propertyAddress,
    propertyDisplayName,
    city,
    postcode,
    propertyType,
    bedrooms,
    bathrooms,
    tenantFullName,
    tenantEmail,
    tenantPhone,
    monthlyRent,
    rentDueDay,
    startDate,
    moveInDate,
    endDate,
    depositAmount,
    tenancyStatusDb,
    rentPosition,
    notes,
    rowErrors: errors,
    rowWarnings: warnings,
  };

  return pruneRowWarningsAgainstErrors(row);
}

/** When postcode is erroneous, suppress the "missing postcode" warning. */
function pruneRowWarningsAgainstErrors(row: BatchOnboardingRow): BatchOnboardingRow {
  const errLower = row.rowErrors.map((e) => e.toLowerCase());
  if (errLower.some((e) => e.includes("does not look like a valid uk postcode"))) {
    row.rowWarnings = row.rowWarnings.filter((w) => !w.includes("Postcode is missing"));
  }
  return row;
}

/**
 * Spreadsheet exports often leave `row_kind` empty on property-only rows (with or without a `row_kind` column).
 * When the cell is empty, classify as vacant only when there are no tenancy/tenant signals; otherwise defer to
 * `parseRowKindCell` for legacy rows that omit `row_kind` but supply tenant_email / rent / start_date.
 *
 * IMPORTANT: Do not shortcut when `row_kind` is absent — the old `return rowKindCell` bypass meant every
 * legacy header-only/no-tenant-data line became "occupied".
 */
function inferRowKindCellWhenColumnPresent(
  _hasRowKindColumn: boolean,
  rowKindCell: string,
  tenantNameCell: string,
  tenantEmailCell: string,
  rentCellRaw: string | number,
  startRawStr: string,
): string {
  if ((rowKindCell ?? "").trim().length > 0) return rowKindCell;
  const nameOk = (tenantNameCell ?? "").replace(/\s+/g, " ").trim().length >= 2;
  const emailOk = (tenantEmailCell ?? "").trim().length > 0;
  let rentOk = false;
  if (typeof rentCellRaw === "number") {
    rentOk = rentCellRaw > 0;
  } else {
    const rs = String(rentCellRaw ?? "").trim();
    if (rs.length > 0) {
      const n = cellToMoneyAllowZero(rs);
      rentOk = n != null && n > 0;
    }
  }
  const startOk = (startRawStr ?? "").trim().length > 0;
  if (!nameOk && !emailOk && !rentOk && !startOk) return "vacant";
  return rowKindCell;
}

export type ParsedBatchCsvLevel = "ok" | "no_data" | "header_error";

export type ParseBatchOnboardingCsvResult = {
  parseLevel: ParsedBatchCsvLevel;
  rows: BatchOnboardingRow[];
  missingRequiredHeaders?: string[];
};

/**
 * Parses a combined-CSV / TSV where each row is one portfolio line.
 *
 * Accepted header aliases (case-insensitive, partial match allowed) include:
 * row_kind · occupancy · import_type
 * property_name · property_display_name
 * property_type · bedrooms · bathrooms · rent_due_day · tenancy_status · rent_position · notes
 * legacy occupant workflow columns unchanged.
 */
export function parseBatchOnboardingCsvWithMeta(text: string): ParseBatchOnboardingCsvResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return { parseLevel: "no_data", rows: [] };

  const delim = lines[0]!.includes("\t") && !lines[0]!.includes(",") ? "\t" : ",";
  const headers = splitCsvLine(lines[0]!, delim).map((c) => c.toLowerCase());

  const iRowKind = findHeaderIdx(headers, "row_kind", "import_type", "occupancy");
  const iAddress = findHeaderIdx(headers, "property_address", "property line", "property", "address");
  const iCity = findHeaderIdx(headers, "city", "town");
  const iPostcode = findHeaderIdx(headers, "postcode", "post code", "zip");
  const iPropName = findHeaderIdx(headers, "property_name", "property display name");
  const iPropType = findHeaderIdx(headers, "property_type");
  const iBed = findHeaderIdx(headers, "bedrooms");
  const iBath = findHeaderIdx(headers, "bathrooms");
  const iName = findHeaderIdx(
    headers,
    "tenant_name",
    "tenant full name",
    "tenant name",
    "full name",
    "full_name",
    "tenant",
    "name",
  );
  const iEmail = findHeaderIdx(headers, "tenant_email", "email", "e-mail");
  const iPhone = findHeaderIdx(headers, "tenant_phone", "phone", "mobile", "tel");
  const iRent = findHeaderIdx(headers, "monthly_rent", "monthly rent", "rent_pcm", "rent");
  const iDueDay = findHeaderIdx(headers, "rent_due_day", "rent due day");
  const iStart = findHeaderIdx(
    headers,
    "start_date",
    "start date",
    "lease start",
    "tenancy start",
    "start",
  );
  const iMoveIn = findHeaderIdx(headers, "move_in_date", "move in date", "move in", "movein");
  const iEnd = findHeaderIdx(headers, "end_date", "end date", "lease end", "tenancy end");
  const iDeposit = findHeaderIdx(headers, "deposit_amount", "deposit");
  const iTStatus = findHeaderIdx(headers, "tenancy_status");
  const iRentPos = findHeaderIdx(headers, "rent_position", "rent_health");
  const iNotes = findHeaderIdx(headers, "notes", "comment", "comments");

  const hasRowKindColumn = iRowKind >= 0;

  if (iAddress < 0) {
    return {
      parseLevel: "header_error",
      rows: [],
      missingRequiredHeaders: ["property_address (or alias: property / address)"],
    };
  }

  if (!hasRowKindColumn) {
    const missing: string[] = [];
    if (iName < 0) missing.push("tenant_name");
    if (iEmail < 0) missing.push("tenant_email");
    if (iRent < 0) missing.push("monthly_rent");
    if (iStart < 0) missing.push("start_date");
    if (missing.length > 0) {
      return {
        parseLevel: "header_error",
        rows: [],
        missingRequiredHeaders: missing,
      };
    }
  }

  const rows: BatchOnboardingRow[] = [];

  for (let li = 1; li < lines.length && rows.length < BATCH_MAX_ROWS; li++) {
    const cells = splitCsvLine(lines[li]!, delim);
    const rowKindCell = iRowKind >= 0 ? (cells[iRowKind] ?? "") : "";

    const propertyAddressCell = cells[iAddress] ?? "";
    let tenantNameCell = "";
    let tenantEmailCell = "";
    let rentCellRaw = "";
    let startRawStr = "";

    if (!hasRowKindColumn) {
      tenantNameCell = cells[iName] ?? "";
      tenantEmailCell = cells[iEmail] ?? "";
      rentCellRaw = cells[iRent] ?? "";
      startRawStr = cells[iStart] ?? "";
    } else {
      tenantNameCell = iName >= 0 ? (cells[iName] ?? "") : "";
      tenantEmailCell = iEmail >= 0 ? (cells[iEmail] ?? "") : "";
      rentCellRaw = iRent >= 0 ? (cells[iRent] ?? "") : "";
      startRawStr = iStart >= 0 ? (cells[iStart] ?? "") : "";
    }

    const rowKindForRow = inferRowKindCellWhenColumnPresent(
      hasRowKindColumn,
      rowKindCell,
      tenantNameCell,
      tenantEmailCell,
      rentCellRaw,
      startRawStr,
    );

    const rk = parseRowKindCell(rowKindForRow);
    if (
      hasRowKindColumn &&
      (rk === "occupied" || rk === "onboarding") &&
      (iName < 0 || iEmail < 0 || iRent < 0 || iStart < 0)
    ) {
      const row = normalizeBatchOnboardingRow({
        rowKind: rowKindForRow,
        propertyAddress: propertyAddressCell,
      });
      row.rowErrors.unshift(
        "Occupied or onboarding rows need tenant_name, tenant_email, monthly_rent, and start_date columns — add them to the header row or paste the latest template.",
      );
      rows.push(row);
      continue;
    }

    const row = normalizeBatchOnboardingRow({
      rowKind: rowKindForRow,
      propertyAddress: propertyAddressCell,
      propertyDisplayName: iPropName >= 0 ? (cells[iPropName] ?? null) : null,
      city: iCity >= 0 ? (cells[iCity] ?? null) : null,
      postcode: iPostcode >= 0 ? (cells[iPostcode] ?? null) : null,
      propertyType: iPropType >= 0 ? (cells[iPropType] ?? null) : null,
      bedrooms: iBed >= 0 ? (cells[iBed] ?? null) : null,
      bathrooms: iBath >= 0 ? (cells[iBath] ?? null) : null,
      tenantFullName: tenantNameCell,
      tenantEmail: tenantEmailCell,
      tenantPhone: iPhone >= 0 ? (cells[iPhone] ?? null) : null,
      monthlyRent: rentCellRaw,
      rentDueDay: iDueDay >= 0 ? (cells[iDueDay] ?? null) : null,
      startDate: startRawStr,
      moveInDate: iMoveIn >= 0 ? (cells[iMoveIn] ?? null) : null,
      endDate: iEnd >= 0 ? (cells[iEnd] ?? null) : null,
      depositAmount: iDeposit >= 0 ? (cells[iDeposit] ?? null) : null,
      tenancyStatus: iTStatus >= 0 ? (cells[iTStatus] ?? null) : null,
      rentPosition: iRentPos >= 0 ? (cells[iRentPos] ?? null) : null,
      notes: iNotes >= 0 ? (cells[iNotes] ?? null) : null,
    });

    rows.push(row);
  }

  return { parseLevel: "ok", rows };
}

/** @deprecated Prefer parseBatchOnboardingCsvWithMeta for diagnostic metadata. */
export function parseBatchOnboardingCsv(text: string): BatchOnboardingRow[] {
  return parseBatchOnboardingCsvWithMeta(text).rows;
}

/** How the server should behave after a CSV/TSV parse attempt (structured vs unstructured upload). */
export type PortfolioCsvParseDecision =
  | { kind: "ready"; rows: BatchOnboardingRow[] }
  | { kind: "structured_fail"; error: string }
  | { kind: "try_llm"; reason: string };

/**
 * Decide whether CSV text yields rows, fails fast with a plain-language error,
 * or should fall through to unstructured LLM extraction.
 */
export function decidePortfolioCsvParse(
  trimmedText: string,
  structuredInput: boolean,
): PortfolioCsvParseDecision {
  const meta = parseBatchOnboardingCsvWithMeta(trimmedText);
  if (meta.parseLevel === "no_data") {
    const msg =
      structuredInput && trimmedText.length > 0
        ? "Add a header row and at least one data row underneath (UTF-8 CSV or TSV)."
        : trimmedText.trim().length === 0
          ? "Paste or upload a file with usable text."
          : "";
    return structuredInput
      ? {
          kind: "structured_fail",
          error:
            msg || "CSV could not be read (need a header plus data rows). Check for empty rows or wrong delimiter.",
        }
      : { kind: "try_llm", reason: "tabular_parse_no_data" };
  }
  if (meta.parseLevel === "header_error") {
    const missing = meta.missingRequiredHeaders?.length
      ? `Missing required column(s): ${meta.missingRequiredHeaders.join(", ")}.`
      : "The header row is missing columns Letora cannot infer.";
    const hint =
      " Compare with /templates/portfolio-import-sample.csv or add row_kind (vacant | occupied | onboarding) plus property_address.";
    const error = structuredInput ? `${missing}${hint}` : missing;
    return structuredInput ? { kind: "structured_fail", error } : { kind: "try_llm", reason: "tabular_parse_header_error" };
  }
  if (meta.rows.length === 0) {
    return structuredInput
      ? {
          kind: "structured_fail",
          error:
            "Found a header row but no usable data rows. Remove blank lines between header and rows or confirm the delimiter is comma or tab.",
        }
      : { kind: "try_llm", reason: "tabular_parse_zero_rows" };
  }
  return { kind: "ready", rows: meta.rows };
}

/**
 * LLM-assisted extraction of BatchOnboardingRow[] from unstructured text
 * (PDF / DOCX / messy spreadsheets). Returns normalized rows with per-row
 * errors — callers should show them in a preview table for fix-up.
 */
export async function extractBatchOnboardingRowsWithLlmFromText(documentText: string): Promise<
  { ok: true; rows: BatchOnboardingRow[] } | { ok: false; error: string }
> {
  const trimmed = documentText.trim();
  if (trimmed.length < 20) {
    return { ok: false, error: "Not enough text to extract onboarding rows from." };
  }

  const slice = trimmed.length > MAX_LLM_CHARS ? trimmed.slice(0, MAX_LLM_CHARS) : trimmed;

  // We rely on runLLM to handle provider-specific key checks and fallbacks.

  const system = `You extract landlord onboarding rows from documents and spreadsheets.
Return ONLY a JSON object (no markdown) with shape:
{"rows":[{
  "propertyAddress":"string",
  "city":"string or null",
  "postcode":"string or null",
  "tenantFullName":"string",
  "tenantEmail":"string or null",
  "tenantPhone":"string or null",
  "monthlyRent":"number or null",
  "startDate":"YYYY-MM-DD or null",
  "moveInDate":"YYYY-MM-DD or null",
  "endDate":"YYYY-MM-DD or null",
  "depositAmount":"number or null"
}]}
Rules:
- One row per tenant occupying one property.
- If one property has multiple tenants, emit one row per tenant (address repeats).
- Do not invent emails, phone numbers, rent, or dates. If missing, use null.
- UK context: currencies may be £1,250 / £1250 pcm — return the numeric value only.
- Dates may be in DD/MM/YYYY or DD.MM.YYYY — convert to YYYY-MM-DD. If unclear, use null.
- Maximum ${BATCH_MAX_ROWS} rows.`;

  let textOut: string;
  try {
    const res = await invokeRunLLM({
      agentName: "analytics",
      temperature: 0.1,
      maxTokens: 8192,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Extract onboarding rows from:\n\n${slice}`,
        },
      ],
    });
    textOut = res.text;
  } catch (e) {
    console.error("[extractBatchOnboardingRowsWithLlmFromText]", e);
    return { ok: false, error: "AI could not process this file. Try a CSV with headers instead." };
  }

  let parsed: unknown;
  try {
    parsed = extractJsonObject(textOut);
  } catch {
    return { ok: false, error: "Could not parse AI output. Try a CSV instead." };
  }

  const safe = batchLlmPayloadSchema.safeParse(parsed);
  if (!safe.success) {
    return { ok: false, error: "AI returned an unexpected shape. Try a CSV instead." };
  }

  const rows: BatchOnboardingRow[] = [];
  for (const r of safe.data.rows) {
    rows.push(
      normalizeBatchOnboardingRow({
        propertyAddress: r.propertyAddress,
        city: r.city ?? null,
        postcode: r.postcode ?? null,
        tenantFullName: r.tenantFullName,
        tenantEmail: r.tenantEmail ?? null,
        tenantPhone: r.tenantPhone ?? null,
        monthlyRent:
          typeof r.monthlyRent === "number"
            ? r.monthlyRent
            : typeof r.monthlyRent === "string"
              ? r.monthlyRent
              : null,
        startDate: r.startDate ?? null,
        moveInDate: r.moveInDate ?? null,
        endDate: r.endDate ?? null,
        depositAmount:
          typeof r.depositAmount === "number"
            ? r.depositAmount
            : typeof r.depositAmount === "string"
              ? r.depositAmount
              : null,
      }),
    );
  }

  if (rows.length === 0) {
    return { ok: false, error: "No onboarding rows found in the document." };
  }

  return { ok: true, rows: rows.slice(0, BATCH_MAX_ROWS) };
}
