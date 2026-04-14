"use client";

import { Calendar, ChevronDown, Eye, FileWarning, Loader2, ShieldAlert, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type ComplianceRecordRow,
  getComplianceDocumentSignedUrl,
  upsertComplianceRecord,
  uploadComplianceDocument,
} from "@/lib/actions/compliance";
import type { ComplianceType } from "@/lib/compliance/types";
import type { PropertyRow } from "@/lib/actions/properties";

const ALL_CERT_ROWS: { type: ComplianceType; label: string; hint: string }[] = [
  { type: "EPC", label: "EPC", hint: "Energy performance certificate" },
  { type: "Gas Safety", label: "Gas Safety", hint: "Annual gas safety (CP12)" },
  { type: "Electric Safety", label: "Electrical (EICR)", hint: "Periodic inspection condition report" },
];

function certRowsForProperty(hasGasSupply: boolean) {
  if (hasGasSupply) return ALL_CERT_ROWS;
  return ALL_CERT_ROWS.filter((r) => r.type !== "Gas Safety");
}

function recordFor(
  records: ComplianceRecordRow[],
  propertyId: string,
  type: ComplianceType,
): ComplianceRecordRow | undefined {
  return records.find((r) => r.propertyId === propertyId && r.type === type);
}

function propertyNeedsAttention(
  records: ComplianceRecordRow[],
  propertyId: string,
  hasGasSupply: boolean,
): boolean {
  return certRowsForProperty(hasGasSupply).some((row) => {
    const rec = recordFor(records, propertyId, row.type);
    const missingDoc = !rec?.documentUrl?.trim();
    const expired = rec?.status === "expired";
    return missingDoc || expired;
  });
}

function rowKey(propertyId: string, type: ComplianceType): string {
  return `${propertyId}__${type}`;
}

/** Expiry-only badge (document must exist; use certificateStatusPill for document + verification). */
function expiryStatusBadge(status: ComplianceRecordRow["status"] | undefined) {
  if (!status) {
    return (
      <span className="inline-flex h-6 items-center font-headline text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
        Not set
      </span>
    );
  }
  if (status === "expired") {
    return (
      <Badge className="h-6 shrink-0 border border-red-400/50 bg-red-500/[0.1] px-2 font-headline text-[0.62rem] uppercase leading-none tracking-[0.12em] text-red-800 dark:border-red-400/45 dark:text-red-200">
        Expired
      </Badge>
    );
  }
  if (status === "missing") {
    return (
      <Badge className="h-6 shrink-0 border border-[#BD9952]/45 bg-[#BD9952]/10 px-2 font-headline text-[0.62rem] uppercase leading-none tracking-[0.12em] text-[#8a7348] dark:text-[#BD9952]">
        Missing date
      </Badge>
    );
  }
  if (status === "expiring") {
    return (
      <Badge className="h-6 shrink-0 border border-amber-400/55 bg-amber-500/[0.08] px-2 font-headline text-[0.62rem] uppercase leading-none tracking-[0.12em] text-amber-900 dark:border-amber-400/40 dark:text-amber-100">
        Expiring
      </Badge>
    );
  }
  return (
    <Badge className="h-6 shrink-0 border border-emerald-600/35 bg-emerald-500/[0.08] px-2 font-headline text-[0.62rem] uppercase leading-none tracking-[0.12em] text-emerald-900 dark:border-emerald-500/35 dark:text-emerald-100">
      Valid
    </Badge>
  );
}

/** Document row only: Missing → View (Mercury-minimal). */
function documentStatusPill(hasDoc: boolean) {
  if (!hasDoc) {
    return (
      <Badge className="h-6 shrink-0 border border-[#BD9952]/40 bg-[#BD9952]/[0.08] px-2 font-headline text-[0.62rem] uppercase leading-none tracking-[0.14em] text-[#8a7348] dark:text-[#BD9952]">
        Missing
      </Badge>
    );
  }
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-[#BD9952]/35 bg-background/60 px-2.5 font-headline text-[0.62rem] uppercase tracking-[0.12em] text-foreground">
      <Eye className="size-3 shrink-0 text-[#BD9952]" aria-hidden />
      View
    </span>
  );
}

export function ComplianceDashboard({
  properties,
  records,
}: {
  properties: PropertyRow[];
  records: ComplianceRecordRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  /** Keys where upload succeeded — UI shows View before RSC props catch up. */
  const [optimisticDocKeys, setOptimisticDocKeys] = useState<Record<string, true>>({});
  /** Signed URL from last upload so View works without router.refresh(). */
  const [viewUrlByKey, setViewUrlByKey] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  /** Collapsed by default: header shows address + attention; expand for certificate rows. */
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const isCardExpanded = (propertyId: string) => expandedById[propertyId] === true;

  const toggleCard = (propertyId: string) => {
    setExpandedById((m) => {
      const cur = m[propertyId] === true;
      return { ...m, [propertyId]: !cur };
    });
  };

  useEffect(() => {
    setOptimisticDocKeys((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of Object.keys(prev)) {
        const parts = key.split("__");
        const propertyId = parts[0]!;
        const type = parts.slice(1).join("__") as ComplianceType;
        const rec = recordFor(records, propertyId, type);
        if (rec?.documentUrl?.trim()) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [records]);

  function onDateChange(propertyId: string, type: ComplianceType, value: string) {
    if (!value) return;
    startTransition(async () => {
      const result = await upsertComplianceRecord(propertyId, type, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved");
      startTransition(() => router.refresh());
    });
  }

  async function onFileSelected(propertyId: string, type: ComplianceType, file: File | null) {
    if (!file) return;
    const key = rowKey(propertyId, type);
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadComplianceDocument(propertyId, type, fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOptimisticDocKeys((m) => ({ ...m, [key]: true }));
      if (result.signedViewUrl) {
        setViewUrlByKey((m) => ({ ...m, [key]: result.signedViewUrl! }));
      }
      toast.success("PDF uploaded");
      startTransition(() => router.refresh());
    } finally {
      setUploadingKey(null);
      const input = fileInputRefs.current[key];
      if (input) input.value = "";
    }
  }

  async function onViewDocument(propertyId: string, type: ComplianceType) {
    const key = rowKey(propertyId, type);
    const cached = viewUrlByKey[key];
    if (cached) {
      window.open(cached, "_blank", "noopener,noreferrer");
      return;
    }
    setOpeningKey(key);
    try {
      const result = await getComplianceDocumentSignedUrl(propertyId, type);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningKey(null);
    }
  }

  if (properties.length === 0) {
    return (
      <div
        className="compliance-card-enter relative overflow-hidden rounded-2xl border border-dashed border-[#BD9952]/35 bg-gradient-to-b from-muted/40 to-muted/10 px-8 py-20 text-center shadow-[inset_0_1px_0_0_rgba(189,153,82,0.12)]"
        style={{ animationDelay: "80ms" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "96px 96px",
          }}
        />
        <div className="relative mx-auto flex max-w-md flex-col items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full border border-[#BD9952]/40 bg-[#BD9952]/10 text-[#BD9952]">
            <FileWarning className="size-7" strokeWidth={1.25} aria-hidden />
          </div>
          <div className="space-y-2">
            <p className="font-headline text-xl font-light text-foreground">No properties in the register</p>
            <p className="font-headline text-sm font-light leading-relaxed text-muted-foreground">
              Add a property first — then this ledger will track EPC, gas, and electrical certificates per address.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {properties.map((p, cardIndex) => {
        const title = [p.address, p.postcode].filter(Boolean).join(", ") || "Property";
        const sub = p.city ? p.city : null;
        const attention = propertyNeedsAttention(records, p.id, p.hasGasSupply);
        const rows = certRowsForProperty(p.hasGasSupply);
        const expanded = isCardExpanded(p.id);
        const panelId = `compliance-property-${p.id}`;

        return (
          <article
            key={p.id}
            className={cn(
              // `self-start` avoids CSS grid row stretch: siblings were forced to the same height as an
              // expanded card, leaving blank space under collapsed headers.
              "compliance-card-enter group/card relative flex w-full max-w-full flex-col self-start overflow-hidden rounded-2xl border bg-card/90 shadow-[0_28px_56px_-32px_rgba(0,0,0,0.65)] ring-1 ring-inset",
              attention
                ? "border-red-500/35 ring-red-500/20"
                : "border-border/80 ring-white/[0.04] dark:ring-white/[0.06]",
            )}
            style={{ animationDelay: `${120 + cardIndex * 85}ms` }}
          >
            {/* Top mercury hairline */}
            <div
              className={cn(
                "h-[2px] w-full bg-gradient-to-r",
                attention
                  ? "from-red-500/50 via-red-400/30 to-transparent"
                  : "from-[#BD9952]/80 via-[#BD9952]/25 to-transparent",
              )}
              aria-hidden
            />

            <div className="relative p-6 pt-5">
              {attention ? (
                <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1 font-headline text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-red-800 dark:text-red-200">
                  <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
                  Attention
                </div>
              ) : null}

              <button
                type="button"
                id={`${panelId}-trigger`}
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-label={
                  expanded
                    ? "Collapse certificates and compliance details for this property"
                    : "Expand to view certificates and compliance details for this property"
                }
                onClick={() => toggleCard(p.id)}
                className={cn(
                  "flex w-full touch-manipulation items-start justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#BD9952]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  expanded ? "border-b border-border/50 pb-5" : "pb-1",
                  attention && "pr-24 sm:pr-28",
                )}
              >
                <header className="min-w-0 flex-1">
                  <p className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#BD9952]">
                    Registered property
                  </p>
                  <h2 className="mt-2 font-headline text-xl font-light leading-snug tracking-tight text-foreground">
                    {title}
                  </h2>
                  {sub ? (
                    <p className="mt-1.5 font-headline text-sm font-light leading-snug text-muted-foreground">{sub}</p>
                  ) : null}
                </header>
                <span
                  className={cn(
                    "mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground transition-transform duration-200",
                    expanded && "rotate-180",
                  )}
                  aria-hidden
                >
                  <ChevronDown className="size-5 stroke-[1.5]" />
                </span>
              </button>

              <div
                id={panelId}
                role="region"
                aria-labelledby={`${panelId}-trigger`}
                hidden={!expanded}
              >
              <ul className="mt-4 flex flex-col gap-4">
              {rows.map((row) => {
                  const rec = recordFor(records, p.id, row.type);
                  const value = rec?.expiryDate ?? "";
                  const rk = rowKey(p.id, row.type);
                  const hasDoc =
                    Boolean(rec?.documentUrl?.trim()) || Boolean(optimisticDocKeys[rk]);
                  const hasExpiryDate = Boolean(value.trim());
                  const isUploading = uploadingKey === rk;
                  const isOpening = openingKey === rk;
                  const missingDoc = !hasDoc;

                  return (
                    <li
                      key={row.type}
                      className={cn(
                        "@container/cert relative overflow-hidden rounded-xl border transition-[border-color,box-shadow,background] duration-300",
                        missingDoc
                          ? "border-[#BD9952]/25 bg-gradient-to-br from-[#BD9952]/[0.07] via-card/30 to-card/60 shadow-[inset_0_0_0_1px_rgba(189,153,82,0.08)] hover:border-[#BD9952]/40 hover:shadow-[inset_0_0_0_1px_rgba(189,153,82,0.18),0_12px_40px_-24px_rgba(189,153,82,0.35)]"
                          : "border-border/60 bg-muted/15 hover:border-border",
                      )}
                    >
                      {missingDoc ? (
                        <div
                          className="compliance-missing-glow pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[#BD9952] via-[#BD9952]/70 to-[#BD9952]/30"
                          aria-hidden
                        />
                      ) : null}

                      {/* Flex + container queries: narrow widths always stack copy above controls (no grid overlap). */}
                      <div className="relative isolate flex flex-col gap-4 p-4 pl-5 @[28rem]/cert:flex-row @[28rem]/cert:items-start @[28rem]/cert:gap-5 @[32rem]/cert:gap-6">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                            <span className="font-headline text-[0.95rem] font-medium leading-tight tracking-tight text-foreground">
                              {row.label}
                            </span>
                            {documentStatusPill(hasDoc)}
                            {hasExpiryDate ? expiryStatusBadge(rec?.status) : null}
                          </div>
                          <p className="max-w-prose font-headline text-[0.72rem] font-light leading-relaxed text-muted-foreground">
                            {row.hint}
                          </p>
                        </div>

                        <div className="w-full min-w-0 @[28rem]/cert:w-[min(17.5rem,calc(100%-0.5rem))] @[28rem]/cert:max-w-[17.5rem] @[28rem]/cert:shrink-0">
                          <div
                            className={cn(
                              "space-y-3 rounded-xl border p-3.5",
                              "border-border/70 bg-background/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
                              "dark:bg-muted/20 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]",
                              missingDoc && "border-[#BD9952]/30 bg-[#BD9952]/[0.04]",
                            )}
                          >
                            <p className="font-headline text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              Certificate file & expiry
                            </p>

                            <input
                              ref={(el) => {
                                fileInputRefs.current[rk] = el;
                              }}
                              type="file"
                              accept="application/pdf"
                              className="sr-only"
                              id={`compliance-upload-${rk}`}
                              disabled={isUploading || pending}
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                void onFileSelected(p.id, row.type, f);
                              }}
                            />
                            {hasDoc ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isOpening || isUploading}
                                className="h-9 w-full justify-center rounded-full border-[#BD9952]/45 bg-background/80 px-4 font-headline text-xs font-medium text-foreground transition hover:border-[#BD9952]/70 hover:bg-[#BD9952]/12"
                                onClick={() => void onViewDocument(p.id, row.type)}
                              >
                                {isOpening ? (
                                  <Loader2 className="mr-2 size-3.5 shrink-0 animate-spin" aria-hidden />
                                ) : (
                                  <Eye className="mr-2 size-3.5 shrink-0 text-[#BD9952]" aria-hidden />
                                )}
                                View
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isUploading || pending}
                                className="h-9 w-full justify-center rounded-full border-[#BD9952]/45 bg-background/80 px-4 font-headline text-xs font-medium transition hover:border-[#BD9952]/70 hover:bg-[#BD9952]/12"
                                onClick={() => fileInputRefs.current[rk]?.click()}
                              >
                                {isUploading ? (
                                  <Loader2 className="mr-2 size-3.5 shrink-0 animate-spin" aria-hidden />
                                ) : (
                                  <Upload className="mr-2 size-3.5 shrink-0 text-[#BD9952]" aria-hidden />
                                )}
                                Upload PDF
                              </Button>
                            )}

                            <div className="space-y-1.5">
                              <span
                                id={`expiry-label-${rk}`}
                                className="block font-headline text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                              >
                                Expiry date
                              </span>
                              <div
                                className={cn(
                                  "flex h-10 w-full min-w-0 items-center gap-2 rounded-full border border-border/80 bg-background/90 px-3",
                                  "shadow-inner shadow-black/[0.06] outline-none transition",
                                  "focus-within:border-[#BD9952]/55 focus-within:ring-2 focus-within:ring-[#BD9952]/22",
                                  "dark:bg-muted/30",
                                  (pending || isUploading) && "pointer-events-none opacity-50",
                                )}
                              >
                                <Calendar className="size-4 shrink-0 text-[#BD9952]/90" aria-hidden />
                                <input
                                  type="date"
                                  aria-labelledby={`expiry-label-${rk}`}
                                  disabled={pending || isUploading}
                                  value={value}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v) onDateChange(p.id, row.type, v);
                                  }}
                                  className={cn(
                                    "min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 font-headline text-sm leading-none text-foreground outline-none",
                                    "[color-scheme:light] dark:[color-scheme:dark]",
                                    "[&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:opacity-70",
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
