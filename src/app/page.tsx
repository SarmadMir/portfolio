import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { site } from "@/config/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  jobTitle: site.role,
  url: site.url,
  sameAs: site.links.filter((link) => link.rel === "me").map((link) => link.href),
};

export default function Home() {
  return (
    <main className="main">
      <Wordmark />
      <h1 className="name">{site.name}</h1>
      <p className="role">{site.role}</p>
      <nav className="links" aria-label="Links">
        <ul>
          {site.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} rel={link.rel}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <script
        type="application/ld+json"
        // Static, build-time data from src/config/site.ts; no user input reaches this.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </main>
  );
}
