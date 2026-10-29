export const TAU = Math.PI * 2;

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

export function angleDelta(from: number, to: number): number {
  let d = (to - from + Math.PI) % TAU;
  if (d < 0) d += TAU;
  return d - Math.PI;
}

export function dampAngle(from: number, to: number, lambda: number, dt: number): number {
  return from + angleDelta(from, to) * (1 - Math.exp(-lambda * dt));
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rr = (rng: () => number, min: number, max: number): number =>
  min + rng() * (max - min);

export const pick = <T>(rng: () => number, list: readonly T[]): T =>
  list[Math.floor(rng() * list.length)] ?? list[0];

export function weightedPick<T extends { weight: number }>(rng: () => number, entries: readonly T[]): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return entries[entries.length - 1];
}

export function hash2(x: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const fmt = (n: number): string => (n >= 100000 ? "99K+" : String(Math.max(0, Math.round(n))));

export const cssColor = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

export function wrap(value: number, min: number, max: number): number {
  const span = max - min;
  let v = value;
  while (v < min) v += span;
  while (v >= max) v -= span;
  return v;
}
