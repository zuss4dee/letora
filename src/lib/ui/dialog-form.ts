import { cn } from "@/lib/utils";

/** Single-column form dialogs. See docs/ui-guidelines.md */
export const DIALOG_SINGLE_COLUMN_CLASS =
  "max-w-[480px] w-full min-w-0 p-6 sm:max-w-[480px]";

/** Vertical stack of fields inside the form */
export const DIALOG_FORM_STACK_CLASS = "flex flex-col gap-4";

/** Label above input — 8px between label and control */
export const DIALOG_FIELD_CLASS = "flex flex-col gap-2";

/** Footer: cancel left, primary right */
export function dialogFormFooterClass(className?: string) {
  return cn("flex justify-between items-center pt-2", className);
}
