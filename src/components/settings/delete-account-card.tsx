"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { deleteAccount } from "@/lib/actions/delete-account";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function DeleteAccountCard() {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmit = phrase.trim().toUpperCase() === "DELETE" && !pending;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await deleteAccount(phrase);
      if (!result.ok) {
        setMessage(result.error ?? "Something went wrong.");
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <Card className="gap-0 overflow-hidden border border-red-200/80 bg-gradient-to-b from-red-50/90 to-card py-0 shadow-sm ring-1 ring-red-200/60 backdrop-blur-md dark:border-0 dark:from-[#1f1410]/90 dark:to-[#141312]/95 dark:ring-[#BB5551]/20">
      <CardHeader className="space-y-2 border-b border-red-200/50 bg-red-50/50 px-6 pb-4 pt-6 dark:border-0 dark:bg-[#1a1210]/60 sm:px-8">
        <CardTitle className="font-headline text-lg font-light tracking-tight text-[#e8a8a4]">
          Danger zone
        </CardTitle>
        <CardDescription className="font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground">
          Permanently delete your Letora account and data we hold for your landlord account. This
          cannot be undone. Active subscriptions should be cancelled on the{" "}
          <Link href="/dashboard/billing" className="text-foreground underline-offset-4 hover:underline">
            Billing
          </Link>{" "}
          page before you delete your account.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4 px-6 pb-2 pt-0 sm:px-8">
          <div className="space-y-2">
            <Label htmlFor="delete-confirm" className="font-[family-name:var(--font-inter)] text-xs text-muted-foreground">
              Type DELETE to confirm
            </Label>
            <Input
              id="delete-confirm"
              name="delete-confirm"
              type="text"
              autoComplete="off"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="DELETE"
              className="max-w-xs rounded-md border-border bg-background font-mono text-sm text-foreground dark:border-[rgb(72_72_72_/0.28)] dark:bg-[#0e0e0e]/80"
              aria-invalid={phrase.length > 0 && !canSubmit && phrase.trim().toUpperCase() !== "DELETE"}
            />
          </div>
          {message ? (
            <p className="font-[family-name:var(--font-inter)] text-sm text-[#e8a8a4]" role="alert">
              {message}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="border-0 bg-transparent px-6 pb-6 pt-2 sm:px-8">
          <Button
            type="submit"
            variant="destructive"
            disabled={!canSubmit}
            className={cn(
              "rounded-md bg-background dark:bg-[#7a2e2a] text-[#fce8e7] hover:bg-background dark:bg-[#8f3832]",
              pending && "opacity-80",
            )}
          >
            {pending ? "Deleting…" : "Delete my account"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
