import { FIREBASE_DB_URL } from "./leaderboard-config";

export type LeaderboardStatus = "unconfigured" | "loading" | "ready" | "offline";

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  ts: number;
}

export interface LeaderboardState {
  status: LeaderboardStatus;
  entries: LeaderboardEntry[];
  playerId: string;
  playerName: string;
  error: string | null;
}

const ID_KEY = "rggroad.lb.id";
const NAME_KEY = "rggroad.lb.name";
const TOP = 10;

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: keep the value in memory for this session */
  }
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  }
  return `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e8).toString(36)}`;
}

/** Letters (including Cyrillic), digits, space, underscore and dash. */
export function normalizeNickname(raw: string): string | null {
  const name = raw
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
  if (name.length < 2) return null;
  if (!/^[\p{L}\p{N} _-]+$/u.test(name)) return null;
  return name;
}

export class Leaderboard {
  private readonly dbUrl: string;
  private readonly playerId: string;
  private playerName: string;
  private entries: LeaderboardEntry[] = [];
  private status: LeaderboardStatus;
  private error: string | null = null;
  private pendingScore = 0;
  private requestSeq = 0;

  constructor(
    dbUrl: string = FIREBASE_DB_URL,
    private readonly onChange?: (state: LeaderboardState) => void
  ) {
    this.dbUrl = dbUrl.replace(/\/+$/, "");
    this.playerId = readStorage(ID_KEY) || randomId();
    writeStorage(ID_KEY, this.playerId);
    this.playerName = readStorage(NAME_KEY);
    this.status = this.dbUrl ? "loading" : "unconfigured";
  }

  getState(): LeaderboardState {
    return {
      status: this.status,
      entries: this.entries,
      playerId: this.playerId,
      playerName: this.playerName,
      error: this.error
    };
  }

  hasName(): boolean {
    return this.playerName.length > 0;
  }

  /** Save a validated nickname and flush a score that was earned before naming. */
  setName(raw: string): string | null {
    const name = normalizeNickname(raw);
    if (!name) return null;
    this.playerName = name;
    writeStorage(NAME_KEY, name);
    this.emit();
    if (this.pendingScore > 0) {
      const score = this.pendingScore;
      this.pendingScore = 0;
      void this.push(score);
    } else {
      this.refresh();
    }
    return name;
  }

  /** A stable guest identity so the first run can still reach the table. */
  makeGuestName(): string {
    const name = `Гость-${Math.floor(1000 + Math.random() * 9000)}`;
    this.setName(name);
    return name;
  }

  /** Best score from the current session, submitted under the current nick. */
  submit(score: number): void {
    const value = Math.max(0, Math.floor(score));
    if (value <= 0) return;
    this.pendingScore = Math.max(this.pendingScore, value);
    if (!this.playerName) return;
    const pending = this.pendingScore;
    this.pendingScore = 0;
    void this.push(pending);
  }

  refresh(): void {
    if (!this.dbUrl) {
      this.status = "unconfigured";
      this.emit();
      return;
    }
    if (!this.playerName) {
      // Don't hit the database before the player has an identity; the
      // nickname dialog runs on top of the menu at this point.
      this.status = "loading";
      this.error = null;
      this.emit();
      return;
    }
    const seq = ++this.requestSeq;
    this.status = "loading";
    this.error = null;
    this.emit();
    const query =
      `${this.dbUrl}/leaderboard.json` +
      `?orderBy=${encodeURIComponent('"score"')}&limitToLast=${TOP}`;
    void this.fetchJson<Record<string, Omit<LeaderboardEntry, "id">> | null>(query)
      .then((data) => {
        if (seq !== this.requestSeq) return;
        const entries: LeaderboardEntry[] = [];
        if (data && typeof data === "object") {
          for (const [id, value] of Object.entries(data)) {
            if (!value || typeof value !== "object") continue;
            const score = Number(value.score);
            if (!Number.isFinite(score)) continue;
            const name = typeof value.name === "string" ? value.name.slice(0, 16) : "Игрок";
            const ts = Number.isFinite(Number(value.ts)) ? Number(value.ts) : 0;
            entries.push({ id, name, score: Math.floor(score), ts });
          }
        }
        entries.sort((a, b) => b.score - a.score || a.ts - b.ts);
        this.entries = entries.slice(0, TOP);
        this.status = "ready";
        this.emit();
      })
      .catch((error) => {
        if (seq !== this.requestSeq) return;
        this.status = "offline";
        this.error = this.describeError(error);
        this.emit();
      });
  }

  private async push(score: number): Promise<void> {
    if (!this.dbUrl) return;
    try {
      const ownUrl = `${this.dbUrl}/leaderboard/${encodeURIComponent(this.playerId)}.json`;
      const existing = await this.fetchJson<{ score?: number } | null>(ownUrl);
      if (existing && Number(existing.score) >= score) {
        this.refresh();
        return;
      }
      await fetch(ownUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: this.playerName,
          score,
          ts: Date.now()
        })
      });
      this.refresh();
    } catch (error) {
      this.status = "offline";
      this.error =
        this.describeError(error) === "НЕТ ДОСТУПА · ПРАВИЛА FIREBASE"
          ? "НЕ УДАЛОСЬ ОТПРАВИТЬ · ПРАВИЛА FIREBASE"
          : "НЕ УДАЛОСЬ ОТПРАВИТЬ РЕКОРД";
      this.emit();
    }
  }

  private describeError(error: unknown): string {
    const message = error instanceof Error ? error.message : "";
    return message.includes("401") || message.includes("403")
      ? "НЕТ ДОСТУПА · ПРАВИЛА FIREBASE"
      : "НЕТ СВЯЗИ С FIREBASE";
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } finally {
      window.clearTimeout(timer);
    }
  }

  private emit(): void {
    this.onChange?.(this.getState());
  }
}
