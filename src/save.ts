import { SAVE_KEY, SKINS, SKIN_ORDER, type SkinId } from "./config";
import type { SaveData } from "./types";

// The first five heroes are free; the rest unlock for 10 coins. Only the free
// ones are granted on a fresh save — everything else has to be earned.
const FREE_SKINS = SKIN_ORDER.slice(0, 5);
export const ECONOMY_VERSION = 2;

const defaults: SaveData = {
  best: 0,
  coins: 0,
  skin: "moryaka",
  unlocked: [...FREE_SKINS],
  favorites: [],
  muted: false,
  musicMuted: false,
  musicVolume: 0.5,
  runs: 0,
  economyVersion: ECONOMY_VERSION
};

function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && SKIN_ORDER.includes(value as SkinId);
}

function sanitize(raw: unknown): SaveData {
  const data: SaveData = { ...defaults, unlocked: [...defaults.unlocked] };
  if (!raw || typeof raw !== "object") return data;
  const src = raw as Partial<SaveData>;

  if (typeof src.best === "number" && Number.isFinite(src.best)) data.best = Math.max(0, Math.floor(src.best));
  if (typeof src.coins === "number" && Number.isFinite(src.coins)) data.coins = Math.max(0, Math.floor(src.coins));
  if (typeof src.runs === "number" && Number.isFinite(src.runs)) data.runs = Math.max(0, Math.floor(src.runs));

  // Saves from before the price change had every hero unlocked for free. Apply
  // the new economy once: the first five stay, the rest have to be bought.
  const modernEconomy = src.economyVersion === ECONOMY_VERSION;
  const unlocked: SkinId[] = [...FREE_SKINS];
  if (modernEconomy && Array.isArray(src.unlocked)) {
    for (const value of src.unlocked) {
      if (isSkinId(value) && !unlocked.includes(value)) unlocked.push(value);
    }
  }
  data.unlocked = unlocked;

  if (isSkinId(src.skin) && unlocked.includes(src.skin)) data.skin = src.skin;

  const favorites: SkinId[] = [];
  if (Array.isArray(src.favorites)) {
    for (const value of src.favorites) {
      if (isSkinId(value) && !favorites.includes(value)) favorites.push(value);
    }
  }
  data.favorites = favorites;

  data.muted = src.muted === true;
  data.musicMuted = src.musicMuted === true;
  if (typeof src.musicVolume === "number" && Number.isFinite(src.musicVolume)) {
    data.musicVolume = Math.min(1, Math.max(0, src.musicVolume));
  }
  data.economyVersion = ECONOMY_VERSION;
  return data;
}

class SaveStore {
  data: SaveData = { ...defaults, unlocked: [...defaults.unlocked] };

  constructor() {
    try {
      const stored = localStorage.getItem(SAVE_KEY);
      if (stored) this.data = sanitize(JSON.parse(stored));
    } catch {
      this.data = { ...defaults, unlocked: [...defaults.unlocked] };
    }
  }

  write(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* file:// or private mode: memory save still works for this session */
    }
  }

  update(patch: Partial<SaveData>): void {
    Object.assign(this.data, patch);
    this.write();
  }

  unlock(skin: SkinId): boolean {
    const def = SKINS[skin];
    if (!def || this.data.unlocked.includes(skin)) return false;
    if (this.data.coins < def.cost) return false;
    this.data.coins -= def.cost;
    this.data.unlocked.push(skin);
    this.data.skin = skin;
    this.write();
    return true;
  }
}

export const save = new SaveStore();

