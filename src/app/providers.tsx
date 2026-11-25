import type { ReactNode } from "react";
import { SmoothScroll } from "@/lib/motion/SmoothScroll";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { CanvasHost } from "@/lib/three/CanvasHost";

/** The app-wide runtime: theme, the one scroll runtime, the one WebGL canvas. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SmoothScroll>
        <CanvasHost>{children}</CanvasHost>
      </SmoothScroll>
    </ThemeProvider>
  );
}
