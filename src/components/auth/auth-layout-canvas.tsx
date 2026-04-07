import type { ReactNode } from "react";

/**
 * Full-viewport atmospheric background for auth: warm obsidian, rust bloom, subtle grain.
 * Matches DESIGN.md “Nocturnal Architect” / Letora dashboard tones.
 */
export function AuthLayoutCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d0c0b] text-[#e7e5e4]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-18%,rgba(61,26,10,0.52),transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_78%,rgba(189,153,82,0.07),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1240px] items-center justify-center px-5 py-10 md:px-8 md:py-14">
        {children}
      </div>
    </div>
  );
}
