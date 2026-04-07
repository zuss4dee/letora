import type { ReactNode } from "react";

import { AuthLayoutCanvas } from "@/components/auth/auth-layout-canvas";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AuthLayoutCanvas>
      <div className="relative w-full pt-12 md:pt-0">
        <div className="absolute right-0 top-0 z-20 md:right-0 md:top-0">
          <ThemeToggle />
        </div>
        {children}
      </div>
    </AuthLayoutCanvas>
  );
}
