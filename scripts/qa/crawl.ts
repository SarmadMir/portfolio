/**
 * scripts/qa/crawl.ts — QA route crawl against the PRODUCTION build.
 * Ported from input2pdf-website/scripts/qa/crawl.ts; same shape, same checks.
 *
 *   npm run qa:crawl                  # next build → next start -p 3100 → crawl → stop server
 *   npm run qa:crawl -- --no-build    # reuse the existing .next build
 *   npm run qa:crawl -- --port 3102   # or QA_PORT=3102 (3001 is refused)
 *   npm run qa:crawl -- --out <path>  # report path (default: ../command-center/session-log/<today>-v2-crawl.md)
 *   npm run qa:crawl -- --routes /,/lab --viewports 375   # quick re-check (no link discovery)
 *   npm run qa:crawl -- --strict      # exit 1 when a blocker is found (CI gate)
 *
 * Routes: every src/app/** page (dynamic [slug] segments expanded from
 * DYNAMIC_SEGMENTS), plus any internal link discovered while crawling.
 *
 * Per route × viewport (375 / 768 / 1440): HTTP status, console errors /
 * warnings / uncaught exceptions, internal links (<a href> → status ≥ 400),
 * same-origin asset failures, horizontal overflow (scrollWidth > the intended
 * viewport, with the widest unclipped elements named), empty <title> / meta
 * description, missing og:image, more than one <canvas> (brief §9: one WebGL
 * context per page).
 *
 * Severity: blocker = route status ≥ 400, console error / page error, failing
 *           internal link or asset, horizontal overflow, empty title/description,
 *           more than one canvas.
 *           polish  = console warning, missing og:image.
 *
 * QA tool first: it writes one findings table and exits 0 whenever the crawl
 * itself ran. With --strict it exits 1 on any blocker, which is how CI uses it.
 */
import { spawn, spawnSync, execFileSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { chromium, type BrowserContext } from "@playwright/test";

// ── configuration ─────────────────────────────────────────────────────────────

const ROOT = process.cwd();
if (!existsSync(resolve(ROOT, "package.json")) || !existsSync(resolve(ROOT, "src/app"))) {
  console.error("[qa:crawl] run from the portfolio root (npm run qa:crawl).");
  process.exit(1);
}

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const NO_BUILD = argv.includes("--no-build");
const STRICT = argv.includes("--strict");
const PORT = Number(flag("--port") ?? process.env.QA_PORT ?? 3100);
if (PORT === 3001) {
  console.error("[qa:crawl] port 3001 belongs to the Input2PDF dev server. Pick another with --port.");
  process.exit(1);
}
const BASE = `http://localhost:${PORT}`;
const TODAY = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; // local date, not UTC
})();
/** The workspace keeps session records in ../command-center; a lone checkout (CI) has none. */
const SESSION_LOG = resolve(ROOT, "..", "command-center", "session-log");
const OUT = resolve(
  flag("--out") ??
    (existsSync(SESSION_LOG) ? join(SESSION_LOG, `${TODAY}-v2-crawl.md`) : join(ROOT, "qa-report", "crawl.md")),
);
const APP_DIR = resolve(ROOT, "src/app");

const VIEWPORTS = [375, 768, 1440] as const;
type Viewport = (typeof VIEWPORTS)[number];
const HEIGHT: Record<Viewport, number> = { 375: 812, 768: 1024, 1440: 900 };
const viewportArg = flag("--viewports");
const ACTIVE_VIEWPORTS: readonly Viewport[] = viewportArg
  ? VIEWPORTS.filter((v) => viewportArg.split(",").map(Number).includes(v))
  : VIEWPORTS;
const ROUTE_FILTER = flag("--routes")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;

/** Dynamic segments → the slugs to expand them with (from config, not guesses). None yet. */
const DYNAMIC_SEGMENTS: Record<string, string[]> = {};

/** Vercel Analytics / Speed Insights load /_vercel/* scripts that only exist on Vercel. */
const EXPECTED_LOCAL_404 = /^\/_vercel\//;

/** Env the build/server needs. Missing → QA placeholder for the crawl server only. None yet (Resend arrives in M1). */
const REQUIRED_ENV: readonly string[] = [];

// ── findings ──────────────────────────────────────────────────────────────────

type Severity = "blocker" | "polish";
interface Finding {
  route: string;
  viewport: Viewport | "—";
  check: string;
  detail: string;
  severity: Severity;
  hint: string;
}
const findings: Finding[] = [];
const add = (f: Finding) => findings.push(f);

// ── routes ────────────────────────────────────────────────────────────────────

interface Route {
  path: string;
  file: string;
  source: "app" | "link";
}

function enumerateAppRoutes(): Route[] {
  const out: Route[] = [];
  const walk = (dir: string, segs: string[]) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (segs.length === 0 && entry === "api") continue;
        if (entry.startsWith("_")) continue; // private folder, not routable
        walk(full, /^\(.+\)$/.test(entry) ? segs : [...segs, entry]);
      } else if (/^page\.(tsx|jsx|mdx)$/.test(entry)) {
        out.push({ path: "/" + segs.join("/"), file: relative(ROOT, full), source: "app" });
      }
    }
  };
  walk(APP_DIR, []);
  return out;
}

function expandDynamic(routes: Route[]): Route[] {
  const out: Route[] = [];
  for (const r of routes) {
    if (!r.path.includes("[")) {
      out.push(r);
      continue;
    }
    const slugs = DYNAMIC_SEGMENTS[r.path];
    if (!slugs) {
      add({
        route: r.path,
        viewport: "—",
        check: "route-enumeration",
        detail: "dynamic route has no slug source in DYNAMIC_SEGMENTS — not crawled",
        severity: "polish",
        hint: "scripts/qa/crawl.ts",
      });
      continue;
    }
    for (const slug of slugs) {
      out.push({ path: r.path.replace(/\[[^\]]+\]/, slug), file: r.file, source: "app" });
    }
  }
  return out;
}

/** Best-effort file hint for a path discovered via a link. */
function fileForPath(path: string, known: Route[]): string {
  const direct = join("src/app", path, "page.tsx");
  if (existsSync(resolve(ROOT, direct))) return direct;
  for (const pattern of Object.keys(DYNAMIC_SEGMENTS)) {
    const re = new RegExp("^" + pattern.replace(/\[[^\]]+\]/, "[^/]+") + "$");
    if (re.test(path)) {
      const k = known.find((r) => r.file.includes(pattern.split("/").slice(-1)[0]));
      if (k) return k.file;
      return join("src/app", pattern, "page.tsx");
    }
  }
  return "(linked, no page file found)";
}

// ── server lifecycle ──────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function isListening(): Promise<boolean> {
  try {
    await fetch(BASE, { method: "HEAD" });
    return true;
  } catch {
    return false;
  }
}

let server: ChildProcess | null = null;
const serverLog: string[] = [];

function stopServer(signal: NodeJS.Signals = "SIGTERM") {
  if (!server || server.exitCode !== null || !server.pid) return;
  try {
    // detached → own process group, so the signal reaches next's child worker too.
    process.kill(-server.pid, signal);
  } catch {
    server.kill(signal);
  }
}
process.on("exit", () => stopServer());
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(sig, () => {
    stopServer();
    process.exit(130);
  });
}

async function startServer(env: NodeJS.ProcessEnv): Promise<void> {
  server = spawn(resolve(ROOT, "node_modules/.bin/next"), ["start", "-p", String(PORT)], {
    cwd: ROOT,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const onData = (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) if (line.trim()) serverLog.push(line);
  };
  server.stdout?.on("data", onData);
  server.stderr?.on("data", onData);

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`next start exited early (${server.exitCode}):\n${serverLog.join("\n")}`);
    }
    if (await isListening()) return;
    await sleep(500);
  }
  throw new Error("next start did not become ready within 60s");
}

async function shutdownServer(): Promise<void> {
  if (!server) return;
  stopServer("SIGTERM");
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (!(await isListening())) return;
    await sleep(250);
  }
  stopServer("SIGKILL");
  await sleep(500);
}

// ── crawl ─────────────────────────────────────────────────────────────────────

interface LinkCheck {
  status: Map<string, number>;
  discover: (path: string) => void;
}

function normalizeInternal(href: string): string | null {
  if (!href || href.startsWith("#") || /^(mailto|tel|sms|javascript):/i.test(href)) return null;
  let path: string;
  if (href.startsWith("/") && !href.startsWith("//")) path = href;
  else if (href.startsWith(BASE)) path = href.slice(BASE.length) || "/";
  else return null; // external
  path = path.split("#")[0].split("?")[0] || "/";
  return path;
}

async function crawlRoute(ctx: BrowserContext, route: Route, vw: Viewport, links: LinkCheck) {
  const page = await ctx.newPage();
  const consoleHits: { kind: "error" | "warning" | "pageerror"; text: string }[] = [];
  page.on("console", (m) => {
    const t = m.type();
    if (t !== "error" && t !== "warning") return;
    const at = m.location()?.url ?? "";
    if (at.startsWith(BASE) && EXPECTED_LOCAL_404.test(at.slice(BASE.length))) return;
    consoleHits.push({ kind: t, text: m.text() });
  });
  page.on("pageerror", (e) => consoleHits.push({ kind: "pageerror", text: e.message }));

  const assetFailures = new Set<string>();
  page.on("response", (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) || r.request().isNavigationRequest()) return;
    const p = u.slice(BASE.length).split("?")[0];
    if (r.status() >= 400 && !EXPECTED_LOCAL_404.test(p)) assetFailures.add(`${r.status()} ${p}`);
  });
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (!u.startsWith(BASE)) return;
    const p = u.slice(BASE.length).split("?")[0];
    if (!EXPECTED_LOCAL_404.test(p)) {
      assetFailures.add(`request failed ${p} (${r.failure()?.errorText ?? "?"})`);
    }
  });

  let status = 0;
  try {
    const resp = await page.goto(BASE + route.path, { waitUntil: "networkidle", timeout: 45_000 });
    status = resp?.status() ?? 0;
  } catch (e) {
    add({
      route: route.path,
      viewport: vw,
      check: "navigation",
      detail: String(e).split("\n")[0],
      severity: "blocker",
      hint: route.file,
    });
    await page.close();
    return;
  }
  if (status >= 400 || status === 0) {
    add({
      route: route.path,
      viewport: vw,
      check: "http-status",
      detail: `HTTP ${status || "no response"}`,
      severity: "blocker",
      hint: route.file,
    });
  }
  await page.waitForTimeout(500);

  // Scroll through the page (lazy content, viewport-gated scenes) and keep the
  // widest layout seen; then name the unclipped elements that poke past the
  // viewport at that scroll position. Compare against the INTENDED viewport
  // width, not window.innerWidth: under mobile emulation Chromium widens the
  // layout viewport to fit overflowing content (innerWidth reads 478 on a 375
  // screen), which is precisely the zoomed-out-page bug we are hunting.
  const overflow = await page.evaluate(async (vw) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const measure = () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
    let worst = measure();
    let worstY = 0;
    const step = Math.round(window.innerHeight * 0.8);
    const total = document.documentElement.scrollHeight;
    for (let y = step; y <= total; y += step) {
      window.scrollTo(0, y);
      await wait(120);
      const m = measure();
      if (m > worst) {
        worst = m;
        worstY = y;
      }
    }
    window.scrollTo(0, worstY);
    await wait(200);
    const isClipped = (el: Element) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        if (getComputedStyle(p).overflowX !== "visible") return true;
        p = p.parentElement;
      }
      return false;
    };
    const culprits = Array.from(document.querySelectorAll("body *"))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => r.width > 0 && r.right > vw + 1 && !isClipped(el))
      .sort((a, b) => b.r.right - a.r.right)
      .slice(0, 4)
      .map(({ el, r }) => {
        const cls = (el.getAttribute("class") ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".");
        return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} (+${Math.round(r.right - vw)}px)`;
      });
    // Counted after the scroll pass, so viewport-gated scenes have had the chance to mount.
    const canvases = document.querySelectorAll("canvas").length;
    window.scrollTo(0, 0);
    return { worst, worstY, culprits, canvases };
  }, vw);
  if (overflow.worst > 0) {
    add({
      route: route.path,
      viewport: vw,
      check: "horizontal-overflow",
      detail: `scrollWidth exceeds the ${vw}px viewport by ${overflow.worst}px (at scrollY ${overflow.worstY}); widest unclipped: ${
        overflow.culprits.join(", ") || "n/a"
      }`,
      severity: "blocker",
      hint: "src/app/globals.css",
    });
  }
  if (overflow.canvases > 1) {
    add({
      route: route.path,
      viewport: vw,
      check: "webgl-contexts",
      detail: `${overflow.canvases} <canvas> elements; the budget is one WebGL context per page`,
      severity: "blocker",
      hint: "src/lib/three/CanvasHost.tsx (scenes use useSharedCanvas + <View>)",
    });
  }

  const meta = await page.evaluate(() => ({
    title: document.title.trim(),
    description: (document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "").trim(),
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "",
    hrefs: Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") ?? ""),
  }));
  const metaHint = route.file.includes("(") ? "src/app/layout.tsx" : `${route.file} (metadata) / src/app/layout.tsx`;
  if (!meta.title) {
    add({ route: route.path, viewport: vw, check: "meta", detail: "empty <title>", severity: "blocker", hint: metaHint });
  }
  if (!meta.description) {
    add({
      route: route.path,
      viewport: vw,
      check: "meta",
      detail: "empty or missing meta description",
      severity: "blocker",
      hint: metaHint,
    });
  }
  if (!meta.ogImage) {
    add({ route: route.path, viewport: vw, check: "og-image", detail: "no og:image meta tag", severity: "polish", hint: metaHint });
  }

  for (const hit of consoleHits) {
    add({
      route: route.path,
      viewport: vw,
      check: hit.kind === "warning" ? "console-warning" : hit.kind === "pageerror" ? "uncaught-exception" : "console-error",
      detail: hit.text.replace(/\s+/g, " ").slice(0, 300),
      severity: hit.kind === "warning" ? "polish" : "blocker",
      hint: route.file,
    });
  }
  for (const a of assetFailures) {
    add({ route: route.path, viewport: vw, check: "asset", detail: a, severity: "blocker", hint: route.file });
  }

  // Internal links: status-check each unique path once; crawl newly discovered pages.
  const internal = new Set<string>();
  for (const href of meta.hrefs) {
    const p = normalizeInternal(href);
    if (p) internal.add(p);
  }
  for (const path of internal) {
    let st = links.status.get(path);
    if (st === undefined) {
      try {
        st = (await ctx.request.get(BASE + path, { maxRedirects: 5 })).status();
      } catch {
        st = 0;
      }
      links.status.set(path, st);
    }
    if (st >= 400 || st === 0) {
      add({
        route: route.path,
        viewport: vw,
        check: "internal-link",
        detail: `<a href="${path}"> → HTTP ${st || "no response"}`,
        severity: "blocker",
        hint: route.file,
      });
    } else if (!path.startsWith("/api/") && !/\.[a-z0-9]{2,5}$/i.test(path)) {
      links.discover(path);
    }
  }

  await page.close();
}

// ── report ────────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

function writeReport(opts: { routes: Route[]; linkCount: number; injected: string[]; chromium: string; commit: string }) {
  // Group identical findings across viewports → one row.
  const groups = new Map<string, { f: Finding; viewports: Set<Viewport | "—"> }>();
  for (const f of findings) {
    const key = [f.route, f.check, f.detail, f.severity, f.hint].join("\u0000");
    const g = groups.get(key) ?? { f, viewports: new Set() };
    g.viewports.add(f.viewport);
    groups.set(key, g);
  }
  const order: Record<Severity, number> = { blocker: 0, polish: 1 };
  const rows = [...groups.values()].sort(
    (a, b) =>
      order[a.f.severity] - order[b.f.severity] || a.f.route.localeCompare(b.f.route) || a.f.check.localeCompare(b.f.check),
  );
  const vpLabel = (s: Set<Viewport | "—">) => {
    if (s.has("—")) return "—";
    const all = ACTIVE_VIEWPORTS.every((v) => s.has(v));
    return all && ACTIVE_VIEWPORTS.length > 1 ? "all" : [...s].sort((a, b) => Number(a) - Number(b)).join(" · ");
  };
  const blockers = rows.filter((r) => r.f.severity === "blocker").length;
  const polish = rows.length - blockers;
  const appCount = opts.routes.filter((r) => r.source === "app").length;

  const lines: string[] = [
    `# v2 QA — route crawl · ${TODAY}`,
    "",
    `Production build (\`next build\`, ${opts.commit}) served by \`next start -p ${PORT}\`; Chromium ${opts.chromium} via Playwright; viewports ${ACTIVE_VIEWPORTS.join(" / ")}${ROUTE_FILTER ? ` (route filter: ${ROUTE_FILTER.join(", ")})` : ""}; ${opts.routes.length} routes (${appCount} from src/app, ${opts.routes.length - appCount} discovered from internal links); ${opts.linkCount} unique internal links status-checked.`,
    "",
    opts.injected.length
      ? `Env: ${opts.injected.join(", ")} not set — a QA placeholder was supplied to the build/server only.`
      : "Env: nothing required yet.",
    "",
    "Excluded as expected off-Vercel: `/_vercel/*` script 404s (Analytics / Speed Insights).",
    "",
    "Severity: **blocker** = route status ≥ 400, console error / uncaught exception, failing internal link or same-origin asset, horizontal overflow, empty title/description, more than one canvas. **polish** = console warning, missing og:image.",
    "",
    `Routes: ${opts.routes.map((r) => `\`${r.path}\``).join(", ")}`,
    "",
    "| # | Route | Viewport | Check | Finding | Severity | File hint |",
    "|---|---|---|---|---|---|---|",
    ...rows.map(
      (r, i) =>
        `| ${i + 1} | \`${cell(r.f.route)}\` | ${vpLabel(r.viewports)} | ${r.f.check} | ${cell(r.f.detail)} | ${r.f.severity} | ${cell(r.f.hint)} |`,
    ),
    "",
    rows.length ? `**${blockers} blocker · ${polish} polish** across ${rows.length} findings.` : "**No findings.**",
    "",
  ];
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, lines.join("\n"));
  return { blockers, polish, rows: rows.length };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
  const injected: string[] = [];
  for (const k of REQUIRED_ENV) {
    if (!env[k]?.trim()) {
      env[k] = "qa-placeholder";
      injected.push(k);
    }
  }
  if (injected.length) {
    console.warn(`[qa:crawl] ${injected.join(", ")} unset — QA placeholder supplied to the build/server only.`);
  }

  if (await isListening()) {
    console.error(`[qa:crawl] something already listens on ${BASE}. Stop it or pass --port <free port>.`);
    process.exit(1);
  }

  if (NO_BUILD) {
    if (!existsSync(resolve(ROOT, ".next/BUILD_ID"))) {
      console.error("[qa:crawl] --no-build but no .next/BUILD_ID — run without --no-build first.");
      process.exit(1);
    }
    console.log("[qa:crawl] --no-build: reusing the existing .next build");
  } else {
    console.log("[qa:crawl] next build …");
    const build = spawnSync("npm", ["run", "build"], { cwd: ROOT, env, stdio: "inherit" });
    if (build.status !== 0) {
      console.error(`[qa:crawl] build failed (exit ${build.status})`);
      process.exit(1);
    }
  }

  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT }).toString().trim();

  let routes = expandDynamic(enumerateAppRoutes());
  const known = new Set(routes.map((r) => r.path));

  if (ROUTE_FILTER) {
    routes = routes.filter((r) => ROUTE_FILTER.includes(r.path));
    for (const p of ROUTE_FILTER) {
      if (!known.has(p)) routes.push({ path: p, file: fileForPath(p, routes), source: "app" });
    }
  }

  console.log(`[qa:crawl] starting next start -p ${PORT} …`);
  await startServer(env);
  console.log(`[qa:crawl] serving ${BASE}; crawling ${routes.length} routes × ${ACTIVE_VIEWPORTS.length} viewports`);

  const browser = await chromium.launch();
  const linkStatus = new Map<string, number>();
  const queue: Route[] = [...routes];
  const links: LinkCheck = {
    status: linkStatus,
    discover: (path) => {
      if (ROUTE_FILTER || known.has(path)) return;
      known.add(path);
      const r: Route = { path, file: fileForPath(path, routes), source: "link" };
      routes.push(r);
      queue.push(r);
      console.log(`[qa:crawl]   + discovered ${path}`);
    },
  };

  let failure: unknown = null;
  let blockers = 0;
  try {
    for (const vw of ACTIVE_VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vw, height: HEIGHT[vw] },
        deviceScaleFactor: 1,
        isMobile: vw < 1024,
        hasTouch: vw < 1024,
        colorScheme: "dark",
      });
      // tsx/esbuild (keepNames) wraps named inner functions in `__name(...)`; the
      // page has no such helper when Playwright evaluates them → define a no-op.
      await ctx.addInitScript({ content: "globalThis.__name = globalThis.__name || ((f) => f);" });
      // Pages discovered while crawling this viewport are appended and crawled in the same pass.
      const seen = new Set<string>();
      let i = 0;
      while (i < queue.length) {
        const r = queue[i++];
        if (seen.has(r.path)) continue;
        seen.add(r.path);
        process.stdout.write(`[qa:crawl] ${String(vw).padStart(4)} ${r.path} … `);
        const before = findings.length;
        await crawlRoute(ctx, r, vw, links);
        console.log(`${findings.length - before} finding(s)`);
      }
      await ctx.close();
    }
  } catch (e) {
    failure = e;
  } finally {
    const chromiumVersion = browser.version();
    await browser.close();
    await shutdownServer();
    const serverErrors = serverLog.filter((l) => /error|⨯|warn/i.test(l));
    if (serverErrors.length) {
      console.log("\n[qa:crawl] server log lines mentioning error/warn:");
      for (const l of serverErrors.slice(0, 40)) console.log("   " + l);
    }
    if (failure) {
      console.error(
        "\n[qa:crawl] crawl aborted — no report written:",
        failure instanceof Error ? (failure.stack ?? failure.message) : failure,
      );
    } else {
      const summary = writeReport({ routes, linkCount: linkStatus.size, injected, chromium: chromiumVersion, commit });
      blockers = summary.blockers;
      console.log(
        `\n[qa:crawl] ${summary.blockers} blocker · ${summary.polish} polish (${summary.rows} rows) → ${relative(ROOT, OUT)}`,
      );
    }
    console.log(`[qa:crawl] server on :${PORT} stopped: ${(await isListening()) ? "NO — still listening!" : "yes"}`);
  }
  if (failure) process.exit(1);
  if (STRICT && blockers > 0) {
    console.error(`[qa:crawl] --strict: ${blockers} blocker(s) → exit 1`);
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.error("[qa:crawl] failed:", err instanceof Error ? err.message : err);
  await shutdownServer();
  process.exit(1);
});
