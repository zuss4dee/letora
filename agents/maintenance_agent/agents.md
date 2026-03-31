# Maintenance / Complaints Agent

## Four questions (answer before implementation)

**OUTCOME:** Tenant receives an acknowledgement email confirming their request was received. Landlord receives a summary with the AI triage category and recommended action. `maintenance_requests` row is updated with triage category.

**INPUTS:** `maintenanceRequestId`, `propertyId`, `tenantId`, `tenantEmail`, `tenantName`, `propertyAddress`, `issueDescription`, `priority`, `userId`

**TOOLS:** `send_email`, `update_maintenance_status`, `log_agent_step`, `fetch_property_details`, `fetch_tenant_details`

**NEVER:** Promise a specific repair date to the tenant. Never commit to a contractor cost. Never skip tenant acknowledgement even if auto_send is off — always create the draft. Always flag urgent-safety issues with a dashboard alert regardless of auto_send setting. Never skip the audit log.

---

## Behaviour

- Triage every new maintenance request using the skills in `skills/`.
- Draft tenant acknowledgement and landlord summary emails; all sends go through the central email tool (draft first; auto-send respects `auto_send_maintenance_updates`).
- **Urgent-safety** issues always create a visible dashboard safety alert in addition to emails.
- Log every observe / think / act step to `agent_run_steps`.
- Cap the OTA loop at **5** steps per run.
