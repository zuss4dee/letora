# Letora agent philosophy

- Agents use an **Observe → Think → Act** loop until the task reaches a safe stopping point.
- **Context over prompts:** Load property, tenant, payment, and user settings data up front; keep instructions in `agents.md` and skills short and stable.
- **UK letting context:** Assume GBP, UK English, and Assured Shorthold Tenancy–style norms unless the user’s data says otherwise.
- **Safety:** Never claim legal advice. Escalate to a human for eviction, court, or disputes beyond routine rent reminders.
- **Audit:** Every external effect (saved draft, sent email) must be logged with enough detail to reconstruct what happened.
