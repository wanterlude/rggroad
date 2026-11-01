import { FIREBASE_DB_URL, LEADERBOARD_API } from "./leaderboard-config";

export type LeaderboardStatus = "unconfigured" | "loading" | "ready" | "offline";

export interface LeaderboardEntry {
  id: string;
  name: string;
  /** Stored in Firebase only; the in-game table shows the clean name. */
  title?: string;
  runDate?: string;
  runTime?: string;
  runAt?: string;
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
const TOP = 25;
// Read extra rows so duplicate nicknames do not shrink the visible top 25.
const FETCH_LIMIT = 100;

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

/**
 * Run timestamp in GMT+3 (Europe/Moscow, no DST): ISO for data,
 * "DD.MM.YYYY HH:MM МСК" for the displayed title.
 */
function runDateInfo(date = new Date()): {
  runDate: string;
  runTime: string;
  runAt: string;
  label: string;
} {
  const moscow = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const year = moscow.getUTCFullYear();
  const month = String(moscow.getUTCMonth() + 1).padStart(2, "0");
  const day = String(moscow.getUTCDate()).padStart(2, "0");
  const hours = String(moscow.getUTCHours()).padStart(2, "0");
  const minutes = String(moscow.getUTCMinutes()).padStart(2, "0");
  const seconds = String(moscow.getUTCSeconds()).padStart(2, "0");
  const runDate = `${year}-${month}-${day}`;
  const runTime = `${hours}:${minutes}`;
  return {
    runDate,
    runTime,
    runAt: `${runDate}T${runTime}:${seconds}+03:00`,
    label: `${day}.${month}.${year} ${runTime} МСК`
  };
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
    if (!this.dbUrl && !LEADERBOARD_API) {
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
    void this.loadFromApi(seq).then((ok) => {
      if (!ok && seq === this.requestSeq) this.loadFromFirebase(seq);
    });
  }

  /** Основная база — VPS. Если он недоступен, вызывается Firebase. */
  private async loadFromApi(seq: number): Promise<boolean> {
    if (!LEADERBOARD_API) return false;
    try {
      const data = await this.fetchJson<{ scores?: Array<{ name?: string; score?: number; ts?: number }> }>(
        `${LEADERBOARD_API}?game=rgg-road&limit=${FETCH_LIMIT}`,
        5000
      );
      if (seq !== this.requestSeq) return true;
      const entries: LeaderboardEntry[] = [];
      for (const [index, row] of (data?.scores ?? []).entries()) {
        const score = Number(row?.score);
        if (!Number.isFinite(score) || score <= 0) continue;
        const name = (typeof row?.name === "string" ? row.name : "Игрок").slice(0, 16);
        const ts = Number.isFinite(Number(row?.ts)) ? Number(row?.ts) : 0;
        const entry: LeaderboardEntry = { id: `vps-${index}`, name, score: Math.floor(score), ts };
        if (ts > 1e12) {
          const info = runDateInfo(new Date(ts));
          entry.title = `${name} · ${info.label}`;
          entry.runDate = info.runDate;
          entry.runTime = info.runTime;
          entry.runAt = info.runAt;
        }
        entries.push(entry);
      }
      if (!entries.length) return false;
      this.entries = entries
        .sort((a, b) => b.score - a.score || a.ts - b.ts)
        .slice(0, TOP);
      this.status = "ready";
      this.emit();
      return true;
    } catch {
      return false;
    }
  }

  private loadFromFirebase(seq: number): void {
    const query =
      `${this.dbUrl}/leaderboard.json` +
      `?orderBy=${encodeURIComponent('"score"')}&limitToLast=${FETCH_LIMIT}`;
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
            let title =
              typeof value.title === "string" && value.title.trim()
                ? value.title.slice(0, 48)
                : undefined;
            let runDate =
              typeof value.runDate === "string" && value.runDate.trim()
                ? value.runDate.slice(0, 10)
                : undefined;
            let runTime =
              typeof value.runTime === "string" && value.runTime.trim()
                ? value.runTime.slice(0, 5)
                : undefined;
            let runAt =
              typeof value.runAt === "string" && value.runAt.trim()
                ? value.runAt.slice(0, 25)
                : undefined;
            // Older records predate the time/title fields but still carry a
            // real timestamp; rebuild their title in GMT+3 with the time.
            if (ts > 1e12 && (!title || !runTime)) {
              const info = runDateInfo(new Date(ts));
              title = `${name} · ${info.label}`;
              runDate = info.runDate;
              runTime = info.runTime;
              runAt = info.runAt;
            }
            entries.push({ id, name, title, runDate, runTime, runAt, score: Math.floor(score), ts });
          }
        }
        entries.sort((a, b) => b.score - a.score || a.ts - b.ts);
        // One place per nickname: keep that nickname's best score. Firebase
        // keeps every device record, but the in-game table is a player table.
        const bestByName = new Map<string, LeaderboardEntry>();
        for (const entry of entries) {
          const key = entry.name.trim().toLocaleLowerCase("ru");
          const previous = bestByName.get(key);
          if (
            !previous ||
            entry.score > previous.score ||
            (entry.score === previous.score && entry.ts < previous.ts)
          ) {
            bestByName.set(key, entry);
          }
        }
        this.entries = [...bestByName.values()]
          .sort((a, b) => b.score - a.score || a.ts - b.ts)
          .slice(0, TOP);
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

  /** Отправка результата в основную базу (VPS). Вторая база не мешает. */
  private async pushApi(score: number): Promise<void> {
    if (!LEADERBOARD_API || !this.playerName) return;
    try {
      await fetch(LEADERBOARD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "rgg-road", name: this.playerName, score, ts: Date.now() }),
        keepalive: true
      });
    } catch {
      /* VPS недоступен — результат всё равно уйдёт в Firebase */
    }
  }

  private async push(score: number): Promise<void> {
    if (!this.dbUrl && !LEADERBOARD_API) return;
    void this.pushApi(score);
    if (!this.dbUrl) return;
    try {
      const ownUrl = `${this.dbUrl}/leaderboard/${encodeURIComponent(this.playerId)}.json`;
      const existing = await this.fetchJson<{ score?: number } | null>(ownUrl);
      const existingScore = existing ? Number(existing.score) : NaN;
      const bestScore =
        Number.isFinite(existingScore) && existingScore > score
          ? Math.floor(existingScore)
          : score;
      const stamp = new Date();
      const { runDate, runTime, runAt, label } = runDateInfo(stamp);
      await fetch(ownUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: this.playerName,
          // The GMT+3 date and time are part of the displayed record title,
          // while the score remains the player's best result.
          title: `${this.playerName} · ${label}`,
          runDate,
          runTime,
          runAt,
          score: bestScore,
          ts: stamp.getTime()
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

  private async fetchJson<T>(url: string, timeout = 8000): Promise<T> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);
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
