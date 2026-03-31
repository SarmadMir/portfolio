import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Sarmad Mir — Software Engineer",
    template: "%s | Sarmad Mir",
  },
  description:
    "Software engineer & creative problem solver. Building tools that matter — from Chrome extensions to PDF generation systems.",
  metadataBase: new URL("https://sarmadmir.dev"),
  openGraph: {
    title: "Sarmad Mir — Software Engineer",
    description:
      "Software engineer & creative problem solver. Building tools that matter.",
    url: "https://sarmadmir.dev",
    siteName: "Sarmad Mir",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sarmad Mir — Software Engineer",
    description:
      "Software engineer & creative problem solver. Building tools that matter.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col antialiased">
        <ThemeProvider>
          <Navigation />
          <main className="flex-1 pt-16">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
