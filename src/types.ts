import type * as THREE from "three";
import type { SkinId, VehicleType } from "./config";
import type { BiomeDecorKind, BiomeId, BiomePropKind } from "./biomes";

export type GameState = "menu" | "playing" | "paused" | "dying" | "gameover";
export type RowType = "grass" | "road" | "water" | "rail";
export type DeathCause = "car" | "train" | "water" | "eagle" | "crocodile" | "geyser" | "log" | "tumble" | "void" | "ghost";

export interface SaveData {
  best: number;
  coins: number;
  skin: SkinId;
  unlocked: SkinId[];
  favorites: SkinId[];
  muted: boolean;
  musicMuted: boolean;
  runs: number;
  /** 2 = first five heroes are free, the rest cost 10 coins. */
  economyVersion: number;
}

export interface CubeSpec {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: number;
  ry?: number;
  rx?: number;
  rz?: number;
}

export interface PropData {
  x: number;
  z: number;
  kind: BiomePropKind;
  variant: number;
  scale: number;
  collider: boolean;
  radius: number;
}

export interface DecorData {
  x: number;
  dz: number;
  kind: BiomeDecorKind;
  scale: number;
  color: number;
}

export interface CoinData {
  x: number;
  z: number;
  value: number;
  phase: number;
  collected: boolean;
  mesh?: THREE.Group;
}

export interface CarData {
  x: number;
  len: number;
  width: number;
  type: VehicleType;
  color: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  cargo: number;
  police?: boolean;
  group?: THREE.Group;
}

export interface LogData {
  x: number;
  len: number;
  speed: number;
  dir: 1 | -1;
  phase: number;
  variant: number;
  crocodile?: boolean;
  lily?: boolean;
  ice?: boolean;
  chocolate?: boolean;
  group?: THREE.Group;
}

export interface SignData {
  x: number;
  light?: THREE.Sprite;
}

export interface TrainData {
  active: boolean;
  warned: boolean;
  timer: number;
  x: number;
  dir: 1 | -1;
  speed: number;
  length: number;
  phase: number;
  group?: THREE.Group;
}

export interface GeyserData {
  x: number;
  phase: number;
  period: number;
  ring?: THREE.Mesh;
  vent?: THREE.Mesh;
  erupting?: boolean;
}

export type RollerKind = "log" | "tumbleweed";

export interface RollerData {
  x: number;
  dir: 1 | -1;
  speed: number;
  radius: number;
  kind: RollerKind;
  phase: number;
  group?: THREE.Group;
  spin?: THREE.Group;
}

export interface TrafficLightData {
  cycle: number;
  phase: number;
  stop: boolean;
  housing?: THREE.Group;
  red?: THREE.Mesh;
  amber?: THREE.Mesh;
  green?: THREE.Mesh;
}

export type FragileKind = "void" | "ghost";

export interface FragileTileData {
  x: number;
  kind: FragileKind;
  state: "idle" | "warning" | "gone";
  timer: number;
  tile?: THREE.Mesh;
  crack?: THREE.Group;
  hole?: THREE.Mesh;
}

export interface Row {
  z: number;
  type: RowType;
  biome: BiomeId;
  group: THREE.Group;
  staticMesh?: THREE.InstancedMesh;
  propsMesh?: THREE.InstancedMesh;
  props: PropData[];
  decor: DecorData[];
  coin: CoinData | null;
  cars: CarData[];
  logs: LogData[];
  geysers?: GeyserData[];
  rollers?: RollerData[];
  light?: TrafficLightData;
  fragile?: FragileTileData[];
  signs: SignData[];
  train: TrainData | null;
  dir: 1 | -1;
  speed: number;
  variant: number;
  waterMesh?: THREE.Mesh;
  grassTop?: THREE.Mesh;
  carShadows?: THREE.InstancedMesh;
  glowLights?: THREE.Sprite[];
}

export interface PlayerState {
  x: number;
  z: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  hopT: number;
  hopping: boolean;
  queued: { dx: number; dz: number } | null;
  y: number;
  surfaceY: number;
  faceYaw: number;
  targetYaw: number;
  dead: boolean;
  deathCause: DeathCause | null;
  ridingLog: LogData | null;
  runCoins: number;
  squash: number;
  bumpT: number;
  idlePhase: number;
  lastDx: number;
  lastDz: number;
  slide: boolean;
}

export type GameEvent =
  | { type: "hop" }
  | { type: "land" }
  | { type: "bump" }
  | { type: "coin"; amount: number; total: number }
  | { type: "score"; score: number }
  | { type: "horn"; volume: number }
  | { type: "eagle-warning"; seconds: number }
  | { type: "geyser"; volume: number }
  | { type: "death"; cause: DeathCause; score: number; coins: number };
