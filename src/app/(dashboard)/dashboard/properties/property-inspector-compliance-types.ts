export type PropertyInspectorComplianceSummary = {
  hasRecords: boolean;
  /** Subtext under “Compliance status” in the inspector */
  detailLine: string;
  /** Short uppercase-style badge, or an em dash when there is nothing to report */
  badgeLabel: string;
  /** Grid column: show warning icon when certificates need attention */
  gridAlert: boolean;
};
