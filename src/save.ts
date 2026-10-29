import { SAVE_KEY, SKINS, SKIN_ORDER, type SkinId } from "./config";
import type { SaveData } from "./types";

const defaults: SaveData = {
  best: 0,
  coins: 0,
  skin: "moryaka",
  unlocked: [...SKIN_ORDER],
  muted: false,
  runs: 0
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

  const unlocked: SkinId[] = [...SKIN_ORDER];
  if (Array.isArray(src.unlocked)) {
    for (const value of src.unlocked) {
      if (isSkinId(value) && !unlocked.includes(value)) unlocked.push(value);
    }
  }
  data.unlocked = unlocked;

  if (isSkinId(src.skin) && unlocked.includes(src.skin)) data.skin = src.skin;
  data.muted = src.muted === true;
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

