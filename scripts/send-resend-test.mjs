/**
 * One-off Resend smoke test (same SDK as the app).
 *
 * 1. In `.env.local` set `RESEND_API_KEY` — replace `re_xxxxxxxxx` with your real key from
 *    https://resend.com/api-keys
 * 2. Optional: `RESEND_FROM_EMAIL` (defaults to onboarding@resend.dev for Resend’s test sender)
 * 3. Run:
 *      npm run test:resend -- you@example.com
 *    or:
 *      RESEND_TEST_TO=you@example.com npm run test:resend
 */

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
const to =
  process.env.RESEND_TEST_TO?.trim() ||
  process.argv.slice(2).find((a) => !a.startsWith("-"));

if (!apiKey) {
  console.error(
    "Missing RESEND_API_KEY. Add to .env.local:\n  RESEND_API_KEY=re_xxxxxxxxx\n(replace re_xxxxxxxxx with your real Resend API key.)",
  );
  process.exit(1);
}

if (!to) {
  console.error(
    "Missing recipient. Run:\n  npm run test:resend -- you@example.com\nor set RESEND_TEST_TO in .env.local",
  );
  process.exit(1);
}

const resend = new Resend(apiKey);

const { data, error } = await resend.emails.send({
  from,
  to,
  subject: "Hello World",
  html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
});

if (error) {
  console.error("Resend error:", error);
  process.exit(1);
}

console.log("Sent:", data);
