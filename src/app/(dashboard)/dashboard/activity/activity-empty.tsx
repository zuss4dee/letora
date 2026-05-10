"use client";

import { Activity } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export function ActivityLogEmptyState() {
  return (
    <EmptyState
      icon={Activity}
      title="No activity yet"
      description="Actions taken in Letora will be logged here."
    />
  );
}
