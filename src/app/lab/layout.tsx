import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lab",
  description: "Prototype slots for the cube, the field, the lens and the fold. Not part of the site.",
  // Prototypes: never indexed, never in the sitemap (tests/lab.test.ts).
  robots: { index: false, follow: false },
};

const crumb = "transition-colors hover:text-ink";

export default function LabLayout({ children }: LayoutProps<"/lab">) {
  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 px-4 py-12 md:px-16 md:py-16">
      <nav aria-label="Breadcrumb" className="flex gap-2 font-mono text-label text-ink-2 uppercase">
        <Link href="/" className={crumb}>
          Tokens
        </Link>
        <span aria-hidden>/</span>
        <Link href="/lab" className={crumb}>
          Lab
        </Link>
      </nav>
      {children}
    </main>
  );
}
