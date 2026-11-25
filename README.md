# sarmadmir.dev — v2

The full portfolio, built on branch `v2`. `main` is the holding page that production serves until M1.

The brief is `../command-center/PORTFOLIO_BRIEF.md` (workspace root). Its stack, budgets and process sections are binding. `CLAUDE.md` in this folder maps the code and lists the rules.

```bash
npm install
npm run dev            # http://localhost:3200 (pinned; never 3001)
npm run tokens         # regenerate src/styles/tokens.css from tokens.json

npm run lint
npm run build
npm run typecheck      # after a build: route types live in .next/types
npm run test:run       # Vitest
npm run qa:crawl       # route crawl at 375 / 768 / 1440 (builds first)
npm run e2e            # Playwright runtime specs (needs a build)
npm run qa:lighthouse  # brief §9 budgets on / (needs a build, Node 22.19+)
```

`/` is the dev home (token swatches and the type scale). `/lab` holds the prototype slots: cube, field, lens, fold.
