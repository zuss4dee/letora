"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to new referencing_events rows for this user so the dashboard refreshes
 * as soon as an agency inbound email is stored (Resend webhook → DB insert).
 */
export function ReferencingInboundRealtimeListener({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`referencing-events-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "referencing_events",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { direction?: string };
          if (row.direction !== "inbound") return;
          toast.success("New agency reply", {
            description: "Referencing inbox was updated.",
          });
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
