import { redirect } from "next/navigation";

/** Alias for marketing / checklist links that use `/dashboard/agents/approvals`. */
export default function AgentsApprovalsRedirectPage() {
  redirect("/dashboard/approvals");
}
