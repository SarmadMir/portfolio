# sarmadmir.dev — v2

The full portfolio, built on branch `v2`. `main` is the holding page that production serves until M1.

The brief is `../command-center/PORTFOLIO_BRIEF.md` (workspace root). Its stack, budgets and process sections are binding.

```bash
npm install
npm run dev        # http://localhost:3200 (pinned; never 3001)
npm run build
npm run typecheck  # after a build: route types live in .next/types
npm run lint
```
