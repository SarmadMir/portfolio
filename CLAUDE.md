@AGENTS.md

# sarmadmir.dev — v2 (branch `v2`)

The full portfolio. `main` is the holding page and stays untouched until M1 replaces it.
Read `../command-center/PORTFOLIO_BRIEF.md` first; its stack (§7), budgets (§9) and process (§10) are binding.

## Ports
- Dev and `next start` are pinned to 3200. QA tools use 3100.
- Never start a server on 3001 (Input2PDF) and never let Next pick a port: an unpinned `next dev` falls through to 3001 when 3000 is busy.
