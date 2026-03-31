# Skill: draft_chase_email

## Goal

Produce a single rent reminder email for one tenancy payment row.

## Inputs

- Tenant name, property address (full), amount owed (GBP), days overdue.
- Landlord/business name, tone, sign-off, whether to offer a payment plan, custom instructions.

## Steps

1. Open with a polite, professional line appropriate to the tone (professional_firm / friendly_polite / formal_legal).
2. State the **amount** and **property** clearly.
3. Reference lateness using **days overdue** without aggressive language.
4. Request payment or contact; if payment plan is enabled, offer a short line on arranging a plan.
5. Close with the configured sign-off and business identity.

## Success criteria

- Subject line under ~80 characters, specific to rent.
- Body is plain text suitable for email (no markdown in output JSON strings).
