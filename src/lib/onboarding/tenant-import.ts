import { z } from "zod";

import { runLLM } from "@/lib/llm/router";

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
  const email =
    emailRaw.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;

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

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return {
      ok: false,
      error: "AI import needs ANTHROPIC_API_KEY on the server. Add one tenant manually or use a CSV.",
    };
  }

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
