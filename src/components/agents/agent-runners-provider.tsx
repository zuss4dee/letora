"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { saveContractDraft } from "@/lib/actions/agents";
import type { AgentRun } from "@/lib/actions/agents";
import { updateLeadQualifiedStatus } from "@/lib/actions/leads";

import { AgentRunsTable } from "@/components/agents/agent-runs-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type RentDraft = {
  actionId?: string;
  tenantName?: string;
  tenantEmail?: string;
  propertyAddress?: string;
  daysOverdue?: number;
  emailSubject?: string;
  emailBody?: string;
  emailSent?: boolean;
};

type LeadQualifierResult = {
  leadId: string;
  fullName: string;
  email: string;
  propertyInterested: string;
  source: string;
  score: number;
  recommendation: "qualify" | "reject";
  reasoning: string;
  actionId: string;
};

type DraftContractOption = {
  id: string;
  contract_type: string;
  tenant_name: string;
  property_address: string;
};

type ContractDraftResult = {
  contractId: string;
  tenantName: string;
  propertyAddress: string;
  contractType: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  contractText: string;
  actionId: string;
};

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function truncate(text: string, max = 140) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function scoreBadge(score: number) {
  if (score <= 40) {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        {score}
      </Badge>
    );
  }
  if (score <= 69) {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
        {score}
      </Badge>
    );
  }
  return (
    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
      {score}
    </Badge>
  );
}

function recommendationBadge(value: "qualify" | "reject") {
  if (value === "qualify") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Qualify
      </Badge>
    );
  }
  return (
    <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
      Reject
    </Badge>
  );
}

export type AgentRunnersContextValue = {
  runRentChaser: () => Promise<void>;
  runLeadQualifier: () => Promise<void>;
  openContractDrafter: () => void;
  openAgentRuns: () => void;
  closeAgentRuns: () => void;
  isRentRunning: boolean;
  isLeadRunning: boolean;
  isContractRunning: boolean;
  agentRunsOpen: boolean;
};

const AgentRunnersContext = createContext<AgentRunnersContextValue | null>(null);

export function useAgentRunners(): AgentRunnersContextValue {
  const ctx = useContext(AgentRunnersContext);
  if (!ctx) {
    throw new Error("useAgentRunners must be used within AgentRunnersProvider");
  }
  return ctx;
}

function AgentRunnersInner({
  children,
  initialRuns,
}: {
  children: ReactNode;
  initialRuns: AgentRun[];
}) {
  const [isRentRunning, setIsRentRunning] = useState(false);
  const [showRentDialog, setShowRentDialog] = useState(false);
  const [rentDrafts, setRentDrafts] = useState<RentDraft[]>([]);
  const [copiedRentIndex, setCopiedRentIndex] = useState<number | null>(null);
  const [copiedSubjectIndex, setCopiedSubjectIndex] = useState<number | null>(null);

  const [isLeadRunning, setIsLeadRunning] = useState(false);
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [leadResults, setLeadResults] = useState<LeadQualifierResult[]>([]);
  const [leadDetail, setLeadDetail] = useState<LeadQualifierResult | null>(null);
  const [applyingLeads, setApplyingLeads] = useState(false);
  const [appliedLeads, setAppliedLeads] = useState<Set<string>>(new Set());

  const [draftContracts, setDraftContracts] = useState<DraftContractOption[]>([]);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [showContractPicker, setShowContractPicker] = useState(false);
  const [isContractRunning, setIsContractRunning] = useState(false);
  const [contractResult, setContractResult] = useState<ContractDraftResult | null>(null);
  const [showContractResult, setShowContractResult] = useState(false);
  const [copiedContract, setCopiedContract] = useState(false);
  const [savedContract, setSavedContract] = useState(false);

  const [agentRunsOpen, setAgentRunsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/contracts/drafts")
      .then((r) => r.json())
      .then((data: { contracts?: DraftContractOption[] }) => {
        const list = data.contracts ?? [];
        setDraftContracts(list);
        if (list[0]?.id) setSelectedContractId(list[0].id);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  async function onRunRentChaser() {
    setIsRentRunning(true);
    try {
      const res = await fetch("/api/agents/rent-chaser", { method: "POST" });
      const data = (await res.json()) as {
        drafts?: RentDraft[];
        results?: RentDraft[];
        error?: string;
      };

      if (!res.ok) {
        toast.error(data.error || "Something went wrong");
        return;
      }

      const nextDrafts = data.drafts ?? data.results ?? [];
      if (!nextDrafts.length) {
        toast.success("All tenants are up to date!");
        return;
      }

      setRentDrafts(nextDrafts);
      setShowRentDialog(true);
      toast.success("Review chases below, then approve in Approvals to send.");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsRentRunning(false);
    }
  }

  async function onRunLeadQualifier() {
    setIsLeadRunning(true);
    try {
      const res = await fetch("/api/agents/lead-qualifier", { method: "POST" });
      const data = (await res.json()) as { results?: LeadQualifierResult[]; error?: string };

      if (!res.ok) {
        toast.error(data.error || "Failed to run lead qualifier");
        return;
      }

      const rows = data.results ?? [];
      if (rows.length === 0) {
        toast.info("No new leads to qualify");
        return;
      }

      setLeadResults(rows);
      setAppliedLeads(new Set());
      setShowLeadDialog(true);
    } catch {
      toast.error("Failed to run lead qualifier");
    } finally {
      setIsLeadRunning(false);
    }
  }

  function openContractPicker() {
    if (draftContracts.length === 0) {
      toast.info("Create a draft contract first, then run the drafter.");
      return;
    }
    setShowContractPicker(true);
  }

  async function onGenerateContract() {
    if (!selectedContractId) return;
    setShowContractPicker(false);
    setIsContractRunning(true);
    setContractResult(null);
    setSavedContract(false);
    try {
      const res = await fetch("/api/agents/contract-drafter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: selectedContractId }),
      });
      const data = (await res.json()) as { result?: ContractDraftResult; error?: string };

      if (!res.ok) {
        toast.error(data.error || "Failed to generate contract");
        return;
      }

      if (data.result) {
        setContractResult(data.result);
        setShowContractResult(true);
      }
    } catch {
      toast.error("Failed to generate contract");
    } finally {
      setIsContractRunning(false);
    }
  }

  async function onCopyRentBody(body: string, index: number) {
    await navigator.clipboard.writeText(body);
    setCopiedRentIndex(index);
    setTimeout(() => setCopiedRentIndex(null), 1200);
  }

  async function onCopyRentSubject(subject: string, index: number) {
    await navigator.clipboard.writeText(subject);
    setCopiedSubjectIndex(index);
    setTimeout(() => setCopiedSubjectIndex(null), 1200);
  }

  async function onCopyContractText() {
    if (!contractResult?.contractText) return;
    await navigator.clipboard.writeText(contractResult.contractText);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 1200);
  }

  async function onApplyLead(row: LeadQualifierResult) {
    try {
      await updateLeadQualifiedStatus(
        row.leadId,
        row.recommendation === "qualify" ? "qualified" : "disqualified",
      );
      setAppliedLeads((prev) => new Set([...prev, row.leadId]));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply");
    }
  }

  async function onApplyAllLeads() {
    setApplyingLeads(true);
    try {
      for (const row of leadResults) {
        await updateLeadQualifiedStatus(
          row.leadId,
          row.recommendation === "qualify" ? "qualified" : "disqualified",
        );
      }
      toast.success("Lead statuses updated");
      setShowLeadDialog(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setApplyingLeads(false);
    }
  }

  async function onSaveContractToDb() {
    if (!contractResult) return;
    try {
      await saveContractDraft(contractResult.contractId, contractResult.contractText);
      setSavedContract(true);
      toast.success("Contract saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  const openAgentRuns = useCallback(() => setAgentRunsOpen(true), []);
  const closeAgentRuns = useCallback(() => setAgentRunsOpen(false), []);

  const contextValue: AgentRunnersContextValue = {
    runRentChaser: onRunRentChaser,
    runLeadQualifier: onRunLeadQualifier,
    openContractDrafter: openContractPicker,
    openAgentRuns,
    closeAgentRuns,
    isRentRunning,
    isLeadRunning,
    isContractRunning,
    agentRunsOpen,
  };

  return (
    <AgentRunnersContext.Provider value={contextValue}>
      {children}

      <Sheet open={agentRunsOpen} onOpenChange={setAgentRunsOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden border-border bg-background p-0 sm:max-w-lg"
        >
          <SheetHeader className="border-b border-[#484848]/20 px-6 py-5 text-left">
            <SheetTitle className="font-headline text-lg font-light text-foreground">
              Agent activity log
            </SheetTitle>
            <SheetDescription className="font-[family-name:var(--font-inter)] text-xs text-muted-foreground">
              Recent runs from Rent Chaser, Lead Qualifier, Contract Drafter, and other agents.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
            <AgentRunsTable initialRuns={initialRuns} variant="embedded" />
          </div>
        </SheetContent>
      </Sheet>

      {/* Rent Chaser */}
      <Dialog open={showRentDialog} onOpenChange={setShowRentDialog}>
        <DialogContent className="h-[90vh] max-w-[95vw] overflow-auto sm:max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Rent chaser — review</DialogTitle>
            <DialogDescription>
              Proposed emails stay in <strong className="font-medium text-foreground">Approvals</strong> until you
              approve; sending runs only from there so logs stay consistent.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {rentDrafts.map((draft, index) => (
              <Card key={draft.actionId ?? `${draft.tenantName ?? "tenant"}-${index}`}>
                <CardHeader className="border-b">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{draft.tenantName ?? "Unknown tenant"}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {draft.propertyAddress ?? "Unknown property"}
                      </p>
                    </div>
                    <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
                      {draft.daysOverdue ?? 0} days overdue
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 pt-4">
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Subject</div>
                    <div className="rounded-md border border-zinc-200 bg-white p-3 text-sm font-medium text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                      {draft.emailSubject ?? "No subject"}
                    </div>
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void onCopyRentSubject(draft.emailSubject ?? "", index)}
                      >
                        {copiedSubjectIndex === index ? "Copied!" : "Copy subject"}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Body</div>
                    <div className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                      {draft.emailBody ?? "No email body generated."}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void onCopyRentBody(draft.emailBody ?? "", index)}
                      >
                        {copiedRentIndex === index ? "Copied!" : "Copy body"}
                      </Button>
                    </div>
                    <p className="font-[family-name:var(--font-inter)] text-xs text-muted-foreground">
                      {draft.emailSent
                        ? "This chase email was already sent."
                        : draft.tenantEmail?.trim()
                          ? "Pending approval — open Approvals to approve or deny; the email sends only after approval."
                          : "No tenant email on file for this chase."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard/approvals">Open Approvals</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Qualifier */}
      <Dialog open={showLeadDialog} onOpenChange={setShowLeadDialog}>
        <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Lead Qualifier Results</DialogTitle>
            <DialogDescription>AI scores and recommendations for your new leads.</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Recommendation</TableHead>
                <TableHead className="max-w-[200px]">Reasoning</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadResults.map((row) => (
                <TableRow key={row.leadId}>
                  <TableCell className="font-medium">{row.fullName}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{row.propertyInterested}</TableCell>
                  <TableCell>{row.source}</TableCell>
                  <TableCell>{scoreBadge(row.score)}</TableCell>
                  <TableCell>{recommendationBadge(row.recommendation)}</TableCell>
                  <TableCell className="max-w-[220px] text-muted-foreground text-xs">
                    {truncate(row.reasoning)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void onApplyLead(row)}
                        disabled={appliedLeads.has(row.leadId)}
                      >
                        {appliedLeads.has(row.leadId) ? "Applied ✓" : "Apply"}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setLeadDetail(row)}>
                        Full analysis
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button
              type="button"
              disabled={applyingLeads || leadResults.length === 0}
              onClick={() => void onApplyAllLeads()}
              className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
            >
              {applyingLeads ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying…
                </>
              ) : (
                "Apply all"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!leadDetail} onOpenChange={(open) => !open && setLeadDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{leadDetail?.fullName ?? "Lead"}</DialogTitle>
            <DialogDescription>
              Score: {leadDetail?.score ?? "—"} · Recommendation:{" "}
              {leadDetail?.recommendation === "qualify" ? "Qualify" : "Reject"}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
            {leadDetail?.reasoning}
          </div>
        </DialogContent>
      </Dialog>

      {/* Contract picker */}
      <Dialog open={showContractPicker} onOpenChange={setShowContractPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Draft contract with AI</DialogTitle>
            <DialogDescription>Choose a draft contract to generate full text.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Select value={selectedContractId} onValueChange={setSelectedContractId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a draft" />
              </SelectTrigger>
              <SelectContent>
                {draftContracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tenant_name} · {c.property_address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowContractPicker(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedContractId}
              onClick={() => void onGenerateContract()}
              className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
            >
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract result */}
      <Dialog open={showContractResult} onOpenChange={setShowContractResult}>
        <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Contract draft</DialogTitle>
            <DialogDescription>
              {contractResult?.tenantName} · {contractResult?.propertyAddress}
            </DialogDescription>
          </DialogHeader>
          {contractResult ? (
            <>
              <div className="grid max-h-[70vh] gap-4 overflow-auto">
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <div className="font-medium">{contractResult.contractType}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rent / Deposit</span>
                    <div className="font-medium">
                      {gbp.format(contractResult.monthlyRent)} / {gbp.format(contractResult.depositAmount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Start</span>
                    <div className="font-medium">{contractResult.startDate}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">End</span>
                    <div className="font-medium">{contractResult.endDate}</div>
                  </div>
                </div>
                <Textarea readOnly className="min-h-[240px] font-mono text-xs" value={contractResult.contractText} />
                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={() => void onCopyContractText()}>
                    {copiedContract ? "Copied!" : "Copy contract"}
                  </Button>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button
                  type="button"
                  disabled={savedContract}
                  onClick={() => void onSaveContractToDb()}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
                >
                  {savedContract ? "Saved ✓" : "Save to contract"}
                </Button>
                {savedContract ? (
                  <Button variant="outline" asChild>
                    <Link href={`/dashboard/contracts/${contractResult.contractId}`}>View contract →</Link>
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AgentRunnersContext.Provider>
  );
}

export function AgentRunnersProvider({
  children,
  initialRuns,
}: {
  children: ReactNode;
  initialRuns: AgentRun[];
}) {
  return <AgentRunnersInner initialRuns={initialRuns}>{children}</AgentRunnersInner>;
}
