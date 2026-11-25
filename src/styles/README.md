# Styles

| File | What it is |
| --- | --- |
| `tokens.json` | The Sarmad OS design system tokens, version 2. Copied unchanged from `project/tokens.json` in the "Sarmad OS" Design System artifact on 2026-11-25 (sha256 `50a50d41…27a8c`). |
| `tokens.css` | Generated from `tokens.json`. One CSS variable per token, the Tailwind `@theme` aliases from the system's build notes, and the `t-fast` / `t-base` / `t-slow` utilities. |

`tokens.css` is never edited by hand. To change a value, change it in the design system, replace `tokens.json`, run `npm run tokens`, and commit both files. `tests/tokens.test.ts` fails when the two drift apart, and `tests/theme.test.ts` checks what the utilities compile to.

Theming: dark values sit on `:root` and `[data-theme="dark"]`, light values on `[data-theme="light"]`. Utilities read the variables directly, so `data-theme` also works on any nested element.

Fonts are not in `tokens.css`: `next/font` sets `--font-display`, `--font-text` and `--font-mono` on `<html>` (see `src/styles/fonts.ts`).
