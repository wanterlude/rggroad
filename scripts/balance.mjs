import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = new Map(
  process.argv.slice(2).map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "1"];
  })
);
const base = args.get("base") ?? process.env.QA_URL ?? "http://127.0.0.1:5173/";
const runsPerBiome = Number(args.get("runs") ?? 100);
const seconds = Number(args.get("seconds") ?? 30);
const batchSize = Math.max(1, Number(args.get("batch") ?? 10));
const out = resolve(args.get("out") ?? "artifacts/balance-report.json");
const only = (args.get("biomes") ?? "").split(",").filter(Boolean);
const biomes = only.length
  ? only
  : [
      "autumn", "forest", "ocean", "swamp", "savanna", "desert", "frost", "candy",
      "jungle", "city", "prehistoric", "halloween", "lava", "ashlands", "space", "void"
    ];
const chrome = process.env.CHROME_PATH;

const percentile = (sorted, p) => {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index];
};

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome || undefined,
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error.message)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(`${base}?biome=autumn&row=20&bot=1&seed=1&season=none&nostart=1`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__CR3D_READY__ === true, null, { timeout: 30000 });

const results = [];
const started = Date.now();
for (const biome of biomes) {
  const runs = [];
  for (let offset = 0; offset < runsPerBiome; offset += batchSize) {
    const count = Math.min(batchSize, runsPerBiome - offset);
    await page.goto(`${base}?biome=${biome}&row=20&bot=1&seed=1&season=none&nostart=1`, {
      waitUntil: "networkidle"
    });
    await page.waitForFunction(() => window.__CR3D_READY__ === true, null, { timeout: 30000 });
    const batch = await page.evaluate(
      ({ biome, count, offset, seconds }) => {
        const runs = [];
        for (let i = 0; i < count; i++) {
          runs.push(window.CR3D.benchRun(seconds, offset + i + 1));
        }
        return runs;
      },
      { biome, count, offset, seconds }
    );
    runs.push(...batch);
  }

  const values = runs.map((run) => run.gained).sort((a, b) => a - b);
  const deaths = runs.filter((run) => run.dead);
  const causes = {};
  for (const run of deaths) causes[run.cause ?? "unknown"] = (causes[run.cause ?? "unknown"] ?? 0) + 1;
  const summary = {
    biome,
    name: runs[0]?.biomeName ?? biome,
    runs: runs.length,
    deaths: deaths.length,
    deathRate: +(deaths.length / runs.length).toFixed(3),
    timeouts: runs.length - deaths.length,
    min: values[0] ?? 0,
    p10: percentile(values, 0.1),
    median: percentile(values, 0.5),
    p90: percentile(values, 0.9),
    max: values[values.length - 1] ?? 0,
    mean: +(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)).toFixed(1),
    causes
  };
  results.push({ ...summary, samples: runs });
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(
    `${String(biomes.indexOf(biome) + 1).padStart(2)}/${biomes.length} ${biome.padEnd(12)} ` +
      `median ${String(summary.median).padStart(3)}  p10 ${String(summary.p10).padStart(3)}  ` +
      `deaths ${String(summary.deaths).padStart(3)}/${summary.runs}  [${secs}s]`
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  config: { base, runsPerBiome, seconds, secondsPerRun: seconds },
  errors,
  biomes: results.map(({ samples, ...summary }) => summary),
  samples: results.flatMap(({ samples }) => samples)
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\nSaved ${out}`);
if (errors.length) console.log(`Console errors: ${errors.length}`);
await browser.close();
