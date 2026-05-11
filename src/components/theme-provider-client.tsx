"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

type ThemeProviderClientProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  enableSystem?: boolean;
  enableColorScheme?: boolean;
  attribute?: "class";
};

const STORAGE_KEY = "letora-theme";
const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function resolveTheme(theme: Theme, enableSystem: boolean): ResolvedTheme {
  if (theme === "dark" || theme === "light") return theme;
  if (!enableSystem) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProviderClient({
  children,
  defaultTheme = "dark",
  storageKey = STORAGE_KEY,
  enableSystem = false,
  enableColorScheme = true,
}: ThemeProviderClientProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  /** Avoid `window` in the initializer — keeps SSR/CSR hydration consistent; inline script paints first. */
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(
    () => (defaultTheme === "light" ? "light" : defaultTheme === "dark" ? "dark" : "light"),
  );
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(storageKey) as Theme | null;
      const nextTheme = storedTheme ?? defaultTheme;
      setThemeState(nextTheme);
      setResolvedTheme(resolveTheme(nextTheme, enableSystem));
    } catch {
      setThemeState(defaultTheme);
      setResolvedTheme(resolveTheme(defaultTheme, enableSystem));
    }
    setMounted(true);
  }, [defaultTheme, enableSystem, storageKey]);

  React.useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    if (enableColorScheme) {
      root.style.colorScheme = resolvedTheme;
    } else {
      root.style.removeProperty("color-scheme");
    }
  }, [enableColorScheme, mounted, resolvedTheme, theme]);

  React.useEffect(() => {
    if (!enableSystem || theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setResolvedTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [enableSystem, theme]);

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      setThemeState(nextTheme);
      setResolvedTheme(resolveTheme(nextTheme, enableSystem));
      try {
        window.localStorage.setItem(storageKey, nextTheme);
      } catch {
        // Ignore storage failures in restricted environments.
      }
    },
    [enableSystem, storageKey],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [resolvedTheme, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProviderClient");
  }
  return context;
}
