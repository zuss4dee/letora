"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { sendEmailLogNow, type EmailDraftRow } from "@/lib/actions/email-drafts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatAgentType(agentType: string) {
  return agentType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function EmailDraftsCard({ drafts }: { drafts: EmailDraftRow[] }) {
  const router = useRouter();
  const [preview, setPreview] = useState<EmailDraftRow | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function handleSendNow(logId: string) {
    setSendingId(logId);
    const result = await sendEmailLogNow(logId);
    setSendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Email sent.");
    setPreview(null);
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Pending Email Drafts</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Review and send messages when auto-send is off, or before they go out.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No pending drafts.
                  </TableCell>
                </TableRow>
              ) : (
                drafts.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.to_name?.trim() || row.to_email}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{row.subject}</TableCell>
                    <TableCell>{formatAgentType(row.agent_type)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setPreview(row)}>
                          Review
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={sendingId === row.id}
                          onClick={() => void handleSendNow(row.id)}
                        >
                          {sendingId === row.id ? "Sending…" : "Send now"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{preview?.subject ?? "Preview"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              To: {preview?.to_name ? `${preview.to_name} <${preview.to_email}>` : preview?.to_email}
            </p>
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 font-sans text-sm">
              {preview?.body}
            </pre>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreview(null)}>
              Close
            </Button>
            {preview ? (
              <Button
                type="button"
                disabled={sendingId === preview.id}
                onClick={() => void handleSendNow(preview.id)}
              >
                {sendingId === preview.id ? "Sending…" : "Send now"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
