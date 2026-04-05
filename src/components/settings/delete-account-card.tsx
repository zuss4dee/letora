"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
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
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>
          Permanently delete your Letora account and data we hold for your landlord account. This
          cannot be undone. Active subscriptions should be cancelled in billing before you delete
          your account.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
            <Input
              id="delete-confirm"
              name="delete-confirm"
              type="text"
              autoComplete="off"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="DELETE"
              className="max-w-xs font-mono"
              aria-invalid={phrase.length > 0 && !canSubmit && phrase.trim().toUpperCase() !== "DELETE"}
            />
          </div>
          {message ? (
            <p className="text-sm text-destructive" role="alert">
              {message}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            variant="destructive"
            disabled={!canSubmit}
            className={cn(pending && "opacity-80")}
          >
            {pending ? "Deleting…" : "Delete my account"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
