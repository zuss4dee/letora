import { z } from "zod";

import { runLLM } from "@/lib/llm/router";
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
  const isTxt = lower.endsWith(".txt") || mime === "text/plain";
  if (isCsv || isTxt) {
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
    error: "Unsupported file type. Use CSV, TXT, PDF, or DOCX.",
  };
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
    const res = await runLLM({
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

/** One CSV row = one onboarding: property + tenant + tenancy fields combined. */
export type BatchOnboardingRow = {
  propertyAddress: string;
  city: string | null;
  postcode: string | null;
  tenantFullName: string;
  tenantEmail: string;
  tenantPhone: string | null;
  monthlyRent: number;
  startDate: string;
  moveInDate: string | null;
  endDate: string | null;
  depositAmount: number | null;
  /** Populated by the parser when required fields are missing or malformed. */
  rowErrors: string[];
};

const BATCH_MAX_ROWS = 100;

const batchLlmPayloadSchema = z.object({
  rows: z.array(
    z.object({
      propertyAddress: z.string(),
      city: z.union([z.string(), z.null()]).optional(),
      postcode: z.union([z.string(), z.null()]).optional(),
      tenantFullName: z.string(),
      tenantEmail: z.union([z.string(), z.null()]).optional(),
      tenantPhone: z.union([z.string(), z.null()]).optional(),
      monthlyRent: z.union([z.number(), z.string(), z.null()]).optional(),
      startDate: z.union([z.string(), z.null()]).optional(),
      moveInDate: z.union([z.string(), z.null()]).optional(),
      endDate: z.union([z.string(), z.null()]).optional(),
      depositAmount: z.union([z.number(), z.string(), z.null()]).optional(),
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

function cellToMoney(raw: string): number | null {
  const cleaned = raw
    .replace(/[£€$,\s]/g, "")
    .replace(/pcm|p\/m|per\s*month/gi, "")
    .trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (Number.isNaN(n) || !Number.isFinite(n) || n < 0) return null;
  return n;
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
 * Normalizes one raw cell-map into a BatchOnboardingRow with per-row errors.
 * Always returns a row (never null) so the UI can show "fix this one" next to errors.
 */
export function normalizeBatchOnboardingRow(raw: {
  propertyAddress?: string | null;
  city?: string | null;
  postcode?: string | null;
  tenantFullName?: string | null;
  tenantEmail?: string | null;
  tenantPhone?: string | null;
  monthlyRent?: number | string | null;
  startDate?: string | null;
  moveInDate?: string | null;
  endDate?: string | null;
  depositAmount?: number | string | null;
}): BatchOnboardingRow {
  const errors: string[] = [];

  const propertyAddress = (raw.propertyAddress ?? "").replace(/\s+/g, " ").trim();
  if (propertyAddress.length < 3) errors.push("Property address is required");

  const city = (raw.city ?? "").trim() || null;
  const postcode = (raw.postcode ?? "").trim().toUpperCase() || null;

  const tenantFullName = (raw.tenantFullName ?? "").replace(/\s+/g, " ").trim();
  if (tenantFullName.length < 2) errors.push("Tenant full name is required");

  const emailRaw = (raw.tenantEmail ?? "").trim();
  const tenantEmail = emailRaw.length > 0 && isValidEmailAddress(emailRaw) ? emailRaw : "";
  if (!tenantEmail) errors.push("Tenant email is required");

  const phoneRaw = (raw.tenantPhone ?? "").replace(/\s+/g, " ").trim();
  const phoneDigits = phoneRaw.replace(/[^\d+]/g, "");
  const tenantPhone = phoneRaw.length >= 5 && phoneDigits.length >= 5 ? phoneRaw : null;

  let monthlyRent = 0;
  const rentCell =
    typeof raw.monthlyRent === "number"
      ? raw.monthlyRent
      : typeof raw.monthlyRent === "string"
        ? cellToMoney(raw.monthlyRent)
        : null;
  if (rentCell == null || rentCell <= 0) {
    errors.push("Monthly rent is required and must be greater than 0");
  } else {
    monthlyRent = rentCell;
  }

  const startRaw = (raw.startDate ?? "").trim();
  const startDate = startRaw ? cellToIsoDate(startRaw) : null;
  if (!startDate) errors.push("Start date is required (YYYY-MM-DD or DD/MM/YYYY)");

  const moveInRaw = (raw.moveInDate ?? "").trim();
  const moveInDate = moveInRaw ? cellToIsoDate(moveInRaw) : null;

  const endRaw = (raw.endDate ?? "").trim();
  let endDate = endRaw ? cellToIsoDate(endRaw) : null;
  if (!endDate && startDate) {
    endDate = addDaysIsoLocal(startDate, 365);
  }

  let depositAmount: number | null = null;
  if (raw.depositAmount != null) {
    const d =
      typeof raw.depositAmount === "number"
        ? raw.depositAmount
        : cellToMoney(String(raw.depositAmount));
    if (d != null && d >= 0) depositAmount = d;
  }

  return {
    propertyAddress,
    city,
    postcode,
    tenantFullName,
    tenantEmail,
    tenantPhone,
    monthlyRent,
    startDate: startDate ?? "",
    moveInDate: moveInDate ?? null,
    endDate,
    depositAmount,
    rowErrors: errors,
  };
}

/**
 * Parses a combined-CSV / TSV where each row is one onboarding
 * (property + tenant + tenancy fields in one row). Header row is required
 * so the parser can tolerate missing optional columns gracefully.
 *
 * Accepted header aliases (case-insensitive, partial match allowed):
 *   propertyAddress: "property", "address", "property_address"
 *   city:            "city", "town"
 *   postcode:        "postcode", "zip"
 *   tenantFullName:  "tenant", "tenant name", "full name", "name"
 *   tenantEmail:     "email"
 *   tenantPhone:     "phone", "mobile", "tel"
 *   monthlyRent:     "rent", "monthly_rent", "monthly rent"
 *   startDate:       "start", "start_date", "start date", "lease start"
 *   moveInDate:      "move_in", "move in", "movein"
 *   endDate:         "end_date", "end date", "lease end"
 *   depositAmount:   "deposit"
 */
export function parseBatchOnboardingCsv(text: string): BatchOnboardingRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const delim = lines[0]!.includes("\t") && !lines[0]!.includes(",") ? "\t" : ",";
  const headers = splitCsvLine(lines[0]!, delim).map((c) => c.toLowerCase());

  const iAddress = findHeaderIdx(headers, "property_address", "property", "address");
  const iCity = findHeaderIdx(headers, "city", "town");
  const iPostcode = findHeaderIdx(headers, "postcode", "post code", "zip");
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
  const iRent = findHeaderIdx(
    headers,
    "monthly_rent",
    "monthly rent",
    "rent_pcm",
    "rent",
  );
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

  if (iAddress < 0 || iName < 0 || iEmail < 0 || iRent < 0 || iStart < 0) {
    return [];
  }

  const rows: BatchOnboardingRow[] = [];
  for (let li = 1; li < lines.length && rows.length < BATCH_MAX_ROWS; li++) {
    const cells = splitCsvLine(lines[li]!, delim);
    const row = normalizeBatchOnboardingRow({
      propertyAddress: cells[iAddress] ?? "",
      city: iCity >= 0 ? (cells[iCity] ?? null) : null,
      postcode: iPostcode >= 0 ? (cells[iPostcode] ?? null) : null,
      tenantFullName: cells[iName] ?? "",
      tenantEmail: cells[iEmail] ?? "",
      tenantPhone: iPhone >= 0 ? (cells[iPhone] ?? null) : null,
      monthlyRent: cells[iRent] ?? "",
      startDate: cells[iStart] ?? "",
      moveInDate: iMoveIn >= 0 ? (cells[iMoveIn] ?? null) : null,
      endDate: iEnd >= 0 ? (cells[iEnd] ?? null) : null,
      depositAmount: iDeposit >= 0 ? (cells[iDeposit] ?? null) : null,
    });
    rows.push(row);
  }

  return rows;
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
    const res = await runLLM({
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
