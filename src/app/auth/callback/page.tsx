export const dynamic = "force-dynamic";

import { Suspense } from "react";

import { AuthCallbackClient } from "./auth-callback-client";

export const metadata = {
  title: "Signing in · Letora",
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
          <p className="font-headline text-sm font-light text-muted-foreground">Signing you in…</p>
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
