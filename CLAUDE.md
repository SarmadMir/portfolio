@AGENTS.md

# sarmadmir.dev — holding page

This repo serves the holding page at https://sarmadmir.dev. The full portfolio (V2) is a new repo; its brief is `../command-center/PORTFOLIO_BRIEF.md` and the backlog is `../command-center/BACKLOG.md` (workspace root). Do not build V2 here.

## What's here
- Next.js 16 App Router + TypeScript. Plain CSS in `src/app/globals.css` (no Tailwind), system font stack, no client-side JS beyond React itself.
- Routes: `/` (holding page) and the 404 (`src/app/not-found.tsx`). Metadata files: `robots.ts`, `sitemap.ts`, `icon0.svg`, `icon1.png`, `apple-icon.png`.
- `src/config/site.ts` is the single source of truth for name, role, description, links and footer copy.
- `src/components/Wordmark.tsx` is the `<SM />` mark. Keep it.
- `next.config.ts` sets the security headers (CSP, XCTO, XFO, Referrer-Policy, Permissions-Policy). Vercel adds HSTS.

## Rules
- Copy: facts only. No character adjectives, no emoji.
- Design: respects `prefers-color-scheme`; fits one viewport with no desktop scroll; nothing animated beyond the 200ms fade-in, which is gated on `prefers-reduced-motion`.
- Release gate: `next build` green, Lighthouse ≥95 on all four categories (mobile and desktop).
- Branch `v2` exists on this repo but is unused; V2 work happens in the new repo.

## Commands
- `npm run dev` — port 3000. The workspace uses 3000/3001 for other servers; if busy, `npx next dev -p 3100`.
- `npm run build`, `npm run lint`, `npx tsc --noEmit`.

## Deploy
Vercel project `portfolio` (GitHub integration) deploys `main` to production: sarmadmir.dev and www.sarmadmir.dev.
