import type { SkinId } from "../config";
import { DITOSHEY_ART } from "./portraits/ditosheyArt";
import { HIGAN_ART } from "./portraits/higanbanbanArt";
import { MORYAKA_ART } from "./portraits/moryakaArt";
import { SQUIMEH_ART } from "./portraits/squimehArt";
import { SNEZHA_ART } from "./portraits/snezhaArt";
import { MEOWLODY_ART } from "./portraits/meowlodyArt";
import { MILIRAY_ART } from "./portraits/milirayArt";
import { YUCHII_ART } from "./portraits/yuchiiArt";
import { ALASKANYAN_ART } from "./portraits/alaskanyanArt";
import { ALYSQUE_ART } from "./portraits/alysqueArt";
import { AMELIA_ART } from "./portraits/ameliaArt";
import { NYAMURAS_ART } from "./portraits/nyamurasArt";
import { KNJAZEVDESU_ART } from "./portraits/knjazevdesuArt";
import { SEVERINA_ART } from "./portraits/severinaArt";

export const GENERATED_ART: Partial<Record<SkinId, string>> = {
  ditoshey: DITOSHEY_ART,
  moryaka: MORYAKA_ART,
  severina: SEVERINA_ART,
  higanbanban: HIGAN_ART,
  squimeh: SQUIMEH_ART,
  snezha: SNEZHA_ART,
  meowlody: MEOWLODY_ART,
  miliray: MILIRAY_ART,
  yuchii: YUCHII_ART,
  alaskanyan: ALASKANYAN_ART,
  alysque: ALYSQUE_ART,
  amelia: AMELIA_ART,
  nyamuras: NYAMURAS_ART,
  knjazevdesu: KNJAZEVDESU_ART,
};

export interface ArtHeadCrop { x: number; y: number; w: number; }

/** Per-character normalized crops for the small head-only card preview. */
export const ART_HEAD_CROPS: Record<SkinId, ArtHeadCrop> = {
  moryaka: { x: 0.19, y: 0.04, w: 0.62 },
  severina: { x: 0.12, y: 0.01, w: 0.72 },
  higanbanban: { x: 0.13, y: 0.02, w: 0.72 },
  ditoshey: { x: 0.09, y: 0.02, w: 0.78 },
  squimeh: { x: 0.24, y: 0.02, w: 0.52 },
  snezha: { x: 0.23, y: 0.02, w: 0.54 },
  meowlody: { x: 0.22, y: 0.02, w: 0.56 },
  miliray: { x: 0.21, y: 0.02, w: 0.58 },
  yuchii: { x: 0.18, y: 0.02, w: 0.62 },
  alaskanyan: { x: 0.19, y: 0.02, w: 0.6 },
  alysque: { x: 0.2, y: 0.02, w: 0.58 },
  amelia: { x: 0.2, y: 0.02, w: 0.58 },
  nyamuras: { x: 0.18, y: 0.02, w: 0.62 },
  knjazevdesu: { x: 0.18, y: 0.02, w: 0.62 },
};

