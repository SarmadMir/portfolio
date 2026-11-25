import type { Metadata } from "next";
import { site } from "@/config/site";
import { themeInitScript } from "@/lib/theme/theme";
import { fontVariables } from "@/styles/fonts";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script below sets data-theme before React hydrates.
    <html lang="en" className={`${fontVariables} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>
          {/* Page content sits at z-desktop, above the shared canvas at z-field. */}
          <div className="relative z-(--z-desktop) flex min-h-dvh flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
