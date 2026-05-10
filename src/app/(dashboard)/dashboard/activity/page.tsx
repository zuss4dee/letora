export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRecentActivity } from "@/lib/actions/activity-log";
import { createClient } from "@/lib/supabase/server";
import { ActivityLogEmptyState } from "./activity-empty";
import { ActivityRowDetail } from "./activity-row-detail";

type ActivityRow = {
  id: string;
  tool_name: string;
  args: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  success: boolean;
  created_at: string;
  source?: string | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatToolName(name: string): string {
  // If it's already upper case with spaces or mixed, try to normalize
  const normalized = name.replace(/_/g, " ");
  return normalized
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const data = await getRecentActivity(user.id, 100);
  const rows = (data as unknown as ActivityRow[]) ?? [];

  return (
    <div className="@container/main flex min-h-0 flex-1 flex-col gap-2 bg-zinc-50 dark:bg-[#0B0B0B]">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl dark:text-white">
              AI Activity Log
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Recent tool calls made by your AI assistant.
            </p>
          </div>
        </div>

        <div className="px-4 lg:px-6">
          <Card className="border-zinc-200 bg-white dark:border-[#2a2a2a] dark:bg-[#161616]">
            <CardHeader className="border-b border-zinc-200 bg-zinc-50 dark:border-[#2a2a2a] dark:bg-[#161616]">
              <CardTitle className="text-base font-semibold text-zinc-900 md:text-lg dark:text-zinc-100">
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {rows.length === 0 ? (
                <ActivityLogEmptyState />
              ) : (
                <>
                  <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <Table className="min-w-[640px] w-full">
                      <TableHeader>
                        <TableRow className="border-zinc-200 hover:bg-transparent dark:border-[#2a2a2a] dark:hover:bg-transparent">
                          <TableHead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-[#161616] dark:text-zinc-400">
                            Tool
                          </TableHead>
                          <TableHead className="hidden bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 md:table-cell dark:bg-[#161616] dark:text-zinc-400">
                            Source
                          </TableHead>
                          <TableHead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-[#161616] dark:text-zinc-400">
                            Status
                          </TableHead>
                          <TableHead className="hidden bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 sm:table-cell dark:bg-[#161616] dark:text-zinc-400">
                            Date
                          </TableHead>
                          <TableHead className="text-right bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-[#161616] dark:text-zinc-400">
                            Details
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="border-zinc-200 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-[#2a2a2a] dark:text-zinc-200 dark:hover:bg-transparent"
                          >
                            <TableCell className="font-medium text-zinc-800 dark:text-zinc-200">
                              {formatToolName(row.tool_name)}
                            </TableCell>
                            <TableCell className="hidden text-zinc-600 capitalize md:table-cell dark:text-zinc-400">
                              {row.source || "assistant"}
                            </TableCell>
                            <TableCell>
                              {row.success ? (
                                <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                                  Success
                                </Badge>
                              ) : (
                                <Badge className="border border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
                                  Failed
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="hidden text-zinc-700 sm:table-cell dark:text-zinc-300">
                              {formatDate(row.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <ActivityRowDetail
                                args={row.args}
                                result={row.result}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 md:hidden">← Scroll to see more</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
