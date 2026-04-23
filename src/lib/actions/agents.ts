"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type AgentRun = {
  id: string;
  agentType: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export async function saveContractDraft(contractId: string, contractText: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("contracts")
    .update({
      special_clauses: contractText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId)
    .eq("user_id", user.id)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Contract not found");

  revalidatePath("/dashboard/contracts");
  revalidatePath(`/dashboard/contracts/${contractId}`);
}

export async function getAgentRuns(): Promise<AgentRun[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("agent_runs")
    .select("id, agent_type, status, payload, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    if (error) console.warn("[getAgentRuns]", error.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id as string,
    agentType: String(row.agent_type ?? ""),
    status: String(row.status ?? ""),
    payload: (row.payload && typeof row.payload === "object"
      ? (row.payload as Record<string, unknown>)
      : {}) as Record<string, unknown>,
    createdAt: (row.created_at as string) ?? "",
  }));
}
