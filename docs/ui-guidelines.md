# UI guidelines (Letora)

Conventions for forms, dialogs, and layout across the app.

## Dialogs / modals

- **Max width:** `480px` for single-column forms (`max-w-[480px]`).
- **Padding:** `24px` inside the panel (`p-6`).
- Use shadcn **Dialog** with **DialogHeader**, **DialogTitle**, and **DialogDescription**.
- Set **`aria-describedby`** on **DialogContent** to the **`id`** of **DialogDescription** so assistive tech links title and description.

Shared classes live in `src/lib/ui/dialog-form.ts` (`DIALOG_SINGLE_COLUMN_CLASS`, etc.).

## Form fields

- Stack fields **vertically** with **16px** gap (`gap-4`).
- **Label above** the input, never beside (`flex flex-col gap-2` per field — **8px** between label and control).
- Inputs are **full width** inside dialogs (`w-full` on triggers/inputs).
- **Placeholder** text should hint at **format or examples**, not repeat the label (e.g. “e.g. Gas smell from kitchen” rather than only “Issue title”).

## Dropdowns / selects

- Use shadcn **Select** consistently.
- **Properties:** show **address** (and city if helpful), not raw UUIDs.
- **Tenants:** show **name** and **email in brackets**, e.g. `Jane Doe (jane@example.com)`.

## Buttons

- **Primary** action at **bottom right** of the dialog.
- **Destructive** actions use **red** styling (`variant="destructive"` or equivalent).
- **Cancel / close** is **left** of the primary action (same row, space-between).

## Spacing and layout

- Avoid cramped fields; keep at least **8px** between label and input (`gap-2`).
- Use a **two-column** grid only for **short paired** fields (e.g. start date + end date, rent + deposit).
- Everything else in dialogs stays **single column**.
