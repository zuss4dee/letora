"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_ITEMS: { label: string; hash: string }[] = [
  { label: "Home", hash: "" },
  { label: "Leads", hash: "lead-intelligence" },
  { label: "Rent", hash: "rent-chasing" },
  { label: "Workspace", hash: "ai-operations" },
  { label: "Features", hash: "features" },
  { label: "Pricing", hash: "pricing-plans" },
];

function navHref(hash: string, pathname: string) {
  if (!hash) return "/";
  if (pathname === "/pricing") return `#${hash}`;
  return `/#${hash}`;
}

function JewelryButtonLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-gradient-to-br from-[#FFEABB] to-[#FFC800] font-semibold text-[#3e2e00] shadow-[0_0_28px_-8px_rgba(255,234,187,0.35)] transition-all active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function MarketingHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="fixed left-0 top-0 z-50 w-full min-w-0 border-b border-[#4F4632]/10 bg-[#131313]/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl supports-[backdrop-filter]:bg-[#131313]/70">
      <nav
        className="mx-auto flex h-[3.75rem] max-w-[100vw] items-center justify-between gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6 md:px-8 lg:px-16 xl:px-24"
        aria-label="Primary"
      >
        <Link href="/" className="group flex min-w-0 shrink-0 items-center gap-2.5 leading-none sm:gap-3">
          <Image
            src="/letora-mark.svg"
            alt=""
            width={36}
            height={36}
            className="size-8 shrink-0 sm:size-9"
            unoptimized
          />
          <span className="flex min-w-0 flex-col text-left">
            <span className="font-headline text-[1.125rem] font-semibold tracking-[-0.04em] text-foreground transition-colors group-hover:text-white sm:text-xl">
              Letora
            </span>
            <span className="mt-0.5 hidden font-[family-name:var(--font-inter)] text-[0.55rem] font-medium uppercase tracking-[0.28em] text-muted-foreground sm:block">
              Property OS
            </span>
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-center gap-x-2 md:flex md:gap-x-3 lg:gap-x-5 xl:gap-x-8">
          {NAV_ITEMS.map((item) => {
            const active = item.hash === "" ? isHome : false;
            return (
              <a
                key={item.label + item.hash}
                href={navHref(item.hash, pathname)}
                className={cn(
                  "font-[family-name:var(--font-inter)] text-xs font-semibold tracking-tight transition-opacity md:text-[0.8125rem] xl:text-sm",
                  active ? "text-[#FFEABB] opacity-100" : "text-muted-foreground hover:text-foreground",
                  "whitespace-nowrap",
                )}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:gap-6">
          <Link
            href="/login"
            className="hidden font-[family-name:var(--font-inter)] text-sm font-semibold tracking-tight text-[#FFEABB] transition-opacity hover:opacity-80 sm:inline"
          >
            Log in
          </Link>
          <JewelryButtonLink
            href="/signup"
            className="hidden px-4 py-2 text-xs sm:inline-flex sm:px-6 sm:py-2.5 sm:text-sm"
          >
            Get started
          </JewelryButtonLink>

          <div className="flex items-center gap-1.5 sm:hidden">
            <JewelryButtonLink href="/signup" className="px-3.5 py-2 text-xs font-semibold">
              Start
            </JewelryButtonLink>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl border border-[#4F4632]/30 bg-[#1a1a1a]/80 text-foreground hover:bg-[#252525] hover:text-white"
                  aria-label="Open menu"
                >
                  <Menu className="size-[1.35rem]" strokeWidth={1.75} />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                showCloseButton
                className="flex w-[min(100vw,20rem)] flex-col border-l border-[#4F4632]/25 bg-[#131313] p-0 text-foreground shadow-2xl sm:max-w-sm"
                overlayClassName="bg-black/55 backdrop-blur-[3px]"
              >
                <SheetHeader className="border-b border-[#4F4632]/15 px-5 py-5 text-left">
                  <SheetTitle className="font-headline text-lg font-semibold tracking-[-0.03em] text-foreground">
                    Menu
                  </SheetTitle>
                  <SheetDescription className="font-[family-name:var(--font-inter)] text-xs text-muted-foreground">
                    Jump to a section or sign in.
                  </SheetDescription>
                </SheetHeader>
                <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4" aria-label="Mobile">
                  {NAV_ITEMS.map((item) => (
                    <SheetClose asChild key={item.label + item.hash}>
                      <a
                        href={navHref(item.hash, pathname)}
                        className="rounded-xl px-4 py-3.5 font-[family-name:var(--font-inter)] text-[0.9375rem] font-medium tracking-tight text-foreground transition-colors active:bg-[#1f1f1f]"
                      >
                        {item.label}
                      </a>
                    </SheetClose>
                  ))}
                </nav>
                <div className="border-t border-[#4F4632]/15 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                  <SheetClose asChild>
                    <Link
                      href="/login"
                      className="mb-3 flex min-h-11 items-center justify-center rounded-xl border border-[#4F4632]/35 py-2.5 font-[family-name:var(--font-inter)] text-sm font-semibold text-[#FFEABB]"
                    >
                      Log in
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <JewelryButtonLink href="/signup" className="flex min-h-12 w-full px-4 py-3 text-sm font-semibold">
                      Get started
                    </JewelryButtonLink>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </header>
  );
}
