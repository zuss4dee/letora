import { z } from "zod";

export const EMAIL_INVALID_MESSAGE = "Enter a valid email address.";

/** Trims; rejects empty strings and malformed addresses (Zod email format). */
export const requiredEmailSchema = z
  .string()
  .trim()
  .min(1, EMAIL_INVALID_MESSAGE)
  .email(EMAIL_INVALID_MESSAGE);

/** After trim: empty string or a valid email — for optional contact fields. */
export const optionalEmailSchema = z
  .string()
  .trim()
  .refine((s) => s.length === 0 || z.string().email().safeParse(s).success, {
    message: EMAIL_INVALID_MESSAGE,
  });

export function isValidEmailAddress(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  return z.string().email().safeParse(t).success;
}

/** True for empty/whitespace-only or for a valid email. */
export function isValidEmailOrEmpty(value: string): boolean {
  const t = value.trim();
  if (!t) return true;
  return z.string().email().safeParse(t).success;
}
