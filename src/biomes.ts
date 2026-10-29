/**
 * Palette data for the voxel world. The game currently uses a single classic
 * green theme; the table is kept as an internal palette source.
 */

export type BaseBiomeId =
  | "autumn"
  | "forest"
  | "desert"
  | "ocean"
  | "frost"
  | "lava"
  | "void";

export type NewBiomeId =
  | "savanna"
  | "jungle"
  | "city"
  | "space"
  | "candy"
  | "prehistoric"
  | "halloween";

/** Short challenge segments inserted after every third main biome. */
export type SpecialBiomeId = "storm" | "flood" | "crossroads";

export type BiomeId = BaseBiomeId | NewBiomeId | SpecialBiomeId;

export type IdleHazardKind = "eagle" | "vulture" | "bat" | "ufo" | "candy-plane" | "pterodactyl";
export type WaterStyle = "logs" | "crocodile" | "lily" | "chocolate" | "ice";

export interface BiomeMechanics {
  speed: number;
  road: number;
  river: number;
  rail: number;
  water: WaterStyle;
  police: boolean;
  idle: IdleHazardKind;
  stampede: boolean;
  /** Frost: landing on a grass row slides one extra cell in the same direction. */
  slide?: boolean;
  /** Lava: timed ground geysers with a glowing telegraph. */
  geysers?: boolean;
  /** Jump duration multiplier. 1.55 = floaty low-gravity hops. */
  gravity?: number;
  /** A hazard that rolls across safe rows: forest logs, desert tumbleweeds, savanna herds. */
  rollers?: "log" | "tumbleweed" | "beast";
  /** City: cars stop at red and drive at green. */
  lights?: boolean;
  /** Storm intermediate: rain overlay and a darker sky. */
  storm?: boolean;
  /** Void and Halloween: floor tiles that crack and disappear. */
  fragile?: "void" | "ghost";
  /** Jungle: coconuts that fall onto a cell after a growing shadow. */
  fallers?: "coconut";
}

export type BiomePropKind =
  | "tree"
  | "pine"
  | "palm"
  | "cactus"
  | "deadTree"
  | "crystal"
  | "mushroom"
  | "pumpkin"
  | "rock"
  | "bush"
  | "stump"
  | "bones"
  | "snowman"
  | "obelisk"
  | "ice";

export type BiomeDecorKind =
  | "flower"
  | "tuft"
  | "pebble"
  | "mushroom"
  | "shell"
  | "crystal"
  | "ember"
  | "snowflake";

export interface BiomeWeight<T extends string> {
  kind: T;
  weight: number;
}

export interface BiomeDef {
  id: BiomeId;
  name: string;
  description?: string;
  accent: number;
  grass: [number, number, number];
  grassLight: number;
  grassDark: number;
  road: number;
  roadAlt: number;
  roadLine: number;
  curb: number;
  water: number;
  waterDeep: number;
  waterLight: number;
  railBed: number;
  sleeper: number;
  rail: number;
  railLight: number;
  leaves: number[];
  leavesLight: number[];
  trunk: number;
  rock: number;
  rockDark: number;
  rockLight: number;
  flowers: number[];
  ground: number;
  fog: number;
  light: number;
  lightIntensity: number;
  hemiSky: number;
  hemiGround: number;
  vehicleColors: number[];
  log: number;
  logDark: number;
  logLight: number;
  pumpkin: number;
  mushroom: number;
  crystal: number;
  snow: number;
  ice: number;
  bone: number;
  palmLeaf: number;
  cactus: number;
  ember: number;
  shell: number;
  deadWood: number;
  propWeights: BiomeWeight<BiomePropKind>[];
  decorWeights: BiomeWeight<BiomeDecorKind>[];
  mechanics?: BiomeMechanics;
}

export const BIOME_SPAN = 30;
/** A short special segment is inserted after this many main biomes. */
export const MAIN_BIOMES_PER_INTERMEDIATE = 3;
export const INTERMEDIATE_SPAN = 12;
export const INTERMEDIATE_ORDER: SpecialBiomeId[] = ["storm", "flood", "crossroads"];

export const BIOME_ORDER: BiomeId[] = [
  "autumn",
  "forest",
  "ocean",
  "savanna",
  "desert",
  "frost",
  "candy",
  "jungle",
  "city",
  "prehistoric",
  "halloween",
  "lava",
  "space",
  "void"
];

const BASE_BIOMES: Record<BaseBiomeId, BiomeDef> = {
  autumn: {
    id: "autumn",
    name: "ОСЕНЬ",
    accent: 0xffd23f,
    grass: [0x9bcc45, 0x8dbd39, 0xabd94e],
    grassLight: 0xbfe66a,
    grassDark: 0x76a52e,
    road: 0x4c525b,
    roadAlt: 0x555c66,
    roadLine: 0xf7f4e9,
    curb: 0xffffff,
    water: 0x50d6ef,
    waterDeep: 0x2ba9d5,
    waterLight: 0xb4f4ff,
    railBed: 0x73777f,
    sleeper: 0x7c4f35,
    rail: 0xb5b9c1,
    railLight: 0xf1eee6,
    leaves: [0x9fbd3d, 0x8aab33, 0xb1cb50, 0x7f9f2e],
    leavesLight: [0xbdd65c, 0xa9c34b, 0x95b13b],
    trunk: 0x74492d,
    rock: 0xb8a6c9,
    rockDark: 0x9786a7,
    rockLight: 0xd7c9e2,
    flowers: [0xfff8e8, 0xffd84a, 0xff8b8b, 0xf5f0d0],
    ground: 0x91c13f,
    fog: 0xe5f5fb,
    light: 0xfff7e3,
    lightIntensity: 2.0,
    hemiSky: 0xe8f8ff,
    hemiGround: 0x6d9a3f,
    vehicleColors: [0x58c7e3, 0x9bc94a, 0xee7a35, 0x9a74d0, 0xf1c433, 0xe65b45, 0xf1ece2, 0x58b96a],
    log: 0x9a5f39,
    logDark: 0x6d4028,
    logLight: 0xc08a55,
    pumpkin: 0xe87525,
    mushroom: 0xd45a3a,
    crystal: 0xffd15c,
    snow: 0xf4f4e8,
    ice: 0xa5d8d6,
    bone: 0xece3c6,
    palmLeaf: 0x5a9e4e,
    cactus: 0x558f4b,
    ember: 0xff8a3d,
    shell: 0xf6f7f1,
    deadWood: 0x5e3a2a,
    propWeights: [
      { kind: "tree", weight: 4.8 },
      { kind: "rock", weight: 2.0 },
      { kind: "bush", weight: 1.8 },
      { kind: "stump", weight: 0.7 }
    ],
    decorWeights: [
      { kind: "flower", weight: 0.35 },
      { kind: "tuft", weight: 0.4 },
      { kind: "pebble", weight: 0.25 }
    ]
  },
  forest: {
    id: "forest",
    name: "ЛЕС",
    accent: 0x8ad35f,
    grass: [0x6db34d, 0x5da344, 0x85c45d],
    grassLight: 0xa0d578,
    grassDark: 0x447d37,
    road: 0x414846,
    roadAlt: 0x4a5350,
    roadLine: 0xf2e7c9,
    curb: 0xb6b29a,
    water: 0x39b9c9,
    waterDeep: 0x2a8396,
    waterLight: 0x8ee3e6,
    railBed: 0x5c6353,
    sleeper: 0x3f4a3d,
    rail: 0x8b8c78,
    railLight: 0xd4d5b9,
    leaves: [0x3d8f4c, 0x2f7444, 0x5eaa55, 0x4b9b5b],
    leavesLight: [0x8acb67, 0x6fbf5f, 0x4e9c51],
    trunk: 0x5b3f2e,
    rock: 0x7f8b76,
    rockDark: 0x5f6d5b,
    rockLight: 0xb7c1a8,
    flowers: [0xfff39b, 0xff7f8b, 0xffd23f, 0xf7f1d0],
    ground: 0x5fa846,
    fog: 0xc7e3c7,
    light: 0xfff4d6,
    lightIntensity: 2.1,
    hemiSky: 0xdff6ff,
    hemiGround: 0x3f6b3f,
    vehicleColors: [0x4d9c4f, 0x2f7d8c, 0xcc6a3b, 0xd6b84a, 0xf0e3c5],
    log: 0x7a5438,
    logDark: 0x4c3224,
    logLight: 0xb48458,
    pumpkin: 0xdc7a2e,
    mushroom: 0xcf5b4d,
    crystal: 0x83e3b0,
    snow: 0xf2f5e8,
    ice: 0x9dd8d0,
    bone: 0xe6dfc4,
    palmLeaf: 0x4d9b55,
    cactus: 0x558f4b,
    ember: 0xff8a3d,
    shell: 0xf0e2b4,
    deadWood: 0x4f3527,
    propWeights: [
      { kind: "tree", weight: 3.8 },
      { kind: "bush", weight: 1.9 },
      { kind: "rock", weight: 1.1 },
      { kind: "stump", weight: 0.7 },
      { kind: "mushroom", weight: 0.6 }
    ],
    decorWeights: [
      { kind: "flower", weight: 0.3 },
      { kind: "tuft", weight: 0.42 },
      { kind: "pebble", weight: 0.16 },
      { kind: "mushroom", weight: 0.12 }
    ]
  },
  desert: {
    id: "desert",
    name: "ПУСТЫНЯ",
    accent: 0xffcf63,
    grass: [0xe1bd70, 0xd5ad5d, 0xecd08a],
    grassLight: 0xf4dfa2,
    grassDark: 0xb98b4d,
    road: 0x76533d,
    roadAlt: 0x845f45,
    roadLine: 0xffe9b0,
    curb: 0xc28f52,
    water: 0x4fc7cd,
    waterDeep: 0x2f8e9c,
    waterLight: 0xb3f0e4,
    railBed: 0x8a6848,
    sleeper: 0x5b3f2b,
    rail: 0xb08c63,
    railLight: 0xf1d7a0,
    leaves: [0x4c9f5e, 0x3b824c, 0x6dbb62, 0x8a9d45],
    leavesLight: [0x8fd36f, 0x6fbb5d, 0xaeb95d],
    trunk: 0x8a5a35,
    rock: 0xb98657,
    rockDark: 0x8c5d3a,
    rockLight: 0xe0b97e,
    flowers: [0xffd25a, 0xff8a4c, 0xff6f6f, 0xf4e6b0],
    ground: 0xd5ad5d,
    fog: 0xe8cf98,
    light: 0xffe2a8,
    lightIntensity: 2.45,
    hemiSky: 0xfff0c7,
    hemiGround: 0x7f613c,
    vehicleColors: [0xc8813f, 0x2e9a9a, 0xe1b64d, 0x6b8f56, 0xf0dcc1],
    log: 0x9a6a3f,
    logDark: 0x603d24,
    logLight: 0xd3a36c,
    pumpkin: 0xdc7a2e,
    mushroom: 0xb85b45,
    crystal: 0xffd15c,
    snow: 0xf4f4e8,
    ice: 0xa5d8d6,
    bone: 0xeadfc3,
    palmLeaf: 0x55a45d,
    cactus: 0x4f9150,
    ember: 0xff8a3d,
    shell: 0xf2dca0,
    deadWood: 0x6f4a2f,
    propWeights: [
      { kind: "cactus", weight: 3.1 },
      { kind: "palm", weight: 1.2 },
      { kind: "rock", weight: 1.6 },
      { kind: "deadTree", weight: 0.55 },
      { kind: "obelisk", weight: 0.4 },
      { kind: "bush", weight: 0.7 }
    ],
    decorWeights: [
      { kind: "flower", weight: 0.12 },
      { kind: "tuft", weight: 0.28 },
      { kind: "pebble", weight: 0.5 },
      { kind: "shell", weight: 0.1 }
    ]
  },
  ocean: {
    id: "ocean",
    name: "ОКЕАН",
    accent: 0x5fe3e8,
    grass: [0xe4d08a, 0xd5c17a, 0xf0e1a5],
    grassLight: 0xf8efc7,
    grassDark: 0xbba76b,
    road: 0x4a4c54,
    roadAlt: 0x555962,
    roadLine: 0xc9f3f2,
    curb: 0xe8d7a4,
    water: 0x2cb8d8,
    waterDeep: 0x1f89b4,
    waterLight: 0x8cebf1,
    railBed: 0x5d625f,
    sleeper: 0x3f4b4a,
    rail: 0x8d9b95,
    railLight: 0xd9ede3,
    leaves: [0x3b9b5b, 0x2f814e, 0x5fbf71, 0x4b9a6b],
    leavesLight: [0x8ee28c, 0x68cb7b, 0x4eae65],
    trunk: 0x9a6b43,
    rock: 0x8b8d89,
    rockDark: 0x5f726e,
    rockLight: 0xc6d5c4,
    flowers: [0xfff0a6, 0xff8f96, 0xffc94b, 0xf5f0d5],
    ground: 0x2a9fc3,
    fog: 0xbfeaf0,
    light: 0xfff1d0,
    lightIntensity: 2.2,
    hemiSky: 0xdffaff,
    hemiGround: 0x2e6f7f,
    vehicleColors: [0x2f9fb0, 0xe36a5b, 0xf0d67a, 0x5e8fcf, 0xf3ead2],
    log: 0x8d6743,
    logDark: 0x5b3e29,
    logLight: 0xd0a875,
    pumpkin: 0xdc7a2e,
    mushroom: 0xcf6b5b,
    crystal: 0x6fe8e3,
    snow: 0xf4f4e8,
    ice: 0xa5d8d6,
    bone: 0xeadfc3,
    palmLeaf: 0x3fae63,
    cactus: 0x558f4b,
    ember: 0xff8a3d,
    shell: 0xffe1b8,
    deadWood: 0x6b4a33,
    propWeights: [
      { kind: "palm", weight: 3.2 },
      { kind: "bush", weight: 1.7 },
      { kind: "rock", weight: 1.2 },
      { kind: "stump", weight: 0.8 },
      { kind: "tree", weight: 0.7 }
    ],
    decorWeights: [
      { kind: "flower", weight: 0.18 },
      { kind: "tuft", weight: 0.18 },
      { kind: "pebble", weight: 0.2 },
      { kind: "shell", weight: 0.44 }
    ]
  },
  frost: {
    id: "frost",
    name: "ЛЁД",
    accent: 0xc6ecff,
    grass: [0xd4e8f2, 0xc2dbe8, 0xe6f4fa],
    grassLight: 0xf8fdff,
    grassDark: 0x9ebacb,
    road: 0x46525c,
    roadAlt: 0x505c66,
    roadLine: 0xe3f3ff,
    curb: 0xa9c5d2,
    water: 0x71cbe3,
    waterDeep: 0x3c8eb3,
    waterLight: 0xd5f7ff,
    railBed: 0x70828c,
    sleeper: 0x4d5d67,
    rail: 0xa5bfc9,
    railLight: 0xf0fbff,
    leaves: [0x3d7a72, 0x2f625f, 0x5b9585, 0x547f83],
    leavesLight: [0x8fc3ad, 0x6ea899, 0xb7d8ca],
    trunk: 0x5b4a42,
    rock: 0x91a5b4,
    rockDark: 0x667c8c,
    rockLight: 0xd4e5ee,
    flowers: [0xffffff, 0xaee6ff, 0x9bb8d8, 0xf4fbff],
    ground: 0xd9eef7,
    fog: 0xe8f7ff,
    light: 0xe7f4ff,
    lightIntensity: 2.0,
    hemiSky: 0xffffff,
    hemiGround: 0x5e7b87,
    vehicleColors: [0x5f8fa8, 0xb14a4a, 0xe3edf2, 0x71808c, 0xf5f0d0],
    log: 0xbfe9f2,
    logDark: 0x7fb7c6,
    logLight: 0xf2ffff,
    pumpkin: 0xd7a36e,
    mushroom: 0xc8a3a0,
    crystal: 0x9fe8ff,
    snow: 0xf7fbff,
    ice: 0xa9e3f4,
    bone: 0xe6e1d2,
    palmLeaf: 0x5b9e8f,
    cactus: 0x6b9b8f,
    ember: 0xffb08a,
    shell: 0xe5eef3,
    deadWood: 0x5a5550,
    propWeights: [
      { kind: "pine", weight: 3.4 },
      { kind: "ice", weight: 1.4 },
      { kind: "rock", weight: 1.4 },
      { kind: "snowman", weight: 0.6 },
      { kind: "bush", weight: 0.8 }
    ],
    decorWeights: [
      { kind: "flower", weight: 0.12 },
      { kind: "tuft", weight: 0.18 },
      { kind: "pebble", weight: 0.25 },
      { kind: "snowflake", weight: 0.45 }
    ]
  },
  lava: {
    id: "lava",
    name: "ЛАВА",
    accent: 0xff6a3a,
    grass: [0x3b2737, 0x32202f, 0x4b3040],
    grassLight: 0x603b48,
    grassDark: 0x251823,
    road: 0x2b2029,
    roadAlt: 0x342432,
    roadLine: 0xff6a3a,
    curb: 0x6b2e3c,
    water: 0xd93a2e,
    waterDeep: 0x8b1f24,
    waterLight: 0xff9a4d,
    railBed: 0x2c1c28,
    sleeper: 0x4a2a33,
    rail: 0xb0664a,
    railLight: 0xffa04a,
    leaves: [0x572c3a, 0x7c3b4b, 0x3e2531, 0x8d4a3e],
    leavesLight: [0xff7a3a, 0xc34a3d, 0xe67b3f],
    trunk: 0x3a2530,
    rock: 0x4f3345,
    rockDark: 0x2b1b2c,
    rockLight: 0x8c4a5c,
    flowers: [0xff8a3d, 0xffd05c, 0xff5a5a, 0xd77b45],
    ground: 0x332033,
    fog: 0x5c2936,
    light: 0xff9a6a,
    lightIntensity: 2.3,
    hemiSky: 0xff9f7a,
    hemiGround: 0x2b1420,
    vehicleColors: [0xa82f2f, 0xe56f2f, 0x2c202a, 0x7c3d82, 0xd7a13a],
    log: 0x2a1e2b,
    logDark: 0x161019,
    logLight: 0xff6a3a,
    pumpkin: 0x9c3a2d,
    mushroom: 0xd4503f,
    crystal: 0xff6a3a,
    snow: 0x8b6b6b,
    ice: 0x6b3a45,
    bone: 0xcfc2ab,
    palmLeaf: 0x6b3a3f,
    cactus: 0x6b3a3f,
    ember: 0xff8a3d,
    shell: 0x9b6b5a,
    deadWood: 0x2a1b26,
    propWeights: [
      { kind: "deadTree", weight: 2.8 },
      { kind: "rock", weight: 1.8 },
      { kind: "crystal", weight: 0.7 },
      { kind: "bones", weight: 0.8 },
      { kind: "mushroom", weight: 0.5 },
      { kind: "obelisk", weight: 0.3 }
    ],
    decorWeights: [
      { kind: "flower", weight: 0.08 },
      { kind: "tuft", weight: 0.14 },
      { kind: "pebble", weight: 0.34 },
      { kind: "ember", weight: 0.44 }
    ]
  },
  void: {
    id: "void",
    name: "ПУСТОТА",
    accent: 0xc66bff,
    grass: [0x30203f, 0x271934, 0x3e2a52],
    grassLight: 0x563b70,
    grassDark: 0x1c1127,
    road: 0x231a30,
    roadAlt: 0x2c203d,
    roadLine: 0xd17aff,
    curb: 0x6d4b8c,
    water: 0x6a3fa8,
    waterDeep: 0x3f246e,
    waterLight: 0xb57bff,
    railBed: 0x2a1c3a,
    sleeper: 0x432b58,
    rail: 0x7b5aa0,
    railLight: 0xd4a2ff,
    leaves: [0x4a2b63, 0x6a3f8c, 0x3a2352, 0x7f4a9a],
    leavesLight: [0xb06cff, 0x6de5ff, 0xd38aff],
    trunk: 0x3a2a4a,
    rock: 0x4a355f,
    rockDark: 0x2a1c39,
    rockLight: 0x7a5a9a,
    flowers: [0xc66bff, 0x63e8ff, 0xff7ad9, 0x9d7bd1],
    ground: 0x2a1a3e,
    fog: 0x4a2d63,
    light: 0xc9a7ff,
    lightIntensity: 2.2,
    hemiSky: 0x7f5cff,
    hemiGround: 0x1d1229,
    vehicleColors: [0x6a3fa8, 0x2f9ca8, 0xc65cff, 0x2b2038, 0x8a5bd1],
    log: 0x392548,
    logDark: 0x1d1426,
    logLight: 0x8a5bff,
    pumpkin: 0x6b3a86,
    mushroom: 0xc66bff,
    crystal: 0x63e8ff,
    snow: 0xb9a8d1,
    ice: 0x7f5cff,
    bone: 0xbfb2d1,
    palmLeaf: 0x6a3f8c,
    cactus: 0x5a3f7a,
    ember: 0xff7ad9,
    shell: 0x8a6b9a,
    deadWood: 0x2a1c39,
    propWeights: [
      { kind: "crystal", weight: 2.9 },
      { kind: "mushroom", weight: 1.4 },
      { kind: "deadTree", weight: 1.3 },
      { kind: "rock", weight: 1.2 },
      { kind: "obelisk", weight: 0.6 },
      { kind: "bones", weight: 0.4 }
    ],
    decorWeights: [
      { kind: "flower", weight: 0.12 },
      { kind: "tuft", weight: 0.08 },
      { kind: "pebble", weight: 0.18 },
      { kind: "crystal", weight: 0.32 },
      { kind: "mushroom", weight: 0.3 }
    ]
  }
};

const BASE_MECHANICS: Record<BaseBiomeId, BiomeMechanics> = {
  autumn: { speed: 1, road: 0.43, river: 0.22, rail: 0.14, water: "logs", police: false, idle: "eagle", stampede: false },
  forest: { speed: 1.02, road: 0.42, river: 0.22, rail: 0.13, water: "logs", police: false, idle: "eagle", stampede: false, rollers: "log" },
  desert: { speed: 1.08, road: 0.5, river: 0.12, rail: 0.12, water: "crocodile", police: false, idle: "eagle", stampede: false, rollers: "tumbleweed" },
  ocean: { speed: 0.98, road: 0.3, river: 0.37, rail: 0.1, water: "logs", police: false, idle: "eagle", stampede: false },
  frost: { speed: 1.06, road: 0.38, river: 0.26, rail: 0.12, water: "ice", police: false, idle: "eagle", stampede: false, slide: true },
  lava: { speed: 1.25, road: 0.42, river: 0.23, rail: 0.13, water: "logs", police: false, idle: "eagle", stampede: false, geysers: true },
  void: { speed: 1.32, road: 0.43, river: 0.24, rail: 0.14, water: "ice", police: false, idle: "ufo", stampede: false, fragile: "void" }
};

for (const [id, biome] of Object.entries(BASE_BIOMES) as [BaseBiomeId, BiomeDef][]) {
  biome.mechanics = BASE_MECHANICS[id];
}

function variant(
  id: BiomeId,
  name: string,
  base: BaseBiomeId,
  overrides: Partial<BiomeDef>
): BiomeDef {
  const source = BASE_BIOMES[base];
  return {
    ...source,
    ...overrides,
    id,
    name,
    mechanics: overrides.mechanics ?? source.mechanics ?? BASE_MECHANICS[base]
  };
}

const NEW_BIOMES: Record<NewBiomeId, BiomeDef> = {
  savanna: variant("savanna", "САВАННА", "autumn", {
    grass: [0xc8ae4e, 0xbda346, 0xd6bc61],
    grassLight: 0xe1cb72,
    grassDark: 0x938032,
    road: 0x4b4a4b,
    roadAlt: 0x555354,
    roadLine: 0xf4e7b0,
    curb: 0xf7e8b4,
    water: 0x53bfd3,
    waterDeep: 0x2f95ac,
    waterLight: 0xb8f1f3,
    leaves: [0x8f9a42, 0x7c8738, 0xa6b153, 0x68762e],
    leavesLight: [0xc2cb70, 0xafba5d, 0x94a347],
    trunk: 0x6b4a2c,
    rock: 0xc19a62,
    rockDark: 0x946f43,
    rockLight: 0xe6c18a,
    flowers: [0xfff4cf, 0xffc84a, 0xe87530, 0xfff9e8],
    ground: 0xb9a044,
    fog: 0xf5e9ca,
    light: 0xffecc5,
    lightIntensity: 2.1,
    propWeights: [
      { kind: "palm", weight: 2.4 },
      { kind: "rock", weight: 2.1 },
      { kind: "deadTree", weight: 1.1 },
      { kind: "bush", weight: 0.8 }
    ],
    decorWeights: [
      { kind: "flower", weight: 0.18 },
      { kind: "tuft", weight: 0.4 },
      { kind: "pebble", weight: 0.2 }
    ],
    mechanics: { speed: 1.12, road: 0.46, river: 0.2, rail: 0.14, water: "crocodile", police: false, idle: "vulture", stampede: false, rollers: "beast" }
  }),
  jungle: variant("jungle", "ДЖУНГЛИ", "forest", {
    grass: [0x4f8f3e, 0x458237, 0x5d9f48],
    grassLight: 0x75b358,
    grassDark: 0x34722b,
    road: 0x414a43,
    roadAlt: 0x4b544b,
    water: 0x3ab6c5,
    waterDeep: 0x1d869b,
    waterLight: 0xa2f0e5,
    leaves: [0x3f8a31, 0x326f28, 0x4c9b3b, 0x286421],
    leavesLight: [0x63a94b, 0x4d913b, 0x77bc5c],
    trunk: 0x5b432a,
    rock: 0x6e8268,
    rockDark: 0x4e6050,
    rockLight: 0xa8ba9c,
    flowers: [0xff5f8a, 0xffd84a, 0xffffff, 0xf29d3d],
    ground: 0x4b8238,
    fog: 0xd7eed0,
    light: 0xfff4dc,
    propWeights: [
      { kind: "palm", weight: 2.2 },
      { kind: "tree", weight: 2.4 },
      { kind: "bush", weight: 1.2 },
      { kind: "mushroom", weight: 0.5 },
      { kind: "rock", weight: 0.8 }
    ],
    decorWeights: [
      { kind: "flower", weight: 0.4 },
      { kind: "tuft", weight: 0.35 },
      { kind: "mushroom", weight: 0.2 },
      { kind: "pebble", weight: 0.12 }
    ],
    mechanics: { speed: 1.06, road: 0.32, river: 0.42, rail: 0.11, water: "lily", police: false, idle: "eagle", stampede: false, fallers: "coconut" }
  }),
  city: variant("city", "ГОРОД", "autumn", {
    grass: [0x6f8a5c, 0x667f54, 0x7c9668],
    grassLight: 0x91a97e,
    grassDark: 0x536b48,
    road: 0x35383e,
    roadAlt: 0x3e4148,
    roadLine: 0xf3f1df,
    curb: 0xd9d7cb,
    water: 0x4f9fae,
    waterDeep: 0x33717e,
    waterLight: 0xadd8dd,
    railBed: 0x575b62,
    sleeper: 0x4c3f38,
    rail: 0xa5a9b1,
    leaves: [0x5b8d4b, 0x507f42, 0x6c9d59, 0x446f3a],
    leavesLight: [0x80ab6a, 0x6e9958, 0x93ba7c],
    trunk: 0x624b38,
    rock: 0x8b9098,
    rockDark: 0x666b72,
    rockLight: 0xb9bec4,
    flowers: [0xffd84a, 0xffffff, 0xe96d6d, 0xf1c433],
    ground: 0x647a52,
    fog: 0xdce5e8,
    light: 0xf4f2e6,
    propWeights: [
      { kind: "rock", weight: 1.8 },
      { kind: "bush", weight: 2.4 },
      { kind: "tree", weight: 1.3 },
      { kind: "stump", weight: 0.4 }
    ],
    decorWeights: [
      { kind: "tuft", weight: 0.3 },
      { kind: "pebble", weight: 0.55 }
    ],
    mechanics: { speed: 1.4, road: 0.56, river: 0.13, rail: 0.1, water: "logs", police: true, idle: "eagle", stampede: false, lights: true }
  }),
  space: variant("space", "КОСМОС", "void", {
    grass: [0x3b334f, 0x352d48, 0x453b5b],
    grassLight: 0x5b4d75,
    grassDark: 0x241e31,
    road: 0x242633,
    roadAlt: 0x2d2f3e,
    roadLine: 0x9edcff,
    curb: 0x6b5c91,
    water: 0x314f79,
    waterDeep: 0x172945,
    waterLight: 0x8bd7ff,
    railBed: 0x2a2838,
    sleeper: 0x3a324e,
    rail: 0x8b7faf,
    leaves: [0x5e4b8a, 0x4a3b70, 0x725ba3, 0x382b5a],
    leavesLight: [0x8d78c6, 0x735fa9, 0xa490d8],
    trunk: 0x4a3b52,
    rock: 0x55456f,
    rockDark: 0x332746,
    rockLight: 0x8772a5,
    flowers: [0x9edcff, 0xffd15c, 0xc49bff, 0xf7f2ff],
    ground: 0x302a40,
    fog: 0x171329,
    light: 0xd8ccff,
    lightIntensity: 1.6,
    hemiSky: 0x6b5c9c,
    hemiGround: 0x1c172b,
    propWeights: [
      { kind: "crystal", weight: 2.8 },
      { kind: "obelisk", weight: 1.2 },
      { kind: "rock", weight: 1.2 },
      { kind: "deadTree", weight: 0.7 }
    ],
    decorWeights: [
      { kind: "crystal", weight: 0.3 },
      { kind: "pebble", weight: 0.4 },
      { kind: "tuft", weight: 0.08 }
    ],
    mechanics: { speed: 1.26, road: 0.44, river: 0.2, rail: 0.14, water: "ice", police: false, idle: "ufo", stampede: false, gravity: 1.55 }
  }),
  candy: variant("candy", "СЛАДОСТИ", "autumn", {
    grass: [0xf0a9c2, 0xe89ab6, 0xf7bbd0],
    grassLight: 0xffd4e2,
    grassDark: 0xd37d9f,
    road: 0x58435d,
    roadAlt: 0x624d68,
    roadLine: 0xfff0c8,
    curb: 0xfff6e4,
    water: 0x8b4b32,
    waterDeep: 0x5b2d20,
    waterLight: 0xd18a5c,
    railBed: 0x72516b,
    sleeper: 0x5d3b46,
    rail: 0xf2c4d8,
    leaves: [0xf58fba, 0xe67aaa, 0xffa9cc, 0xd96899],
    leavesLight: [0xffc0dc, 0xf3a1c6, 0xffd5e8],
    trunk: 0x9b5f48,
    rock: 0xdc9fc8,
    rockDark: 0xb879a2,
    rockLight: 0xf4cbe2,
    flowers: [0xffffff, 0xffd84a, 0x9ae6d8, 0xff8fbb],
    ground: 0xd990b4,
    fog: 0xffe7f1,
    light: 0xfff0df,
    propWeights: [
      { kind: "mushroom", weight: 2.2 },
      { kind: "tree", weight: 1.3 },
      { kind: "crystal", weight: 1.4 },
      { kind: "rock", weight: 0.8 }
    ],
    decorWeights: [
      { kind: "flower", weight: 0.45 },
      { kind: "tuft", weight: 0.2 },
      { kind: "mushroom", weight: 0.4 }
    ],
    mechanics: { speed: 0.98, road: 0.36, river: 0.32, rail: 0.1, water: "chocolate", police: false, idle: "candy-plane", stampede: false }
  }),
  prehistoric: variant("prehistoric", "ДОИСТОРИЯ", "forest", {
    grass: [0x78a04a, 0x6f9443, 0x83ac53],
    grassLight: 0xa6c36b,
    grassDark: 0x587c38,
    road: 0x4a4640,
    roadAlt: 0x544e47,
    water: 0x4eb6b1,
    waterDeep: 0x2a8281,
    waterLight: 0xb1eee4,
    leaves: [0x4f8e3b, 0x417b31, 0x63a04b, 0x356628],
    leavesLight: [0x81b45f, 0x6e9e4f, 0x96c574],
    trunk: 0x62422b,
    rock: 0x8c7b58,
    rockDark: 0x62523b,
    rockLight: 0xbda683,
    flowers: [0xffd84a, 0xff8a3d, 0xfff2cf, 0xe96e55],
    ground: 0x6f9544,
    fog: 0xe7eed2,
    light: 0xffedc9,
    propWeights: [
      { kind: "palm", weight: 2.6 },
      { kind: "rock", weight: 1.8 },
      { kind: "deadTree", weight: 0.9 },
      { kind: "bush", weight: 1.0 }
    ],
    decorWeights: [
      { kind: "flower", weight: 0.2 },
      { kind: "tuft", weight: 0.3 },
      { kind: "pebble", weight: 0.3 }
    ],
    mechanics: { speed: 1.18, road: 0.4, river: 0.3, rail: 0.11, water: "crocodile", police: false, idle: "pterodactyl", stampede: true }
  }),
  halloween: variant("halloween", "ХЭЛЛОУИН", "forest", {
    grass: [0x58495a, 0x4f4252, 0x625164],
    grassLight: 0x78667b,
    grassDark: 0x3d3340,
    road: 0x2c2831,
    roadAlt: 0x35303a,
    roadLine: 0xe8c87a,
    curb: 0xc4a878,
    water: 0x6e2d45,
    waterDeep: 0x451b2c,
    waterLight: 0xb35b71,
    railBed: 0x3a313d,
    sleeper: 0x3d2a2c,
    rail: 0x9b8e9a,
    leaves: [0xa35d38, 0x8e4c2e, 0xbd7444, 0x6b3a28],
    leavesLight: [0xd38a52, 0xb36f42, 0xe19d63],
    trunk: 0x4f362b,
    rock: 0x6d586e,
    rockDark: 0x47394a,
    rockLight: 0xa08aa1,
    flowers: [0xff8a3d, 0xb38cff, 0xe8c87a, 0xffd3a3],
    ground: 0x4d4050,
    fog: 0xd8c8bc,
    light: 0xffd7b0,
    lightIntensity: 1.7,
    hemiSky: 0x8d6e94,
    hemiGround: 0x2e2432,
    propWeights: [
      { kind: "deadTree", weight: 2.2 },
      { kind: "pumpkin", weight: 1.8 },
      { kind: "rock", weight: 1.2 },
      { kind: "bones", weight: 0.8 },
      { kind: "mushroom", weight: 0.7 }
    ],
    decorWeights: [
      { kind: "mushroom", weight: 0.3 },
      { kind: "pebble", weight: 0.3 },
      { kind: "tuft", weight: 0.15 }
    ],
    mechanics: { speed: 1.15, road: 0.4, river: 0.26, rail: 0.15, water: "logs", police: false, idle: "bat", stampede: false, fragile: "ghost" }
  })
};

const SPECIAL_BIOMES: Record<SpecialBiomeId, BiomeDef> = {
  storm: variant("storm", "ГРОЗА", "ocean", {
    grass: [0x3f5a4c, 0x375245, 0x486454],
    grassLight: 0x5f7f6a,
    grassDark: 0x2a4036,
    road: 0x2a3038,
    roadAlt: 0x323840,
    roadLine: 0xd8e6e0,
    curb: 0x8fa39a,
    water: 0x2b6f7d,
    waterDeep: 0x1c4f5a,
    waterLight: 0x7fc4cf,
    leaves: [0x3f6b4a, 0x355c40, 0x4d7c57, 0x2b4d36],
    leavesLight: [0x6b9673, 0x5a8262, 0x7fa987],
    trunk: 0x4a3b30,
    rock: 0x66736f,
    rockDark: 0x4a5552,
    rockLight: 0x8a9893,
    flowers: [0xb8d8c8, 0xffd84a, 0xd8f0ff, 0xa8c8b8],
    ground: 0x355043,
    fog: 0x1b2a2a,
    light: 0xbfd8d0,
    lightIntensity: 1.35,
    hemiSky: 0x6d8a80,
    hemiGround: 0x1d2b26,
    propWeights: [
      { kind: "deadTree", weight: 2 },
      { kind: "pine", weight: 1.4 },
      { kind: "rock", weight: 1.3 },
      { kind: "bush", weight: 1 }
    ],
    decorWeights: [
      { kind: "pebble", weight: 0.4 },
      { kind: "tuft", weight: 0.3 },
      { kind: "flower", weight: 0.1 }
    ],
    mechanics: {
      speed: 1.45,
      road: 0.45,
      river: 0.24,
      rail: 0.14,
      water: "logs",
      police: false,
      idle: "eagle",
      stampede: false,
      storm: true
    }
  }),
  flood: variant("flood", "ПОЛОВОДЬЕ", "ocean", {
    grass: [0x6fae8a, 0x67a682, 0x7cbb96],
    grassLight: 0x9ed8b2,
    grassDark: 0x4f8a69,
    road: 0x4b535c,
    roadAlt: 0x454d56,
    water: 0x2fb4c9,
    waterDeep: 0x1d8fa5,
    waterLight: 0xa2f0e5,
    leaves: [0x4f9e4a, 0x428a3f, 0x62b25c, 0x357a36],
    leavesLight: [0x7cc46f, 0x69b35d, 0x8ed07f],
    trunk: 0x7a5130,
    rock: 0x9aa8a2,
    rockDark: 0x74827c,
    rockLight: 0xc4d2ca,
    flowers: [0xfff4cf, 0xffd84a, 0xff8fbb, 0xd8f0ff],
    ground: 0x5a9a78,
    fog: 0xbfe8e2,
    light: 0xe8fff8,
    lightIntensity: 2.1,
    propWeights: [
      { kind: "palm", weight: 2.2 },
      { kind: "rock", weight: 1.2 },
      { kind: "bush", weight: 1 },
      { kind: "deadTree", weight: 0.6 }
    ],
    decorWeights: [
      { kind: "shell", weight: 0.5 },
      { kind: "pebble", weight: 0.2 },
      { kind: "flower", weight: 0.1 }
    ],
    mechanics: {
      speed: 1,
      road: 0,
      river: 1,
      rail: 0,
      water: "logs",
      police: false,
      idle: "eagle",
      stampede: false
    }
  }),
  crossroads: variant("crossroads", "ПЕРЕКРЁСТОК", "autumn", {
    grass: [0x8a9a6a, 0x81915f, 0x96a675],
    grassLight: 0xa8b788,
    grassDark: 0x6a7a4f,
    road: 0x30343c,
    roadAlt: 0x383c44,
    roadLine: 0xffd23f,
    curb: 0xd8d3ba,
    water: 0x4f9fae,
    waterDeep: 0x33717e,
    waterLight: 0xadd8dd,
    leaves: [0x7a8a4a, 0x6c7c42, 0x8a9a5a, 0x5e6e3a],
    leavesLight: [0x9aaa6a, 0x889858, 0xacbc7c],
    trunk: 0x6b4a2c,
    rock: 0x8b9098,
    rockDark: 0x666b72,
    rockLight: 0xb9bec4,
    flowers: [0xffd84a, 0xffffff, 0xe96d6d, 0xf1c433],
    ground: 0x7a8a5a,
    fog: 0xd8d2c0,
    light: 0xfff0d0,
    lightIntensity: 2,
    propWeights: [
      { kind: "rock", weight: 1.4 },
      { kind: "bush", weight: 1.2 },
      { kind: "stump", weight: 0.8 },
      { kind: "deadTree", weight: 0.6 }
    ],
    decorWeights: [
      { kind: "pebble", weight: 0.5 },
      { kind: "tuft", weight: 0.2 }
    ],
    mechanics: {
      speed: 1.25,
      road: 1,
      river: 0,
      rail: 0,
      water: "logs",
      police: true,
      idle: "eagle",
      stampede: false,
      lights: true
    }
  })
};

export const BIOMES: Record<BiomeId, BiomeDef> = {
  ...BASE_BIOMES,
  ...NEW_BIOMES,
  ...SPECIAL_BIOMES
};

export interface BiomeSegment {
  start: number;
  end: number;
  biome: BiomeId;
  kind: "main" | "intermediate";
}

// Precomputed run plan: main biomes of 30 rows with a short intermediate
// segment after every third main biome. Precomputing keeps biomeForZ cheap
// even though segment lengths differ.
const SCHEDULE_ROWS = 240_000;
const SEGMENTS: BiomeSegment[] = [];
{
  let z = 0;
  let mainIndex = 0;
  let interIndex = 0;
  let mainCount = 0;
  while (z < SCHEDULE_ROWS) {
    const biome = BIOME_ORDER[mainIndex % BIOME_ORDER.length];
    SEGMENTS.push({ start: z, end: z + BIOME_SPAN, biome, kind: "main" });
    z += BIOME_SPAN;
    mainIndex++;
    mainCount++;
    if (mainCount % MAIN_BIOMES_PER_INTERMEDIATE === 0) {
      const interBiome = INTERMEDIATE_ORDER[interIndex % INTERMEDIATE_ORDER.length];
      SEGMENTS.push({
        start: z,
        end: z + INTERMEDIATE_SPAN,
        biome: interBiome,
        kind: "intermediate"
      });
      z += INTERMEDIATE_SPAN;
      interIndex++;
    }
  }
}

export function biomeSegmentAt(z: number): BiomeSegment {
  if (z <= 0) return SEGMENTS[0];
  let lo = 0;
  let hi = SEGMENTS.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const segment = SEGMENTS[mid];
    if (z < segment.start) hi = mid - 1;
    else if (z >= segment.end) lo = mid + 1;
    else return segment;
  }
  return SEGMENTS[SEGMENTS.length - 1];
}

/** Banks at the start, middle and end of flood/crossroads segments. */
export function isSpecialBankRow(rel: number): boolean {
  return rel <= 1 || (rel >= 5 && rel <= 6) || rel >= INTERMEDIATE_SPAN - 2;
}

export function biomeForZ(z: number): BiomeDef {
  return BIOMES[biomeSegmentAt(z).biome];
}

export const BIOME_DESCRIPTIONS: Record<BiomeId, string> = {
  autumn: "Спокойный старт: знакомый трафик, брёвна и орёл. Разомнись — дальше будет разнообразнее.",
  forest: "По лужайкам катятся брёвна. Пережди, пока бревно пройдёт, или обойди его.",
  desert: "Перекати-поле катится через лужайки. Не стой на его пути.",
  ocean: "Много рек: прыгай по брёвнам и не дай унести себя.",
  frost: "Скользко: после приземления тебя проносит ещё на клетку. Тормози заранее и не прыгай впритык.",
  lava: "Гейзеры: из трещин бьёт огонь. Пульсирующее кольцо — предупреждение, уходи с клетки.",
  void: "Финал цикла: НЛО вместо орла и плиты, которые трескаются и проваливаются.",
  savanna: "Стадо несётся через лужайки. Пережди волну или обойди её.",
  jungle: "С деревьев падают кокосы: тень растёт — уходи с клетки.",
  city: "Светофоры: на красный машины стоят. Переходи, когда поток замер.",
  space: "Низкая гравитация: прыжок дольше и выше. Держи ритм и рассчитывай траекторию.",
  candy: "Шоколадные реки и конфетный самолёт. Сладко и опасно.",
  prehistoric: "Стампида вместо поездов и птеродактиль. Слушай гул земли.",
  halloween: "Призрачные плиты мерцают и исчезают. Не задерживайся на них.",
  storm: "Гроза: дождь, сумрак и ускоренный трафик. Держи ритм, не зевай.",
  flood: "Половодье: вместо лужаек вода. Отдых только на островках.",
  crossroads: "Перекрёсток: только дороги и светофоры. Переходи на красный.",
};

for (const biome of Object.values(BIOMES)) {
  if (!biome.description) biome.description = BIOME_DESCRIPTIONS[biome.id];
}

export function biomeStartRow(biome: BiomeId): number {
  const segment = SEGMENTS.find((entry) => entry.biome === biome);
  return segment?.start ?? 0;
}

