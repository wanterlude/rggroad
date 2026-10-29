export type SkinId = "moryaka" | "severina" | "higanbanban" | "ditoshey" | "squimeh" | "snezha" | "meowlody" | "miliray" | "yuchii" | "alaskanyan" | "alysque" | "amelia" | "nyamuras" | "knjazevdesu" | "lilanei";

// Keep the legacy style names so the old, unused voxel builders still type-check.
export type SkinStyle = "chicken" | "penguin" | "frog" | "unicorn" | "moryaka" | "severina" | "higanbanban" | "ditoshey" | "squimeh" | "snezha" | "meowlody" | "miliray" | "yuchii" | "alaskanyan" | "alysque" | "amelia" | "nyamuras" | "knjazevdesu" | "lilanei";

export interface SkinDef {
  id: SkinId;
  name: string;
  cost: number;
  style: SkinStyle;
  badge: string;
  body: number;
  bodyShade: number;
  belly: number;
  wing: number;
  comb: number;
  beak: number;
  feet: number;
  eye: number;
  pupil: number;
  accent: number;
  mane: number;
  horn: number;
}

export const SAVE_KEY = "crossyRoad3D.save.v1";

export const SKINS: Record<SkinId, SkinDef> = {
  squimeh: {
    id: "squimeh",
    name: "Squimeh",
    cost: 0,
    style: "squimeh",
    badge: "Кошка",
    body: 0xffe6d8,
    bodyShade: 0xf0cbb8,
    belly: 0xfff8ef,
    wing: 0x1b1a22,
    comb: 0xff7fae,
    beak: 0x5a3829,
    feet: 0xcdb8e8,
    eye: 0x8b5fbf,
    pupil: 0x23152f,
    accent: 0xc8f1e4,
    mane: 0x5a3829,
    horn: 0xffd6e5
  },
  snezha: {
    id: "snezha",
    name: "Snezha_mrr",
    cost: 10,
    style: "snezha",
    badge: "Звёздная кошка",
    body: 0xffe6d8,
    bodyShade: 0xf0cbb8,
    belly: 0xfff8ef,
    wing: 0x202346,
    comb: 0x304fc4,
    beak: 0xf3c44f,
    feet: 0xfff8ef,
    eye: 0xffa12e,
    pupil: 0x24140f,
    accent: 0x5d7de0,
    mane: 0x263a9e,
    horn: 0xf3c44f
  },
  meowlody: {
    id: "meowlody",
    name: "Meowlody Note",
    cost: 10,
    style: "meowlody",
    badge: "Мелодия",
    body: 0xffe6d8,
    bodyShade: 0xf0cbb8,
    belly: 0xfff8ef,
    wing: 0x17151d,
    comb: 0xff8fae,
    beak: 0xffd1de,
    feet: 0x17151d,
    eye: 0x55b8ff,
    pupil: 0x14243a,
    accent: 0xff7ea6,
    mane: 0xff8fae,
    horn: 0xffffff
  },
  miliray: {
    id: "miliray",
    name: "Miliray Brick",
    cost: 10,
    style: "miliray",
    badge: "Готика",
    body: 0xffe6d8,
    bodyShade: 0xf0cbb8,
    belly: 0xfff8ef,
    wing: 0x161318,
    comb: 0xe9e7ee,
    beak: 0x151318,
    feet: 0x151318,
    eye: 0xd93545,
    pupil: 0x240d12,
    accent: 0xb8202f,
    mane: 0xf2f0f6,
    horn: 0xffffff
  },
  yuchii: {
    id: "yuchii",
    name: "Yuchii_Yu",
    cost: 10,
    style: "yuchii",
    badge: "Птичка",
    body: 0xffe6d8,
    bodyShade: 0xf0cbb8,
    belly: 0xfff8ef,
    wing: 0x5f9fb2,
    comb: 0xf04c37,
    beak: 0xf28a2e,
    feet: 0xfff8ef,
    eye: 0x17110e,
    pupil: 0x17110e,
    accent: 0xf5c542,
    mane: 0xef4c3a,
    horn: 0xf59f2d
  },
  alaskanyan: {
    id: "alaskanyan",
    name: "Alaskanyan",
    cost: 10,
    style: "alaskanyan",
    badge: "Белая кошка",
    body: 0xffe6d8,
    bodyShade: 0xf0cbb8,
    belly: 0xfff8ef,
    wing: 0x7c2430,
    comb: 0xe3e0e5,
    beak: 0x9e2d3a,
    feet: 0xfff8ef,
    eye: 0xc92f42,
    pupil: 0x2a1012,
    accent: 0xd7d3da,
    mane: 0xf1eef2,
    horn: 0x9e2d3a
  },
  alysque: {
    id: "alysque",
    name: "aLySQuE",
    cost: 10,
    style: "alysque",
    badge: "Демон",
    body: 0xffe6d8,
    bodyShade: 0xf0cbb8,
    belly: 0xfff8ef,
    wing: 0xf5c518,
    comb: 0xef5aa1,
    beak: 0xf28a2e,
    feet: 0x17141a,
    eye: 0xf5c518,
    pupil: 0x1b1411,
    accent: 0x17141a,
    mane: 0xef5aa1,
    horn: 0x2a2027
  },
  amelia: {
    id: "amelia",
    name: "AmeliaLavert",
    cost: 10,
    style: "amelia",
    badge: "Вампир",
    body: 0xffe6d8,
    bodyShade: 0xf0cbb8,
    belly: 0xfff8ef,
    wing: 0x2c1b4f,
    comb: 0xe8e4ee,
    beak: 0x8e1f3d,
    feet: 0x2c1b4f,
    eye: 0xd13b75,
    pupil: 0x2a101b,
    accent: 0xd8b36a,
    mane: 0xf1eef4,
    horn: 0x241a2e
  },
  nyamuras: {
    id: "nyamuras",
    name: "Nyamuras",
    cost: 10,
    style: "nyamuras",
    badge: "Фермер",
    body: 0xffe6d8,
    bodyShade: 0xf0cbb8,
    belly: 0xfff8ef,
    wing: 0x6d6ab5,
    comb: 0x9b7bd4,
    beak: 0xf2b544,
    feet: 0xf2b544,
    eye: 0xc58a2e,
    pupil: 0x2a1c10,
    accent: 0x7a86c9,
    mane: 0x9b7bd4,
    horn: 0xf2e2a8
  },
  knjazevdesu: {
    id: "knjazevdesu",
    name: "Knjazevdesu",
    cost: 10,
    style: "knjazevdesu",
    badge: "Геймер",
    body: 0x3fc7b4,
    bodyShade: 0x2f9f92,
    belly: 0xd8efb6,
    wing: 0x4fd7c2,
    comb: 0x2fbfae,
    beak: 0xf2c24e,
    feet: 0x3fc7b4,
    eye: 0xf2c24e,
    pupil: 0x1b2a24,
    accent: 0x7ccfdc,
    mane: 0x2fbfae,
    horn: 0xd8efb6
  },
  lilanei: {
    id: "lilanei",
    name: "lilanei",
    cost: 10,
    style: "lilanei",
    badge: "Летняя кошка",
    body: 0xffe6d8,
    bodyShade: 0xf0cbb8,
    belly: 0xfff8ef,
    wing: 0x0e6f8c,
    comb: 0xb51f2e,
    beak: 0xf6b3a5,
    feet: 0xf6f2ea,
    eye: 0x4fa85e,
    pupil: 0x1f2a24,
    accent: 0xf6f2ea,
    mane: 0xb51f2e,
    horn: 0x8ed8e8
  },
  moryaka: {
    id: "moryaka",
    name: "itsMORIKO",
    cost: 0,
    style: "moryaka",
    badge: "Штурман",
    body: 0x71402c,
    bodyShade: 0x4b2a20,
    belly: 0xfffbf1,
    wing: 0x544468,
    comb: 0xffb52e,
    beak: 0xf08a2c,
    feet: 0xf0a62e,
    eye: 0xe8861f,
    pupil: 0x2b1a18,
    accent: 0xffbe38,
    mane: 0x71402c,
    horn: 0x544468
  },
  severina: {
    id: "severina",
    name: "SeverinaSoda",
    cost: 0,
    style: "severina",
    badge: "Удильщик",
    body: 0x7c6bb8,
    bodyShade: 0x5b4b91,
    belly: 0xf6ead7,
    wing: 0x3f7776,
    comb: 0xd9a640,
    beak: 0x5caf7a,
    feet: 0x5caf7a,
    eye: 0x4fc4c7,
    pupil: 0x173b40,
    accent: 0xd9a640,
    mane: 0xd8c1e4,
    horn: 0x7c6bb8
  },
  higanbanban: {
    id: "higanbanban",
    name: "HiganBanban",
    cost: 0,
    style: "higanbanban",
    badge: "Хиганбана",
    body: 0x20282a,
    bodyShade: 0x101819,
    belly: 0xe7d9c4,
    wing: 0x2a6b58,
    comb: 0xd8343f,
    beak: 0xffe8dc,
    feet: 0x111718,
    eye: 0xff5a2e,
    pupil: 0x24100f,
    accent: 0x2e8f73,
    mane: 0x1f6b5a,
    horn: 0xd62f3f
  },
  ditoshey: {
    id: "ditoshey",
    name: "Ditoshey",
    cost: 0,
    style: "ditoshey",
    badge: "Кицунэ",
    body: 0xcdbce6,
    bodyShade: 0xa58fc8,
    belly: 0xfff8ee,
    wing: 0xf3a7a7,
    comb: 0xf6b7a8,
    beak: 0xffe8dc,
    feet: 0xe8d9f2,
    eye: 0x9fd36b,
    pupil: 0x1e2a1e,
    accent: 0xe9c46a,
    mane: 0xf3a7a7,
    horn: 0xb9afd9
  }
};

export const SKIN_ORDER: SkinId[] = ["moryaka", "severina", "higanbanban", "ditoshey", "squimeh", "snezha", "meowlody", "miliray", "yuchii", "alaskanyan", "alysque", "amelia", "nyamuras", "knjazevdesu", "lilanei"];

export const PALETTE = {
  grass: [0x7cd35b, 0x73ca52, 0x82d763, 0x6fc54e],
  grassDark: 0x4ea43a,
  grassLight: 0xa2e77b,
  curb: 0xd8d3ba,
  road: 0x4b535c,
  roadAlt: 0x454d56,
  roadLine: 0xf4ead3,
  railBed: 0x9a8c76,
  railBedDark: 0x837763,
  railSteel: 0x68737b,
  railSteelLight: 0xb5c0c2,
  sleeper: 0x68543d,
  water: 0x35b4dc,
  waterDeep: 0x2493be,
  waterLight: 0x8be1f4,
  foam: 0xd8f8ff,
  log: 0xa46b3b,
  logDark: 0x7b4b28,
  logLight: 0xc68b54,
  trunk: 0x7a5130,
  leaves: [0x47a93d, 0x3c9c38, 0x58b847, 0x2f8a35],
  leavesLight: [0x69c956, 0x59bd4a, 0x7ad568],
  rock: 0x8d9698,
  rockDark: 0x6e787c,
  rockLight: 0xb9c1c1,
  flowers: [0xff7aa8, 0xffd23f, 0xffffff, 0xb58cff, 0xff8a3d],
  vehicles: [0xe94f4f, 0x3b82d9, 0xf4b62e, 0x2fb9a0, 0x8f6ae8, 0xef7d3e, 0xf7f0e1, 0x48a65d],
  glass: 0x223845,
  glassLight: 0x3d6172,
  wheel: 0x222b30,
  underbody: 0x2b343a,
  light: 0xffeaa0,
  taillight: 0xff4c4c
};

export type VehicleType = "car" | "taxi" | "van" | "bus" | "truck" | "race" | "decker";

export interface VehicleDims {
  length: number;
  width: number;
  weight: number;
}

export const VEHICLE_TYPES: Record<VehicleType, VehicleDims> = {
  car: { length: 1.55, width: 0.82, weight: 6 },
  taxi: { length: 1.7, width: 0.84, weight: 2.2 },
  van: { length: 2.05, width: 0.88, weight: 2.4 },
  bus: { length: 3.15, width: 0.92, weight: 1.2 },
  truck: { length: 2.75, width: 0.92, weight: 1.7 },
  race: { length: 1.9, width: 0.86, weight: 0.85 },
  decker: { length: 3.3, width: 0.94, weight: 0.75 }
};

export const GROUND_TOP = 0;
export const LOG_TOP = 0.4;
export const HALF_SPAN = 24;
export const FULL_SPAN = HALF_SPAN * 2;
export const GEN_AHEAD = 44;
export const DRAW_AHEAD = 38;
export const DRAW_BEHIND = 28;
export const CLEAN_BEHIND = 38;
export const HOP_DURATION = 0.15;
export const HOP_HEIGHT = 0.55;

export const PALETTE_CSS = {
  ink: "#20313a",
  cream: "#fff7e2",
  yellow: "#ffd23f"
};
