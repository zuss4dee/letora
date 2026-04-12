import Image from "next/image";

export function AuthBrandMark() {
  return (
    <header className="space-y-3 text-center">
      <div className="flex justify-center">
        <Image
          src="/letora-logo.svg"
          alt="Letora"
          width={176}
          height={40}
          className="h-9 w-auto dark:hidden"
          priority
          unoptimized
        />
        <Image
          src="/letora-logo-dark.svg"
          alt="Letora"
          width={176}
          height={40}
          className="hidden h-9 w-auto dark:block"
          priority
          unoptimized
        />
      </div>
      <p className="font-[family-name:var(--font-inter)] text-[0.65rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Property Operating System
      </p>
    </header>
  );
}
