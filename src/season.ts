/**
 * Seasonal events are cosmetic modifiers layered over every biome. They are
 * picked from the real calendar so the game quietly changes with the year:
 * October is Halloween, December is New Year. `?season=` overrides the date
 * for screenshots and QA.
 */
export type SeasonId = "none" | "halloween" | "newyear";

export interface SeasonDef {
  id: SeasonId;
  label: string;
  kicker: string;
}

export const SEASONS: Record<SeasonId, SeasonDef> = {
  none: { id: "none", label: "", kicker: "" },
  halloween: { id: "halloween", label: "ХЭЛЛОУИН", kicker: "СЕЗОН" },
  newyear: { id: "newyear", label: "НОВЫЙ ГОД", kicker: "СЕЗОН" }
};

export function currentSeason(date = new Date()): SeasonId {
  const month = date.getMonth();
  if (month === 9) return "halloween";
  if (month === 11) return "newyear";
  return "none";
}

/** Return null when the URL does not contain a recognised season. */
export function parseSeason(raw: string | null): SeasonId | null {
  if (raw === null) return null;
  return raw === "none" || raw === "halloween" || raw === "newyear" ? raw : null;
}
