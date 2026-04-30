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
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-between gap-3 px-4 lg:px-6">
          <div>
            <h1 className="text-base font-semibold tracking-tight">AI Activity Log</h1>
            <p className="text-sm text-muted-foreground">
              Recent tool calls made by your AI assistant.
            </p>
          </div>
        </div>

        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="-mx-6 overflow-x-auto px-6 md:mx-0 md:overflow-visible md:px-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Tool</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No activity recorded yet. Use the assistant to see tool calls here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {formatToolName(row.tool_name)}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500 capitalize">
                          {row.source || "assistant"}
                        </TableCell>
                        <TableCell>
                          {row.success ? (
                            <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                              Success
                            </Badge>
                          ) : (
                            <Badge className="border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(row.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ActivityRowDetail
                            args={row.args}
                            result={row.result}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
