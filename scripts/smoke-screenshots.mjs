import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.QA_URL ?? "http://127.0.0.1:5173/";
const outDir = resolve(process.env.QA_OUT ?? "artifacts/screenshots");
mkdirSync(outDir, { recursive: true });

const biomes = [
  "autumn", "forest", "ocean", "swamp", "savanna", "desert", "frost", "candy",
  "jungle", "city", "prehistoric", "halloween", "lava", "ashlands", "space", "void"
];

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist"
  ]
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error.message)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

const boot = async (path) => {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__CR3D_READY__ === true, null, { timeout: 15000 });
  await page.waitForTimeout(1100);
};

await boot("?season=halloween");
await page.screenshot({ path: `${outDir}/menu-desktop.png` });

for (const biome of biomes) {
  await boot(`?biome=${biome}&row=20&start=1&bot=1&seed=7&season=none`);
  await page.screenshot({ path: `${outDir}/${biome}.png` });
  const state = await page.evaluate(() => ({
    biome: window.CR3D.world.getBiome().id,
    state: window.CR3D.state,
    score: window.CR3D.score
  }));
  console.log(`${biome.padEnd(12)} rows ${String(state.score).padStart(3)}  state ${state.state}`);
}

await boot("?biome=forest&row=20&start=1&bot=1&hitboxes=1&season=none");
const hitboxes = await page.evaluate(() => ({
  canvas: !!document.getElementById("debugHitboxes"),
  debug: document.getElementById("debugInfo")?.textContent ?? ""
}));
await page.screenshot({ path: `${outDir}/hitboxes-forest.png` });

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mobilePage = await mobile.newPage();
mobilePage.on("pageerror", (error) => errors.push("mobile: " + String(error.message)));
await mobilePage.goto(base + "?season=halloween", { waitUntil: "networkidle" });
await mobilePage.waitForFunction(() => window.__CR3D_READY__ === true, null, { timeout: 15000 });
await mobilePage.waitForTimeout(900);
await mobilePage.screenshot({ path: `${outDir}/menu-mobile.png` });

for (const biome of biomes) {
  await mobilePage.goto(`${base}?biome=${biome}&row=20&start=1&bot=1&seed=7&season=none`, {
    waitUntil: "networkidle"
  });
  await mobilePage.waitForFunction(() => window.__CR3D_READY__ === true, null, {
    timeout: 15000
  });
  await mobilePage.waitForTimeout(900);
  await mobilePage.screenshot({ path: `${outDir}/${biome}-mobile.png` });
}
await mobile.close();

console.log(`Hitbox overlay: ${hitboxes.canvas ? "on" : "MISSING"} · ${hitboxes.debug}`);
if (errors.length) {
  console.error(`Console errors (${errors.length}):\n${errors.join("\n")}`);
  process.exitCode = 1;
}
await browser.close();
