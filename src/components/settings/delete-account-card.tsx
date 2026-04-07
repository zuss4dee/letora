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
    <Card className="gap-0 overflow-hidden border-0 bg-gradient-to-b from-[#1f1410]/90 to-[#141312]/95 py-0 ring-1 ring-[#BB5551]/20 backdrop-blur-md">
      <CardHeader className="space-y-2 border-0 bg-[#1a1210]/60 px-6 pb-4 pt-6 sm:px-8">
        <CardTitle className="font-headline text-lg font-light tracking-tight text-[#e8a8a4]">
          Danger zone
        </CardTitle>
        <CardDescription className="font-[family-name:var(--font-inter)] text-sm font-light text-muted-foreground">
          Permanently delete your Letora account and data we hold for your landlord account. This
          cannot be undone. Active subscriptions should be cancelled in billing before you delete
          your account.
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
              className="max-w-xs rounded-md border-[rgb(72_72_72_/0.28)] bg-[#0e0e0e]/80 font-mono text-sm text-foreground"
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
              "rounded-md bg-[#7a2e2a] text-[#fce8e7] hover:bg-[#8f3832]",
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
