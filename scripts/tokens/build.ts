/**
 * scripts/tokens/build.ts — writes src/styles/tokens.css from src/styles/tokens.json.
 *
 *   npm run tokens
 *
 * tokens.css is generated: change tokens.json (or the renderer in
 * src/lib/tokens/css.ts) and run this, never edit the CSS by hand.
 */
import { writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { renderTokensCss } from "../../src/lib/tokens/css";
import { readTokens } from "../../src/lib/tokens/model";

const out = resolve(process.cwd(), "src/styles/tokens.css");
const model = readTokens();
writeFileSync(out, renderTokensCss(model));

const tokens = model.sections.reduce((total, section) => total + section.tokens.length, 0);
const styles = model.typeGroups.reduce((total, group) => total + group.styles.length, 0);
console.log(`[tokens] ${model.name} v${model.version}: ${tokens} tokens, ${styles} type styles → ${relative(process.cwd(), out)}`);
