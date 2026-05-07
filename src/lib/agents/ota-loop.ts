/**
 * Bounded multi-step execution for agents (Observe → Think → Act).
 * Rent chaser uses explicit steps in `rent-chaser.ts`; this helper keeps a shared contract.
 *
 * **`runRentChaserAgent`** charges **at most 1 + N** OTA steps: one observe (`list_chaseable_payments`)
 * plus **one consolidated `rent_chase_row` act per processed instalment** (not three sub-steps),
 * so the default ceiling (24) supports ~23 chase rows per invocation without refactoring.
 */

export type OtaStepRecord = {
  name: string;
  stepType: "observe" | "think" | "act";
  toolName?: string;
};

export const DEFAULT_OTA_MAX_STEPS = 24;

export function assertStepBudget(stepCount: number, maxSteps: number = DEFAULT_OTA_MAX_STEPS) {
  if (stepCount > maxSteps) {
    throw new Error(`OTA step budget exceeded (${maxSteps})`);
  }
}
