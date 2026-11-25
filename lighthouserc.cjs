/**
 * Lighthouse CI: the brief's §9 budgets as fail thresholds, on / only.
 *
 *   npm run build && npm run qa:lighthouse     (needs Node 22.19 or newer)
 *
 * Lighthouse's default run is the mobile one (Moto G class device, slow 4G,
 * 4x CPU), which is what the "mobile release gate" means. Each assertion uses
 * the median of three runs.
 *
 * Throttling is applied ("devtools"), not simulated. On this page the
 * simulation put LCP anywhere from 0.76 s to 3.5 s for the same build, while
 * the LCP it observed always equalled first paint; with the throttle really
 * applied LCP is measured and stays within about 50 ms run to run.
 *
 * §9 budget                     asserted as
 * LCP < 2.5 s                   largest-contentful-paint ≤ 2500 ms
 * CLS < 0.1                     cumulative-layout-shift ≤ 0.1
 * INP < 200 ms                  total-blocking-time ≤ 200 ms. INP needs a real
 *                               interaction and cannot be measured on a page
 *                               load; TBT is its lab proxy.
 * Route JS < 250 KB gz          script transfer size ≤ 256 000 bytes. Lazy 3D
 *                               and game chunks are not requested on load, so
 *                               they stay out of the figure, as §9 says.
 */
const PORT = 3100;
const median = { aggregationMethod: "median" };

module.exports = {
  ci: {
    collect: {
      startServerCommand: `npx next start -p ${PORT}`,
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 60_000,
      url: [`http://localhost:${PORT}/`],
      numberOfRuns: 3,
      settings: { throttlingMethod: "devtools" }, // see the note on throttling above
    },
    assert: {
      assertions: {
        "largest-contentful-paint": ["error", { maxNumericValue: 2500, ...median }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1, ...median }],
        "total-blocking-time": ["error", { maxNumericValue: 200, ...median }],
        "resource-summary:script:size": ["error", { maxNumericValue: 250 * 1024, ...median }],
      },
    },
    upload: {
      // Reports stay in the workspace (CI uploads them as an artifact); nothing is sent to a public store.
      target: "filesystem",
      outputDir: ".lighthouseci/reports",
    },
  },
};
