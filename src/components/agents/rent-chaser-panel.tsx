"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import type { AgentResult } from "@/lib/agents/rent-chaser";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function truncate(text: string, max = 110) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function RentChaserPanel() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AgentResult[]>([]);

  async function runAgent() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/agents/rent-chaser", { method: "POST" });
      const body = (await response.json()) as { results?: AgentResult[]; error?: string };
      if (!response.ok) {
        setError(body.error ?? "Failed to run agent");
        return;
      }
      setResults(body.results ?? []);
    } catch {
      setError("Failed to run agent");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rent Chaser Agent</CardTitle>
            <CardDescription>
              Automatically detects overdue rent and drafts chase emails.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              onClick={runAgent}
              disabled={running}
              className="bg-zinc-100 dark:bg-zinc-900 text-white hover:bg-zinc-200 dark:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {running ? (
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
            <CardTitle className="text-base">Lead Qualifier Agent</CardTitle>
            <CardDescription>
              Scores and qualifies incoming leads based on criteria.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge
              variant="secondary"
              className="border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200"
            >
              Coming Soon
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenant Verifier Agent</CardTitle>
            <CardDescription>
              Verifies tenant documents and right to rent status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge
              variant="secondary"
              className="border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200"
            >
              Coming Soon
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Rent Chaser Results</CardTitle>
          <CardDescription>Generated email drafts for overdue rent payments.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Amount Owed</TableHead>
                <TableHead>Days Overdue</TableHead>
                <TableHead>Email Preview</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Run Rent Chaser Agent to generate draft emails.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((row) => (
                  <TableRow key={row.actionId}>
                    <TableCell className="font-medium">{row.tenantName}</TableCell>
                    <TableCell>{row.propertyAddress}</TableCell>
                    <TableCell>{gbp.format(row.amountOwed)}</TableCell>
                    <TableCell>{row.daysOverdue}</TableCell>
                    <TableCell className="max-w-[360px] truncate">
                      <span className="font-medium">{row.emailSubject}</span>
                      <span className="ml-2 text-muted-foreground">
                        {truncate(row.emailBody)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            View Full Email
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{row.emailSubject}</DialogTitle>
                            <DialogDescription>
                              To: {row.tenantName} ({row.tenantEmail})
                            </DialogDescription>
                          </DialogHeader>
                          <div className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-4 text-sm">
                            {row.emailBody}
                          </div>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => navigator.clipboard.writeText(`${row.emailSubject}\n\n${row.emailBody}`)}
                            >
                              Copy to Clipboard
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

