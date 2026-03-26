"use client";

import { FileText, Loader2, Mail, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function truncate(text: string, limit = 120) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

type AgentResult = {
  tenantName: string;
  tenantEmail: string;
  propertyAddress: string;
  amountOwed: number;
  daysOverdue: number;
  emailSubject: string;
  emailBody: string;
  actionId: string;
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

export function AgentsClient() {
  const [isRentRunning, setIsRentRunning] = useState(false);
  const [isLeadRunning, setIsLeadRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rentResults, setRentResults] = useState<AgentResult[]>([]);
  const [leadResults, setLeadResults] = useState<LeadQualifierResult[]>([]);
  const [contractDrafterLoading, setContractDrafterLoading] = useState(false);
  const [contractDrafterResult, setContractDrafterResult] = useState<ContractDraftResult | null>(null);
  const [draftContracts, setDraftContracts] = useState<
    Array<{
      id: string;
      contract_type: string;
      tenant_name: string;
      property_address: string;
    }>
  >([]);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [showRentDraftsDialog, setShowRentDraftsDialog] = useState(false);
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/contracts/drafts")
      .then((r) => r.json())
      .then((data: { contracts?: Array<{ id: string; contract_type: string; tenant_name: string; property_address: string }> }) => {
        const rows = data.contracts ?? [];
        setDraftContracts(rows);
        if (rows[0]?.id) setSelectedContractId(rows[0].id);
      });
  }, []);

  async function onRunRentAgent() {
    console.log("[AgentsClient] Rent Chaser Run Agent clicked");
    setIsRentRunning(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch("/api/agents/rent-chaser", { method: "POST" });
      const payload = (await response.json()) as { results?: AgentResult[]; error?: string };
      if (!response.ok) {
        const message = payload.error ?? "Failed to run rent chaser agent.";
        setError(message);
        toast.error(message);
        return;
      }

      const rows = payload.results ?? [];
      setRentResults(rows);
      if (rows.length === 0) {
        toast.success("All tenants are up to date — no overdue payments found");
      } else {
        setShowRentDraftsDialog(true);
      }
    } catch {
      setError("Failed to run rent chaser agent.");
      toast.error("Failed to run rent chaser agent.");
    } finally {
      setIsRentRunning(false);
    }
  }

  async function onRunLeadQualifier() {
    setIsLeadRunning(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch("/api/agents/lead-qualifier", { method: "POST" });
      const payload = (await response.json()) as {
        results?: LeadQualifierResult[];
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Failed to run lead qualifier agent.");
        return;
      }

      setLeadResults(payload.results ?? []);
    } catch {
      setError("Failed to run lead qualifier agent.");
    } finally {
      setIsLeadRunning(false);
    }
  }

  async function runContractDrafter() {
    if (!selectedContractId) return;
    setShowContractDialog(false);
    setContractDrafterLoading(true);
    setContractError(null);
    try {
      const res = await fetch("/api/agents/contract-drafter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: selectedContractId }),
      });
      const data = (await res.json()) as { result?: ContractDraftResult; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setContractDrafterResult(data.result ?? null);
    } catch (e) {
      setContractError(e instanceof Error ? e.message : "Failed to generate contract");
    } finally {
      setContractDrafterLoading(false);
    }
  }

  async function copyEmail(actionId: string, body: string) {
    await navigator.clipboard.writeText(body);
    setCopiedActionId(actionId);
    setTimeout(() => setCopiedActionId(null), 1200);
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

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <h1 className="text-base font-semibold tracking-tight">AI Agents</h1>
            <p className="text-sm text-muted-foreground">
              Autonomous agents that manage your property portfolio.
            </p>
          </div>

          <div className="grid gap-4 px-4 md:grid-cols-3 lg:px-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <CardTitle className="text-base">Rent Chaser</CardTitle>
                </div>
                <CardDescription>
                  Detects overdue rent payments and drafts professional chase emails automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  onClick={onRunRentAgent}
                  disabled={isRentRunning}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
                >
                  {isRentRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    "Run Agent"
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-zinc-500" />
                  <CardTitle className="text-base">Lead Qualifier</CardTitle>
                </div>
                <CardDescription>
                  Scores and qualifies incoming leads based on your criteria and property requirements.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  onClick={onRunLeadQualifier}
                  disabled={isLeadRunning}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
                >
                  {isLeadRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    "Run Agent"
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-zinc-500" />
                  <CardTitle className="text-base">Contract Drafter</CardTitle>
                </div>
                <CardDescription>
                  Drafts tenancy contracts and legal documents using Claude for precision.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      onClick={() => setShowContractDialog(true)}
                      disabled={contractDrafterLoading}
                      className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
                    >
                      {contractDrafterLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        "Run Agent"
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Draft Contract with AI</DialogTitle>
                      <DialogDescription>
                        Select a draft contract to generate the full legal document.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                      <Select value={selectedContractId} onValueChange={setSelectedContractId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select draft contract" />
                        </SelectTrigger>
                        <SelectContent>
                          {draftContracts.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              No draft contracts available
                            </SelectItem>
                          ) : (
                            draftContracts.map((contract) => (
                              <SelectItem key={contract.id} value={contract.id}>
                                {contract.tenant_name} - {contract.property_address}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowContractDialog(false)}>
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={runContractDrafter}
                          disabled={!selectedContractId || draftContracts.length === 0}
                          className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
                        >
                          Generate Contract
                        </Button>
                      </DialogFooter>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>

          <div className="px-4 lg:px-6">
            {error ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            ) : null}
            {successMessage ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {successMessage}
              </div>
            ) : null}
            {contractDrafterLoading ? (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
                Generating contract draft...
              </div>
            ) : null}
            {contractError ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {contractError}
              </div>
            ) : null}
          </div>

          <Dialog open={showRentDraftsDialog} onOpenChange={setShowRentDraftsDialog}>
            <DialogContent className="h-[90vh] max-w-[95vw] overflow-auto sm:max-w-[95vw]">
              <DialogHeader>
                <DialogTitle>Rent Chaser Draft Emails</DialogTitle>
                <DialogDescription>
                  Review generated drafts before sending to tenants.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                {rentResults.map((row) => (
                  <Card key={row.actionId}>
                    <CardHeader className="border-b">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{row.tenantName}</CardTitle>
                          <p className="text-sm text-muted-foreground">{row.propertyAddress}</p>
                        </div>
                        <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
                          {row.daysOverdue} days overdue
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 pt-4">
                      <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                        <div className="mb-2 font-medium">{row.emailSubject}</div>
                        <div className="whitespace-pre-wrap">{row.emailBody}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void copyEmail(row.actionId, row.emailBody)}
                        >
                          {copiedActionId === row.actionId ? "Copied!" : "Copy Email"}
                        </Button>
                        <Button
                          type="button"
                          className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-400 dark:text-zinc-950 dark:hover:bg-indigo-300"
                          onClick={() => {
                            const subject = encodeURIComponent(row.emailSubject);
                            const body = encodeURIComponent(row.emailBody);
                            window.location.href = `mailto:${row.tenantEmail}?subject=${subject}&body=${body}`;
                          }}
                        >
                          Send via Email
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {leadResults.length > 0 ? (
            <div className="px-4 lg:px-6">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Lead Qualifier Results</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Property Interested</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Recommendation</TableHead>
                        <TableHead>Reasoning</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadResults.map((row) => (
                        <TableRow key={row.actionId}>
                          <TableCell className="font-medium">{row.fullName}</TableCell>
                          <TableCell>{row.email}</TableCell>
                          <TableCell className="max-w-[280px] truncate">
                            {row.propertyInterested}
                          </TableCell>
                          <TableCell>{row.source}</TableCell>
                          <TableCell>{scoreBadge(row.score)}</TableCell>
                          <TableCell>{recommendationBadge(row.recommendation)}</TableCell>
                          <TableCell className="max-w-[320px] truncate text-muted-foreground">
                            {truncate(row.reasoning)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  View Full Analysis
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>{row.fullName} - Lead Analysis</DialogTitle>
                                  <DialogDescription>
                                    Score: {row.score} | Recommendation:{" "}
                                    {row.recommendation === "qualify" ? "Qualify" : "Reject"}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-3 rounded-md border border-border bg-muted/20 p-4 text-sm">
                                  <div>
                                    <span className="font-medium">Score: </span>
                                    {row.score}
                                  </div>
                                  <div>
                                    <span className="font-medium">Recommendation: </span>
                                    {row.recommendation === "qualify" ? "Qualify" : "Reject"}
                                  </div>
                                  <div className="whitespace-pre-wrap">
                                    <span className="font-medium">Reasoning:</span>
                                    <div className="mt-1">{row.reasoning}</div>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {contractDrafterResult ? (
            <div className="px-4 lg:px-6">
              <Card>
                <CardHeader className="border-b">
                  <CardTitle>Contract Drafter Result</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 pt-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Tenant</div>
                      <div className="font-medium">{contractDrafterResult.tenantName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Property</div>
                      <div className="font-medium">{contractDrafterResult.propertyAddress}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Contract Type</div>
                      <div className="font-medium">{contractDrafterResult.contractType}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Monthly Rent / Deposit</div>
                      <div className="font-medium">
                        {gbp.format(contractDrafterResult.monthlyRent)} /{" "}
                        {gbp.format(contractDrafterResult.depositAmount)}
                      </div>
                    </div>
                  </div>
                  <Textarea
                    readOnly
                    value={contractDrafterResult.contractText}
                    className="h-96 font-mono text-xs"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(contractDrafterResult.contractText)}
                    >
                      Copy Contract
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

