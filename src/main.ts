import "../styles.css";
import { Game } from "./Game";
import { BIOME_ORDER, type BiomeId } from "./biomes";
import { save } from "./save";
import { setMoryakaEyeVariant } from "./Models";

function showFatal(message: string): void {
  const app = document.getElementById("app");
  if (!app) return;
  const box = document.createElement("div");
  box.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:999",
    "display:grid",
    "place-items:center",
    "padding:32px",
    "background:#123a40",
    "color:#fff7e2",
    "font:700 16px/1.5 'Trebuchet MS', sans-serif",
    "text-align:center"
  ].join(";");
  box.textContent = message;
  app.appendChild(box);
}

try {
  const canvas = document.getElementById("game");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Canvas #game not found");
  const query = new URLSearchParams(window.location.search);
  const coinsParam = query.get("coins");
  if (coinsParam !== null) {
    const parsed = coinsParam === "max" ? 999999 : Number(coinsParam);
    if (Number.isFinite(parsed)) {
      save.data.coins = Math.max(0, Math.floor(parsed));
      save.write();
    }
  }
  const eyesParam = query.get("eyes");
  if (eyesParam !== null && Number.isFinite(Number(eyesParam))) {
    setMoryakaEyeVariant(Number(eyesParam) - 1);
  }

  // Biome lab: ?biome=frost&row=120&seed=42&bot=1 opens the run on that row.
  const seedRaw = query.get("seed");
  const rowRaw = query.get("row");
  const biomeRaw = query.get("biome");
  const seed = seedRaw !== null && Number.isFinite(Number(seedRaw)) ? Math.max(0, Math.trunc(Number(seedRaw))) : undefined;
  const row = rowRaw !== null && Number.isFinite(Number(rowRaw)) ? Math.max(0, Math.trunc(Number(rowRaw))) : undefined;
  const biome = biomeRaw !== null && (BIOME_ORDER as string[]).includes(biomeRaw) ? (biomeRaw as BiomeId) : undefined;
  const game = new Game(canvas, {
    seed,
    row,
    biome,
    bot: query.get("bot") === "1",
    autostart: query.get("start") === "1" || query.get("autoplay") === "1"
  });
  const debug = query.get("debug") === "1";
  game.setDebug(debug);

  const api = {
    start: () => game.start(),
    menu: () => game.menu(),
    pause: () => game.pauseGame(),
    resume: () => game.resumeGame(),
    get state() {
      return game.getState();
    },
    get world() {
      return game.getWorld();
    },
    get score() {
      return game.getScore();
    },
    get sceneView() {
      return game.getSceneView();
    },
    get activeCamera() {
      return game.getActiveCamera();
    },
    get ui() {
      return game.getUI();
    },
    get audio() {
      return game.getAudio();
    },
    save,
    setCoins: (value: number | "max" = "max") => {
      const parsed = value === "max" ? 999999 : Number(value);
      if (!Number.isFinite(parsed)) return;
      save.data.coins = Math.max(0, Math.floor(parsed));
      save.write();
      game.getUI().updateHUD(game.getScore(), false, true);
    },
    projectPlayer: () => game.projectPlayer(),
    setDebug: (value: boolean) => game.setDebug(value),
    setIsoOverride: (value: {
      offX: number;
      offY: number;
      offZ: number;
      lookX: number;
      lookY: number;
      lookZ: number;
      height: number;
    } | null) => game.setIsoOverride(value)
  };

  (window as unknown as { CR3D: typeof api; __CR3D_READY__: boolean }).CR3D = api;
  (window as unknown as { CR3D: typeof api; __CR3D_READY__: boolean }).__CR3D_READY__ = true;

  window.addEventListener("error", (event) => {
    console.error(event.error ?? event.message);
    game.getUI().showToast("Ой! Что-то пошло не так. Обнови страницу.", 4500);
  });
} catch (error) {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  showFatal(`Не удалось запустить 3D-сцену. ${message}.\nПроверьте, что браузер поддерживает WebGL2.`);
}
