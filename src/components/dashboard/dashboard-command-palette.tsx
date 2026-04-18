"use client";

import {
  Bot,
  Building2,
  FileText,
  Key,
  LayoutDashboard,
  Mail,
  Settings,
  Upload,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { useAgentRunners } from "@/components/agents/agent-runners-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

type CommandPaletteOpenContextValue = {
  openPalette: () => void;
};

const CommandPaletteOpenContext = createContext<CommandPaletteOpenContextValue | null>(null);

export function useOpenCommandPalette(): CommandPaletteOpenContextValue {
  const ctx = useContext(CommandPaletteOpenContext);
  if (!ctx) {
    throw new Error("useOpenCommandPalette must be used within CommandPaletteProvider");
  }
  return ctx;
}

function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const {
    runRentChaser,
    runLeadQualifier,
    openContractDrafter,
    openAgentRuns,
    isRentRunning,
    isLeadRunning,
    isContractRunning,
  } = useAgentRunners();

  function closeThen(fn: () => void) {
    onOpenChange(false);
    fn();
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette">
      <CommandInput placeholder="Search pages or run an agent…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Agents">
          <CommandItem
            disabled={isRentRunning}
            onSelect={() => {
              void runRentChaser();
              onOpenChange(false);
            }}
          >
            <Mail className="size-4 text-[#BD9952]" aria-hidden />
            <span>Run Rent Chaser</span>
            {isRentRunning ? (
              <span className="ml-auto font-[family-name:var(--font-inter)] text-[0.65rem] text-muted-foreground">
                Running…
              </span>
            ) : null}
          </CommandItem>
          <CommandItem
            disabled={isLeadRunning}
            onSelect={() => {
              void runLeadQualifier();
              onOpenChange(false);
            }}
          >
            <Users className="size-4 text-[#BD9952]" aria-hidden />
            <span>Run Lead Qualifier</span>
            {isLeadRunning ? (
              <span className="ml-auto font-[family-name:var(--font-inter)] text-[0.65rem] text-muted-foreground">
                Running…
              </span>
            ) : null}
          </CommandItem>
          <CommandItem
            disabled={isContractRunning}
            onSelect={() => {
              openContractDrafter();
              onOpenChange(false);
            }}
          >
            <FileText className="size-4 text-[#BD9952]" aria-hidden />
            <span>Run Contract Drafter</span>
            {isContractRunning ? (
              <span className="ml-auto font-[family-name:var(--font-inter)] text-[0.65rem] text-muted-foreground">
                Running…
              </span>
            ) : null}
          </CommandItem>
          <CommandItem
            onSelect={() => {
              openAgentRuns();
              onOpenChange(false);
            }}
          >
            <Bot className="size-4 text-muted-foreground" aria-hidden />
            <span>Open agent activity log</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => closeThen(() => router.push("/dashboard"))}>
            <LayoutDashboard className="size-4 opacity-60" aria-hidden />
            Home
          </CommandItem>
          <CommandItem onSelect={() => closeThen(() => router.push("/dashboard/properties"))}>
            <Building2 className="size-4 opacity-60" aria-hidden />
            Properties
          </CommandItem>
          <CommandItem onSelect={() => closeThen(() => router.push("/dashboard/tenants"))}>
            <Users className="size-4 opacity-60" aria-hidden />
            Tenants
          </CommandItem>
          <CommandItem onSelect={() => closeThen(() => router.push("/dashboard/contracts"))}>
            <FileText className="size-4 opacity-60" aria-hidden />
            Contracts
          </CommandItem>
          <CommandItem onSelect={() => closeThen(() => router.push("/dashboard/leads"))}>
            <UserPlus className="size-4 opacity-60" aria-hidden />
            Leads
          </CommandItem>
          <CommandItem onSelect={() => closeThen(() => router.push("/dashboard/import"))}>
            <Upload className="size-4 opacity-60" aria-hidden />
            Batch import
          </CommandItem>
          <CommandItem onSelect={() => closeThen(() => router.push("/dashboard/rent-tracker"))}>
            <Key className="size-4 opacity-60" aria-hidden />
            Rent tracker
          </CommandItem>
          <CommandItem onSelect={() => closeThen(() => router.push("/dashboard/emails"))}>
            <Mail className="size-4 opacity-60" aria-hidden />
            Emails
          </CommandItem>
          <CommandItem onSelect={() => closeThen(() => router.push("/dashboard/maintenance"))}>
            <Wrench className="size-4 opacity-60" aria-hidden />
            Maintenance
          </CommandItem>
          <CommandItem onSelect={() => closeThen(() => router.push("/dashboard/settings"))}>
            <Settings className="size-4 opacity-60" aria-hidden />
            Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandPaletteOpenContext.Provider value={{ openPalette }}>
      {children}
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </CommandPaletteOpenContext.Provider>
  );
}
