const copy = {
  login: {
    kicker: "Quiet power",
    headline: "Calm operations beat busy dashboards.",
    body:
      "Rent, maintenance, and leads in one editorial workspace, tuned for UK landlords who need precision without noise.",
  },
  signup: {
    kicker: "Start sharp",
    headline: "Your portfolio deserves a single command surface.",
    body:
      "Confirm your email, open the workspace, and let agents handle the repetitive rhythm while you stay in control.",
  },
} as const;

export function AuthEditorialAside({ variant }: { variant: keyof typeof copy }) {
  const c = copy[variant];
  return (
    <div className="relative flex h-full min-h-[560px] flex-col justify-between overflow-hidden border-l border-[rgb(72_72_72_/0.12)] bg-gradient-to-br from-[#141312] via-[#0e0e0e] to-[#121110] p-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(72_72_72_/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(72_72_72_/0.06)_1px,transparent_1px)] bg-[size:28px_28px] opacity-80"
        aria-hidden
      />
      <div className="relative z-[1] space-y-6">
        <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#BD9952]/90">
          {c.kicker}
        </p>
        <h2 className="font-headline max-w-[20ch] text-2xl font-extralight leading-snug tracking-[-0.03em] text-[#E7E5E4] md:text-[1.65rem]">
          {c.headline}
        </h2>
        <p className="max-w-md font-[family-name:var(--font-inter)] text-sm font-light leading-relaxed text-[#ACABAA]">
          {c.body}
        </p>
      </div>
      <div className="relative z-[1] mt-12 border-t border-[rgb(72_72_72_/0.1)] pt-8">
        <p className="font-[family-name:var(--font-inter)] text-[0.65rem] uppercase tracking-[0.18em] text-[#6b6a69]">
          Letora · UK property operations
        </p>
      </div>
    </div>
  );
}
