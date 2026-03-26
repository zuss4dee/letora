"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

interface SubscriptionState {
  status: string | null;
  plan: string | null;
  periodEnd: string | null;
  isActive: boolean;
  loading: boolean;
}

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({
    status: null,
    plan: null,
    periodEnd: null,
    isActive: false,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();
    const fetchSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const { data } = await supabase
        .from("user_settings")
        .select("subscription_status, subscription_plan, subscription_period_end")
        .eq("user_id", user.id)
        .single();
      setState({
        status: data?.subscription_status ?? null,
        plan: data?.subscription_plan ?? null,
        periodEnd: data?.subscription_period_end ?? null,
        isActive:
          data?.subscription_status === "active" ||
          data?.subscription_status === "trialing",
        loading: false,
      });
    };
    void fetchSubscription();
  }, []);

  return state;
}

