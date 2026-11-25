import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lab",
  description: "Prototype slots for the cube, the field, the lens and the fold. Not part of the site.",
  // Prototypes: never indexed, never in the sitemap (tests/lab.test.ts).
  robots: { index: false, follow: false },
};

export default function LabLayout({ children }: LayoutProps<"/lab">) {
  return (
    <main className="flex flex-1 flex-col gap-8 px-4 py-12 md:px-16 md:py-16">
      <Link
        href="/lab"
        className="self-start font-mono text-label text-ink-2 uppercase transition-colors t-fast ease-standard hover:text-ink"
      >
        Lab
      </Link>
      {children}
    </main>
  );
}
