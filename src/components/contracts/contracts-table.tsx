"use client";

import Link from "next/link";
import { ChevronDown, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  deleteContract,
  updateContractStatus,
  type ContractListRow,
  type ContractStatusUpdate,
} from "@/lib/actions/contracts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function statusBadge(status: string | null) {
  const s = (status ?? "draft").toLowerCase();
  if (s === "active") {
    return (
      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
        Active
      </Badge>
    );
  }
  if (s === "draft") {
    return (
      <Badge className="border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-300">
        Draft
      </Badge>
    );
  }
  if (s === "expired") {
    return (
      <Badge className="border border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
        Expired
      </Badge>
    );
  }
  if (s === "terminated") {
    return (
      <Badge className="border border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
        Terminated
      </Badge>
    );
  }
  return <span className="text-muted-foreground">{status ?? "—"}</span>;
}

export function ContractsTable({ contracts }: { contracts: ContractListRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(id: string, status: ContractStatusUpdate) {
    setBusyId(id);
    try {
      await updateContractStatus(id, status);
      toast.success("Status updated.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await deleteContract(id);
      toast.success("Contract deleted.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Property</TableHead>
          <TableHead>Tenant</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Start date</TableHead>
          <TableHead>End date</TableHead>
          <TableHead>Monthly rent</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contracts.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
              No contracts yet. Create one to get started.
            </TableCell>
          </TableRow>
        ) : (
          contracts.map((c) => {
            const st = (c.status ?? '').toLowerCase();
            const canChange = st !== "expired" && st !== "terminated";
            return (
              <TableRow key={c.id}>
                <TableCell className="max-w-[200px] font-medium">
                  {c.propertyAddress ?? "—"}
                </TableCell>
                <TableCell>
                  <span className="block">{c.tenantName ?? "—"}</span>
                  {c.tenantEmail ? (
                    <span className="text-xs text-muted-foreground">{c.tenantEmail}</span>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-[200px] text-sm">{c.contractType ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{c.startDate ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{c.endDate ?? "—"}</TableCell>
                <TableCell>{gbp.format(c.monthlyRent)}</TableCell>
                <TableCell>{statusBadge(c.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/contracts/${c.id}`}>View</Link>
                    </Button>
                    {canChange ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyId === c.id}
                            className="gap-1"
                          >
                            Status
                            <ChevronDown className="size-3.5 opacity-60" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {st === "draft" ? (
                            <DropdownMenuItem onClick={() => void setStatus(c.id, "active")}>
                              Set active
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => void setStatus(c.id, "expired")}>
                            Set expired
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void setStatus(c.id, "terminated")}>
                            Set terminated
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={busyId === c.id}
                      aria-label="Delete contract"
                      onClick={() => void remove(c.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
