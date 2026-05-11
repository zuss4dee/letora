/** Default chase email copy when `user_settings` template columns are empty. Uses `{{var}}` tokens. */

export const CHASE_EMAIL_DEFAULTS: Record<
  1 | 2 | 3,
  { subject: string; body: string }
> = {
  1: {
    subject: "Friendly reminder — rent for {{property_address}}",
    body: `Hi {{tenant_name}},

I hope you're well. This is a friendly reminder that your
rent of {{amount_due}} for {{property_address}} was due on
{{due_date}}.

If you've already sent this across, please ignore this
message. Otherwise, could you arrange payment at your
earliest convenience?

Thank you,
{{landlord_name}}
{{org_name}}`,
  },
  2: {
    subject: "Rent overdue — action required for {{property_address}}",
    body: `Hi {{tenant_name}},

I'm following up on my previous message regarding your
outstanding rent of {{amount_due}} for {{property_address}},
which was due on {{due_date}} — now {{days_overdue}} days ago.

Please arrange payment as soon as possible or contact me
to discuss if you're experiencing difficulties.

{{landlord_name}}
{{org_name}}`,
  },
  3: {
    subject: "Formal notice — outstanding rent for {{property_address}}",
    body: `Dear {{tenant_name}},

This is a formal notice that your rent payment of
{{amount_due}} for {{property_address}} remains outstanding.
The payment was due on {{due_date}} and is now
{{days_overdue}} days overdue.

If payment is not received within 7 days, we may need to
begin formal proceedings as outlined in your tenancy
agreement.

Yours sincerely,
{{landlord_name}}
{{org_name}}`,
  },
};
