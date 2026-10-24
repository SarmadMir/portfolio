import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main className="main">
      <Wordmark href="/" />
      <h1 className="name">Page not found</h1>
      <p className="role">There is nothing at this address.</p>
      <nav className="links" aria-label="Links">
        <ul>
          <li>
            <Link href="/">Back to sarmadmir.dev</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
