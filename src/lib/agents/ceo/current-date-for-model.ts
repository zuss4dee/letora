/**
 * Server wall-clock date for CEO prompts (en-GB). Prevents the model from assuming the wrong year.
 */
export function injectAuthoritativeCurrentDateBlock(): string {
  const formatted = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `Current Date: ${formatted}. Use this exact calendar date for tenancy timing, rent periods, and comparisons to tenancy_start_date. Do not assume or invent a different year or day.`;
}
