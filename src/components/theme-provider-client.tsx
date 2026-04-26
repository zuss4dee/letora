"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderClientProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProviderClient({ children, ...props }: ThemeProviderClientProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid rendering next-themes internals (including script injection) during pre-mount render.
  if (!mounted) return <>{children}</>;

  return (
    <NextThemesProvider
      disableTransitionOnChange
      storageKey="letora-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
