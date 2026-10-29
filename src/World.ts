import * as THREE from "three";
import {
  CLEAN_BEHIND,
  DRAW_AHEAD,
  DRAW_BEHIND,
  FULL_SPAN,
  GEN_AHEAD,
  GROUND_TOP,
  HALF_SPAN,
  HOP_DURATION,
  HOP_HEIGHT,
  LOG_TOP,
  SKINS,
  VEHICLE_TYPES,
  type SkinId,
  type VehicleType
} from "./config";
import { biomeForZ, BIOMES, BIOME_ORDER, BIOME_SPAN, type BiomeDecorKind, type BiomeDef, type BiomeMechanics } from "./biomes";
import type {
  CarData,
  CoinData,
  DeathCause,
  GameEvent,
  LogData,
  PlayerState,
  PropData,
  Row,
  RowType,
  SignData,
  TrainData
} from "./types";
import {
  buildCar,
  buildCharacter,
  buildCoin,
  buildIdleHazard,
  buildLog,
  buildTrain
} from "./Models";
import {
  buildCarShadows,
  buildGrassTop,
  buildPropsMesh,
  buildRailGlows,
  buildStaticRow,
  buildWaterSurface,
  updateCarShadows,
  updateRailGlows
} from "./RowModels";
import type { SceneView } from "./SceneView";
import { clamp, damp, dampAngle, lerp, mulberry32, pick, rr, weightedPick } from "./utils";

const VEHICLE_WEIGHTS = [
  { key: "car" as VehicleType, weight: 6 },
  { key: "taxi" as VehicleType, weight: 2.2 },
  { key: "van" as VehicleType, weight: 2.4 },
  { key: "bus" as VehicleType, weight: 1.2 },
  { key: "truck" as VehicleType, weight: 1.7 },
  { key: "race" as VehicleType, weight: 0.85 },
  { key: "decker" as VehicleType, weight: 0.8 }
];

const DEMO_BIOME_SPAN = 15;
const DEMO_PLAN_STEP = 0.05;
const DEMO_PLAN_MAX_STEPS = 120;
const DEMO_PLAN_MAX_NODES = 4200;
const DEMO_PLAN_MAX_X = 5;
const DEMO_PLAN_MAX_AHEAD = 7;
const EAGLE_IDLE_SECONDS = 15;
const EAGLE_WARNING_SECONDS = 10;
const PLAYER_X_LIMIT = 30;

const DEFAULT_MECHANICS: BiomeMechanics = {
  speed: 1,
  road: 0.43,
  river: 0.22,
  rail: 0.14,
  water: "logs",
  police: false,
  idle: "eagle",
  stampede: false
};

interface DemoAction {
  dx: number;
  dz: number;
  wait: boolean;
}

interface DemoPlanNode {
  x: number;
  z: number;
  step: number;
  ride: LogData | null;
  first: DemoAction | null;
}

interface WorldOptions {
  menu: boolean;
  demo?: boolean;
  demoBiome?: number;
  skin: SkinId;
  sceneView: SceneView;
}

export class World {
  readonly events: GameEvent[] = [];
  readonly player: PlayerState;
  readonly sceneView: SceneView;
  readonly root: THREE.Group;
  private readonly rng: () => number;
  private readonly rows = new Map<number, Row>();
  private readonly playerGroup: THREE.Group;
  private readonly shadow: THREE.Mesh;
  private frontier = 4;
  private back = -38;
  private time = 0;
  private mode: "menu" | "run" | "demo";
  private skinId: SkinId;
  private demoMoveTimer = 0;
  private readonly demoBiomeIndex: number;
  private maxZ = 0;
  private runCoins = 0;
  private deathTime = 0;
  private deathBubbleTimer = 0;
  private shake = 0;
  private idleTime = 0;
  private backwardMoves = 0;
  private idleHazard: THREE.Group | null = null;
  private idleHazardTime = 0;
  private eagleWarnSecond = -1;

  constructor(seed: number, options: WorldOptions) {
    this.rng = mulberry32(seed >>> 0 || 1);
    this.mode = options.demo ? "demo" : options.menu ? "menu" : "run";
    this.demoBiomeIndex = options.demoBiome ?? 0;
    this.skinId = options.skin;
    this.sceneView = options.sceneView;
    this.root = options.sceneView.worldRoot;
    this.shadow = options.sceneView.playerShadow;

    this.player = {
      x: 0,
      z: 0,
      fromX: 0,
      fromZ: 0,
      toX: 0,
      toZ: 0,
      hopT: 1,
      hopping: false,
      queued: null,
      y: 0,
      surfaceY: GROUND_TOP,
      faceYaw: this.mode === "menu" ? Math.PI : 0.16,
      targetYaw: this.mode === "menu" ? Math.PI : 0.16,
      dead: false,
      deathCause: null,
      ridingLog: null,
      runCoins: 0,
      squash: 1,
      bumpT: 0,
      idlePhase: this.rng() * Math.PI * 2
    };

    for (let z = -38; z <= 2; z++) {
      const row = this.makeGrassRow(z, {
        allowProps: z >= 2,
        allowCoin: false
      });
      if (z === 2) {
        row.coin = { x: 1.3, z, value: 1, phase: this.rng() * Math.PI * 2, collected: false };
      }
      this.attachRow(row);
    }
    this.frontier = 2;
    this.generateAhead(35);

    this.playerGroup = buildCharacter(this.skinId);
    this.playerGroup.position.set(this.player.x, 0, this.player.z);
    this.root.add(this.playerGroup);
    this.shadow.visible = true;
    this.syncPlayerVisual(0);
  }

  getMode(): "menu" | "run" | "demo" {
    return this.mode;
  }

  getBiome() {
    return this.biomeAt(this.player.z);
  }

  getNextBiomeBoundary(): number {
    const span = this.mode === "demo" ? DEMO_BIOME_SPAN : BIOME_SPAN;
    const z = Math.max(0, this.player.z);
    return (Math.floor(z / span) + 1) * span;
  }

  private biomeAt(z: number) {
    if (this.mode !== "demo") return biomeForZ(z);
    const demoZ = Math.max(0, z);
    const index =
      ((this.demoBiomeIndex + Math.floor(demoZ / DEMO_BIOME_SPAN)) % BIOME_ORDER.length +
        BIOME_ORDER.length) %
      BIOME_ORDER.length;
    return BIOMES[BIOME_ORDER[index]];
  }

  private mechanicsAt(z: number): BiomeMechanics {
    return this.biomeAt(z).mechanics ?? DEFAULT_MECHANICS;
  }

  getScore(): number {
    return this.maxZ;
  }

  getRunCoins(): number {
    return this.runCoins;
  }

  getShake(): number {
    return this.shake;
  }

  getDeathTime(): number {
    return this.deathTime;
  }

  setSkin(skin: SkinId): void {
    if (skin === this.skinId) return;
    this.skinId = skin;
    const next = buildCharacter(skin);
    for (const child of [...this.playerGroup.children]) {
      this.playerGroup.remove(child);
    }
    for (const child of [...next.children]) {
      this.playerGroup.add(child);
    }
    this.syncPlayerVisual(this.time);
  }

  dispose(): void {
    for (const row of this.rows.values()) {
      this.root.remove(row.group);
    }
    this.rows.clear();
    if (this.idleHazard) {
      this.root.remove(this.idleHazard);
      this.idleHazard = null;
    }
    this.root.remove(this.playerGroup);
    this.shadow.visible = false;
  }

  /* ------------------------------------------------------------------------
     World generation
     ------------------------------------------------------------------------ */

  private blankRow(z: number, type: RowType): Row {
    const group = new THREE.Group();
    group.position.z = z;
    return {
      z,
      type,
      biome: this.biomeAt(z).id,
      group,
      props: [],
      decor: [],
      coin: null,
      cars: [],
      logs: [],
      signs: [],
      train: null,
      dir: 1,
      speed: 0,
      variant: 0
    };
  }

  private attachRow(row: Row): void {
    const prev = this.rows.get(row.z - 1);
    row.staticMesh = buildStaticRow(row, prev?.type ?? null);
    row.group.add(row.staticMesh);

    if (row.type === "grass") {
      row.grassTop = buildGrassTop(row.biome);
      row.group.add(row.grassTop);
    }

    const propsMesh = buildPropsMesh(row.props, row.biome);
    if (propsMesh) {
      row.propsMesh = propsMesh;
      row.group.add(propsMesh);
    }

    if (row.type === "water") {
      row.waterMesh = buildWaterSurface(row.biome);
      row.group.add(row.waterMesh);
    }

    for (const car of row.cars) {
      car.group = buildCar(car);
      car.group.position.x = car.x;
      row.group.add(car.group);
    }
    if (row.cars.length > 0) {
      const shadows = buildCarShadows(row.cars);
      if (shadows) {
        row.carShadows = shadows;
        row.group.add(shadows);
      }
    }
    for (const log of row.logs) {
      log.group = buildLog(log, row.biome);
      log.group.position.x = log.x;
      row.group.add(log.group);
    }
    if (row.type === "rail" && row.train) {
      row.train.group = buildTrain(row.train, true, row.biome);
      row.train.group.position.x = row.train.x;
      row.group.add(row.train.group);
      row.glowLights = buildRailGlows(row);
    }
    if (row.coin) {
      row.coin.mesh = buildCoin(row.coin.value);
      row.coin.mesh.position.set(row.coin.x, 0.03, 0);
      row.group.add(row.coin.mesh);
    }

    this.root.add(row.group);
    if (this.mode === "menu") row.group.visible = false;
    this.rows.set(row.z, row);
  }

  private generateAhead(target: number): void {
    let guard = 0;
    while (this.frontier < target && guard++ < 600) {
      const z = this.frontier + 1;
      const type = this.chooseSegment(z);
      if (type === "road") this.addRoadSegment(z);
      else if (type === "river") this.addRiverSegment(z);
      else if (type === "rail") this.addRailSegment(z);
      else this.addSafeSegment(z);
    }
  }

  private chooseSegment(z: number): "road" | "river" | "rail" | "safe" {
    const r = this.rng();
    const d = clamp(z / 95, 0, 1);
    if (z < 6) return "road";
    if (z < 12) {
      if (r < 0.58) return "road";
      if (r < 0.79) return "river";
      if (r < 0.9) return "rail";
      return "safe";
    }
    if (z < 20) {
      if (r < 0.5) return "road";
      if (r < 0.71) return "river";
      if (r < 0.84) return "rail";
      return "safe";
    }
    const m = this.mechanicsAt(z);
    if (r < m.road + d * 0.04) return "road";
    if (r < m.road + m.river + d * 0.04) return "river";
    if (r < m.road + m.river + m.rail) return "rail";
    return "safe";
  }

  private addSafeSegment(z: number): void {
    const width = 1 + (this.rng() < 0.58 ? 1 : 0);
    for (let i = 0; i < width; i++) {
      this.attachRow(this.makeGrassRow(z + i, { allowProps: true, allowCoin: true }));
    }
    this.frontier = z + width - 1;
  }

  private addRoadSegment(z: number): void {
    const d = clamp(z / 95, 0, 1);
    const width = clamp(1 + Math.floor(this.rng() * (1.45 + d * 2.2)), 1, 4);
    const baseDir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
    for (let i = 0; i < width; i++) {
      const dir: 1 | -1 = i % 2 === 0 ? baseDir : baseDir === 1 ? -1 : 1;
      const speed = rr(this.rng, 1.9, 3.2) * (1 + d * 0.62) * this.mechanicsAt(z + i).speed;
      this.attachRow(this.makeRoadRow(z + i, dir, speed, d));
    }
    this.frontier = z + width - 1;
    this.addSpacer(z + width);
  }

  private addRiverSegment(z: number): void {
    const d = clamp(z / 95, 0, 1);
    const width = clamp(1 + Math.floor(this.rng() * (1.05 + d * 1.45)), 1, 3);
    const baseDir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
    for (let i = 0; i < width; i++) {
      const dir: 1 | -1 = i % 2 === 0 ? baseDir : baseDir === 1 ? -1 : 1;
      const speed = rr(this.rng, 0.85, 1.75) * (1 + d * 0.36);
      this.attachRow(this.makeWaterRow(z + i, dir, speed, d));
    }
    this.frontier = z + width - 1;
    this.addSpacer(z + width);
  }

  private addRailSegment(z: number): void {
    const d = clamp(z / 95, 0, 1);
    this.attachRow(this.makeRailRow(z, d));
    this.frontier = z;
    this.addSpacer(z + 1);
  }

  private addSpacer(z: number): void {
    const width = this.rng() < 0.34 ? 2 : 1;
    for (let i = 0; i < width; i++) {
      this.attachRow(this.makeGrassRow(z + i, { allowProps: true, allowCoin: true }));
    }
    this.frontier = z + width - 1;
  }

  private makeGrassRow(z: number, options: { allowProps: boolean; allowCoin: boolean }): Row {
    const row = this.blankRow(z, "grass");
    row.variant = Math.floor(this.rng() * 4);
    this.addDecor(row);
    if (options.allowProps) this.addProps(row);
    if (options.allowCoin) this.addCoin(row, 0.4, -3.8, 3.8);
    return row;
  }

  private addDecor(row: Row): void {
    const biome = BIOMES[row.biome];
    const count = 3 + Math.floor(this.rng() * 4);
    for (let i = 0; i < count; i++) {
      const kind = weightedPick(this.rng, biome.decorWeights).kind;
      row.decor.push({
        x: rr(this.rng, -16, 16),
        dz: rr(this.rng, -0.42, 0.42),
        kind,
        scale: rr(this.rng, 0.8, 1.5),
        color: this.decorColor(row.biome, kind)
      });
    }
    // A couple of small non-colliding clumps around the central path add life
    // to the large foreground lawn without blocking movement.
    for (let i = 0; i < 2; i++) {
      const kind = weightedPick(this.rng, biome.decorWeights).kind;
      row.decor.push({
        x: rr(this.rng, -4.2, 4.2),
        dz: rr(this.rng, -0.38, 0.38),
        kind,
        scale: rr(this.rng, 0.65, 1.25),
        color: this.decorColor(row.biome, kind)
      });
    }
  }

  private decorColor(biomeId: Row["biome"], kind: BiomeDecorKind): number {
    const biome = BIOMES[biomeId];
    if (kind === "flower") return pick(this.rng, biome.flowers);
    if (kind === "tuft") return this.rng() < 0.5 ? biome.grassLight : biome.grassDark;
    if (kind === "pebble") return this.rng() < 0.5 ? biome.rockLight : biome.rock;
    if (kind === "mushroom") return biome.mushroom;
    if (kind === "shell") return biome.shell;
    if (kind === "crystal") return biome.crystal;
    if (kind === "ember") return biome.ember;
    return biome.snow;
  }

  private addProps(row: Row): void {
    const biome = BIOMES[row.biome];
    const roll = this.rng();
    const count = roll < 0.3 ? 0 : roll < 0.8 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = Math.round(rr(this.rng, -9.5, 9.5) * 2) / 2;
        if (row.z < 5 && Math.abs(x) < 1.7) continue;
        if (this.mode === "menu" && row.z >= -1 && row.z <= 2 && Math.abs(x) < 4.5) continue;
        if (row.props.some((p) => Math.abs(p.x - x) < 1.75)) continue;
        const kind = weightedPick(this.rng, biome.propWeights).kind;
        const radius =
          kind === "tree" || kind === "pine" || kind === "cactus" ? 0.5 :
          kind === "palm" || kind === "deadTree" || kind === "bush" ? 0.4 :
          kind === "rock" || kind === "obelisk" || kind === "snowman" ? 0.45 :
          kind === "ice" || kind === "crystal" || kind === "mushroom" ? 0.38 : 0.32;
        const prop: PropData = {
          x,
          z: row.z,
          kind,
          variant: Math.floor(this.rng() * 4),
          collider: true,
          radius,
          scale: rr(this.rng, 0.88, 1.14)
        };
        row.props.push(prop);
        break;
      }
    }

    // Original Crossy Road frames the road with dense rows of olive trees.
    // Keep them outside the immediate path, but let them crowd the verge.
    if (this.rng() < 0.68) {
      for (const side of [-1, 1] as const) {
        if (this.rng() > 0.78) continue;
        const x = side * rr(this.rng, 5.6, 8.8);
        if (row.props.some((p) => Math.abs(p.x - x) < 1.2)) continue;
        row.props.push({
          x,
          z: row.z,
          kind: "tree",
          variant: Math.floor(this.rng() * 4),
          collider: true,
          radius: 0.5,
          scale: rr(this.rng, 0.92, 1.2)
        });
      }
    }
  }

  private addCoin(row: Row, chance: number, minX: number, maxX: number): void {
    if (row.coin || this.rng() > chance) return;
    for (let attempt = 0; attempt < 5; attempt++) {
      const x = Math.round(rr(this.rng, minX, maxX) * 2) / 2;
      if (row.props.some((p) => p.collider && Math.abs(p.x - x) < 1.05)) continue;
      row.coin = {
        x,
        z: row.z,
        collected: false,
        phase: this.rng() * Math.PI * 2,
        value: this.rng() < 0.07 ? 3 : 1
      };
      return;
    }
  }

  private makeRoadRow(z: number, dir: 1 | -1, speed: number, difficulty: number): Row {
    const row = this.blankRow(z, "road");
    const biome = BIOMES[row.biome];
    row.dir = dir;
    row.speed = speed;
    const gap = rr(this.rng, 4.8, 8.2) - difficulty * 1.7;
    const policePossible = this.mechanicsAt(z).police;
    // Leave a safe circular gap at the lane seam. Without this margin the last
    // car can wrap into the first one and they visibly overlap.
    const laneMargin = 1.1;
    let cursor = -HALF_SPAN + laneMargin + rr(this.rng, 0, 0.6);
    let guard = 0;
    while (cursor < HALF_SPAN && guard++ < 20) {
      const type = weightedPick(this.rng, VEHICLE_WEIGHTS);
      const dims = VEHICLE_TYPES[type.key];
      const len = dims.length;
      if (cursor + len > HALF_SPAN - laneMargin) break;
      const police =
        policePossible && (type.key === "car" || type.key === "taxi") && this.rng() < 0.3;
      const color = police
        ? 0xf1f1e8
        : type.key === "taxi"
          ? biome.accent
          : pick(this.rng, biome.vehicleColors);
      row.cars.push({
        x: cursor + len / 2,
        len,
        width: dims.width,
        type: type.key,
        color,
        dir,
        // Keep one speed per lane. Different per-car speeds (police/race)
        // eventually make faster cars catch and overlap slower traffic.
        speed,
        phase: this.rng() * Math.PI * 2,
        cargo: pick(this.rng, [biome.shell, biome.rockLight, 0xe9edf0, color]),
        police
      });
      cursor += len + Math.max(2.8, gap + rr(this.rng, -0.7, 0.9));
    }
    if (row.cars.length === 0) {
      row.cars.push({
        x: 0,
        len: 1.55,
        width: 0.82,
        type: "car",
        color: pick(this.rng, biome.vehicleColors),
        dir,
        speed,
        phase: this.rng() * Math.PI * 2,
        cargo: biome.shell
      });
    }
    this.addCoin(row, 0.28, -3.9, 3.9);
    return row;
  }

  private makeWaterRow(z: number, dir: 1 | -1, speed: number, difficulty: number): Row {
    const row = this.blankRow(z, "water");
    const style = this.mechanicsAt(z).water;
    row.dir = dir;
    row.speed = speed;
    const gap = rr(this.rng, 1.9, 3.2) + difficulty * 0.35;
    let cursor = -HALF_SPAN + rr(this.rng, -0.7, 1.2);
    let guard = 0;
    while (cursor < HALF_SPAN && guard++ < 30) {
      const len = rr(this.rng, 2.2, 3.55);
      if (cursor + len > HALF_SPAN + 3) break;
      row.logs.push({
        x: cursor + len / 2,
        len,
        speed,
        dir,
        phase: this.rng() * Math.PI * 2,
        variant: Math.floor(this.rng() * 3),
        crocodile: style === "crocodile" && this.rng() < 0.58,
        ice: style === "ice",
        chocolate: style === "chocolate"
      });
      cursor += len + gap + rr(this.rng, -0.28, 0.45);
    }
    if (style === "lily") {
      for (let i = 0; i < 3; i++) {
        row.logs.push({
          x: rr(this.rng, -HALF_SPAN + 3, HALF_SPAN - 3),
          len: 1.35,
          speed: 0,
          dir: 1,
          phase: this.rng() * Math.PI * 2,
          variant: i,
          lily: true
        });
      }
    }
    return row;
  }

  private makeRailRow(z: number, difficulty: number): Row {
    const row = this.blankRow(z, "rail");
    const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
    const signs: SignData[] = [];
    for (const x of [-16, -8, 8, 16]) signs.push({ x });
    row.dir = dir;
    row.signs = signs;
    row.train = {
      active: false,
      warned: false,
      timer: rr(this.rng, 2.2, 5.8),
      x: 0,
      dir,
      speed: 25 + difficulty * 12,
      length: 9.4,
      phase: this.rng() * Math.PI * 2
    };
    return row;
  }

  private addBackRow(): void {
    const z = this.back - 1;
    this.attachRow(this.makeGrassRow(z, { allowProps: true, allowCoin: false }));
    this.back = z;
  }

  private ensureRowsAround(z: number): void {
    this.generateAhead(z + GEN_AHEAD);
    while (this.back > z - CLEAN_BEHIND) this.addBackRow();

    const cutoff = Math.floor(z) - CLEAN_BEHIND;
    if (cutoff > this.back + 1) {
      for (const [rowZ, row] of [...this.rows.entries()]) {
        if (rowZ < cutoff) {
          this.root.remove(row.group);
          this.rows.delete(rowZ);
        }
      }
      this.back = cutoff;
    }
  }

  /* ------------------------------------------------------------------------
     Update
     ------------------------------------------------------------------------ */

  update(dt: number, time: number): void {
    dt = clamp(dt, 0, 0.05);
    this.time = time;
    this.ensureRowsAround(this.player.z);
    this.updateTraffic(dt);
    if (this.mode === "demo" && !this.player.dead) this.updateDemoBot(dt);
    this.updatePlayer(dt, time);
    this.updateIdleHazard(dt);
    this.updateCoins(time);
    this.updateRowVisibility();
    this.shake = damp(this.shake, 0, 5.5, dt);

    if (this.mode !== "menu" && !this.player.dead) {
      this.checkCollisions();
    }
  }

  private updateTraffic(dt: number): void {
    const p = this.player;
    const ref = p.x;
    const nearMin = p.z - 8;
    const nearMax = p.z + 38;

    for (const row of this.rows.values()) {
      if (row.z < nearMin || row.z > nearMax) continue;
      if (row.type === "road") {
        for (const car of row.cars) {
          car.x += car.dir * car.speed * dt;
          if (car.x - car.len * 0.5 > ref + HALF_SPAN) car.x -= FULL_SPAN;
          if (car.x + car.len * 0.5 < ref - HALF_SPAN) car.x += FULL_SPAN;
          if (car.group) car.group.position.x = car.x;
        }
        updateCarShadows(row.carShadows, row.cars);
      } else if (row.type === "water") {
        for (const log of row.logs) {
          log.x += log.dir * log.speed * dt;
          if (log.x - log.len * 0.5 > ref + HALF_SPAN) log.x -= FULL_SPAN;
          if (log.x + log.len * 0.5 < ref - HALF_SPAN) log.x += FULL_SPAN;
          if (log.group) {
            log.group.position.x = log.x;
            const visual = log.group.userData.visual as THREE.Group | undefined;
            if (visual) visual.position.y = Math.sin(this.time * 1.7 + log.phase) * 0.012;
          }
          if (p.ridingLog === log && !p.hopping) {
            p.x = clamp(p.x + log.dir * log.speed * dt, -PLAYER_X_LIMIT, PLAYER_X_LIMIT);
          }
        }
      } else if (row.type === "rail" && row.train) {
        this.updateTrain(row, dt);
      }
    }

    if (p.ridingLog && !p.dead && !p.hopping) {
      const ridingRow = this.rows.get(Math.round(p.z));
      const current = p.ridingLog;
      if (!ridingRow || ridingRow.type !== "water") {
        p.ridingLog = null;
        p.surfaceY = GROUND_TOP;
      } else if (Math.abs(p.x - current.x) < current.len * 0.5 - 0.12) {
        p.surfaceY = current.lily || current.ice ? 0.07 : LOG_TOP;
      } else {
        const next = this.findLog(ridingRow, p.x);
        if (next && !(next.crocodile && Math.abs(next.x + next.dir * next.len * 0.34 - p.x) < 0.36)) {
          p.ridingLog = next;
          p.surfaceY = next.lily || next.ice ? 0.07 : LOG_TOP;
        } else {
          p.ridingLog = null;
          if (this.mode !== "menu") this.die(next?.crocodile ? "crocodile" : "water");
        }
      }
    }
  }

  private updateTrain(row: Row, dt: number): void {
    const train = row.train;
    if (!train) return;
    const p = this.player;
    if (train.group) train.group.position.x = train.x;

    if (!train.active) {
      train.timer -= dt;
      if (!train.warned && train.timer < 2.3) {
        train.warned = true;
        const dist = Math.abs(p.z - row.z);
        if (dist < 9) this.events.push({ type: "horn", volume: clamp(0.075 - dist * 0.007, 0.016, 0.075) });
      }
      if (train.timer <= 0) {
        train.active = true;
        train.x = p.x - train.dir * 44;
      }
    } else {
      train.x += train.dir * train.speed * dt;
      if (train.dir > 0 && train.x > p.x + 43) {
        train.active = false;
        train.warned = false;
        train.timer = rr(this.rng, 6.5, 11);
      } else if (train.dir < 0 && train.x < p.x - 43) {
        train.active = false;
        train.warned = false;
        train.timer = rr(this.rng, 6.5, 11);
      }
    }
    if (train.group) {
      train.group.visible = train.active && row.z > p.z - DRAW_BEHIND;
    }
    updateRailGlows(row, this.time);
  }

  private updatePlayer(dt: number, time: number): void {
    const p = this.player;

    if (this.mode === "menu") {
      p.faceYaw = dampAngle(p.faceYaw, Math.PI + Math.sin(time * 0.5) * 0.14, 3, dt);
      p.targetYaw = p.faceYaw;
      p.squash = damp(p.squash, 1, 11, dt);
      p.bumpT = Math.max(0, p.bumpT - dt);
      this.syncPlayerVisual(time);
      return;
    }

    if (p.dead) {
      this.deathTime += dt;
      this.updateDeath(dt);
      return;
    }

    p.bumpT = Math.max(0, p.bumpT - dt);
    p.faceYaw = dampAngle(p.faceYaw, p.targetYaw, 14, dt);
    p.squash = damp(p.squash, 1, 11, dt);

    if (p.hopping) {
      p.hopT += dt / HOP_DURATION;
      const t = clamp(p.hopT, 0, 1);
      const eased = t * t * (3 - 2 * t);
      p.x = lerp(p.fromX, p.toX, eased);
      p.z = lerp(p.fromZ, p.toZ, eased);
      p.y = Math.sin(t * Math.PI) * HOP_HEIGHT;
      if (t >= 1) this.land();
    } else {
      p.y = 0;
      if (p.ridingLog) p.surfaceY = p.ridingLog.lily || p.ridingLog.ice ? 0.07 : LOG_TOP;
    }

    this.checkCoins();
    this.syncPlayerVisual(time);
  }

  private updateDeath(dt: number): void {
    const p = this.player;
    if (p.deathCause === "water") {
      p.y = -this.deathTime * 0.8;
      p.surfaceY = -0.02;
      this.deathBubbleTimer -= dt;
      if (this.deathBubbleTimer <= 0 && this.deathTime < 0.9) {
        this.deathBubbleTimer = 0.09;
        this.sceneView.particles.spawn({
          x: p.x + (this.rng() - 0.5) * 0.5,
          y: 0.05,
          z: p.z + (this.rng() - 0.5) * 0.5,
          vy: 0.4 + this.rng() * 0.6,
          gravity: -0.4,
          life: 0.5,
          size: 0.05,
          color: 0xd8f8ff
        });
      }
      if (p.y < -0.9) this.playerGroup.visible = false;
    } else {
      p.y = Math.max(0, p.y - dt * 1.4);
      p.squash = clamp(1 - this.deathTime * 3.4, 0.16, 1);
      p.faceYaw += dt * 9;
    }
    this.syncPlayerVisual(this.time);
  }

  private syncPlayerVisual(time: number): void {
    const p = this.player;
    const bob = this.mode === "menu"
      ? Math.sin(time * 2.3 + p.idlePhase) * 0.022
      : !p.hopping && !p.dead
        ? Math.sin(time * 2.8 + p.idlePhase) * 0.012
        : 0;
    const surface = p.deathCause === "water" && p.dead ? -0.02 : p.surfaceY;
    this.playerGroup.position.set(p.x, surface + p.y + bob, p.z);
    this.playerGroup.rotation.y = p.faceYaw;
    const squash = p.dead && p.deathCause !== "water" ? p.squash : 1;
    const menuScale = this.mode === "menu" ? 1.14 : 1;
    this.playerGroup.scale.set(
      menuScale * (1 + (1 - squash) * 0.3),
      menuScale * squash,
      menuScale * (1 + (1 - squash) * 0.3)
    );
    this.playerGroup.visible = !(p.dead && p.deathCause === "water" && this.deathTime > 1.2);

    const hideShadow = p.dead && p.deathCause === "water";
    this.shadow.visible = !hideShadow && p.y > -0.2;
    if (!hideShadow) {
      this.shadow.position.set(p.x, surface + 0.022, p.z);
      const s = clamp(1 - p.y * 0.45, 0.45, 1);
      this.shadow.scale.set(0.95 * s, 0.72 * s, 1);
    }
  }

  private updateCoins(time: number): void {
    for (const row of this.rows.values()) {
      const coin = row.coin;
      if (!coin || !coin.mesh) continue;
      coin.mesh.visible = !coin.collected;
      if (coin.collected) continue;
      coin.mesh.rotation.y = time * 3 + coin.phase;
      coin.mesh.position.y = 0.03 + Math.sin(time * 2.4 + coin.phase) * 0.015;
    }
  }

  private updateRowVisibility(): void {
    if (this.mode === "menu") {
      // The menu uses the dedicated floating diorama; generated rows stay
      // hidden so the showcase composition never turns into a road tunnel.
      for (const row of this.rows.values()) row.group.visible = false;
      return;
    }
    const p = this.player;
    for (const row of this.rows.values()) {
      row.group.visible = row.z >= p.z - DRAW_BEHIND && row.z <= p.z + DRAW_AHEAD;
      if (row.propsMesh) row.propsMesh.visible = row.z >= p.z - DRAW_BEHIND;
      if (row.type === "rail" && row.train) {
        updateRailGlows(row, this.time);
        if (row.z < p.z - DRAW_BEHIND) {
          for (const sprite of row.glowLights ?? []) sprite.visible = false;
        }
      }
    }
  }

  /* ------------------------------------------------------------------------
     Input + player logic
     ------------------------------------------------------------------------ */

  tryMove(dx: number, dz: number): boolean {
    const p = this.player;
    if (p.dead || this.mode === "menu" || this.idleHazard || (!dx && !dz)) return false;

    if (p.hopping) {
      if (p.hopT > 0.58 && !p.queued) p.queued = { dx, dz };
      return false;
    }

    const targetX = p.x + dx;
    const targetZ = p.z + dz;
    if (Math.abs(targetX) > PLAYER_X_LIMIT) {
      p.bumpT = 0.22;
      this.shake = Math.max(this.shake, 0.14);
      this.events.push({ type: "bump" });
      return false;
    }
    const targetRow = this.rows.get(targetZ);
    if (targetRow?.type === "grass") {
      for (const prop of targetRow.props) {
        if (prop.collider && Math.abs(prop.x - targetX) < prop.radius + 0.28) {
          p.bumpT = 0.22;
          this.shake = Math.max(this.shake, 0.16);
          this.events.push({ type: "bump" });
          return false;
        }
      }
    }

    p.fromX = p.x;
    p.fromZ = p.z;
    p.toX = targetX;
    p.toZ = targetZ;
    p.hopT = 0;
    p.hopping = true;
    p.ridingLog = null;
    p.targetYaw = Math.atan2(dx, dz) + 0.14;
    p.squash = 0.82;
    p.queued = null;
    if (this.mode === "run") {
      this.idleTime = 0;
      this.clearEagleWarning();
      if (dz < 0) this.backwardMoves += 1;
      else this.backwardMoves = 0;
    }
    this.events.push({ type: "hop" });
    return true;
  }

  private land(): void {
    const p = this.player;
    p.hopping = false;
    p.hopT = 1;
    p.x = p.toX;
    p.z = p.toZ;
    p.y = 0;
    p.squash = 0.84;

    let row = this.rows.get(Math.round(p.z));
    if (!row) {
      row = this.makeGrassRow(Math.round(p.z), { allowProps: false, allowCoin: false });
      this.attachRow(row);
    }

    if (row.type === "water") {
      const log = this.findLog(row, p.x);
      if (log) {
        if (log.crocodile) {
          const headX = log.x + log.dir * log.len * 0.34;
          if (Math.abs(p.x - headX) < 0.36) {
            this.die("crocodile");
            return;
          }
        }
        p.ridingLog = log;
        p.surfaceY = log.lily || log.ice ? 0.07 : LOG_TOP;
        this.sceneView.particles.burstSplash(p.x, p.z);
      } else {
        this.die("water");
        return;
      }
    } else {
      p.ridingLog = null;
      p.surfaceY = GROUND_TOP;
    }

    this.sceneView.particles.burstDust(p.x, p.z, 5, p.ridingLog ? 0xd8f8ff : 0xd8e8b6);
    this.events.push({ type: "land" });

    if (p.z > this.maxZ) {
      this.maxZ = p.z;
      this.events.push({ type: "score", score: this.maxZ });
    }

    this.checkCoins();
    this.ensureRowsAround(p.z);
    if (!p.dead) this.checkCollisions();

    if (!p.dead && p.queued) {
      const queued = p.queued;
      p.queued = null;
      this.tryMove(queued.dx, queued.dz);
    }
  }

  private updateIdleHazard(dt: number): void {
    const p = this.player;
    if (this.mode !== "run" || p.dead) return;

    if (this.idleHazard) {
      this.idleHazardTime += dt;
      const t = clamp(this.idleHazardTime / 0.72, 0, 1);
      const eased = t * t * (3 - 2 * t);
      this.idleHazard.position.set(
        lerp(this.idleHazard.position.x, p.x, 0.22),
        lerp(5.4, p.y + 0.72, eased),
        lerp(this.idleHazard.position.z, p.z, 0.22)
      );
      this.idleHazard.rotation.z = Math.sin(t * Math.PI) * 0.16;
      if (t >= 1) this.die("eagle");
      return;
    }

    if (p.hopping) {
      this.idleTime = 0;
      this.clearEagleWarning();
      return;
    }

    this.idleTime += dt;
    if (this.idleTime >= EAGLE_WARNING_SECONDS) {
      const remaining = Math.max(1, Math.ceil(EAGLE_IDLE_SECONDS - this.idleTime));
      if (remaining !== this.eagleWarnSecond) {
        this.eagleWarnSecond = remaining;
        this.events.push({ type: "eagle-warning", seconds: remaining });
      }
    } else {
      this.clearEagleWarning();
    }

    if (this.idleTime < EAGLE_IDLE_SECONDS && this.backwardMoves < 3) return;

    const biome = this.biomeAt(p.z);
    this.idleHazard = buildIdleHazard(this.mechanicsAt(p.z).idle, biome.id);
    this.idleHazard.position.set(p.x, 5.4, p.z);
    this.root.add(this.idleHazard);
    this.idleHazardTime = 0;
  }

  private clearEagleWarning(): void {
    if (this.eagleWarnSecond === -1) return;
    this.eagleWarnSecond = -1;
    this.events.push({ type: "eagle-warning", seconds: 0 });
  }

  private updateDemoBot(dt: number): void {
    const p = this.player;
    if (p.hopping || p.dead) return;
    this.demoMoveTimer -= dt;
    if (this.demoMoveTimer > 0) return;

    const action = this.planDemoRoute();
    if (action) {
      if (action.wait) {
        this.demoMoveTimer = 0.05;
        return;
      }
      if (this.tryMove(action.dx, action.dz)) {
        this.demoMoveTimer = 0.16;
        return;
      }
    }

    // No route found: wait on a safe row, but never stop on a road or rail.
    const row = this.rows.get(Math.round(p.z));
    if (row && row.type !== "road" && row.type !== "rail") {
      this.demoMoveTimer = 0.06;
    } else if (!this.tryMove(0, 1)) {
      this.demoMoveTimer = 0.05;
    }
  }

  /**
   * Time-aware lookahead. The bot searches a few seconds into traffic, treats
   * roads/rails as no-wait cells, waits on grass/logs for a safe window, and
   * returns the first action of a route to the next grass row.
   */
  private planDemoRoute(): DemoAction | null {
    const p = this.player;
    const startZ = Math.round(p.z);
    const startX = p.x;
    const buckets: DemoPlanNode[][] = Array.from(
      { length: DEMO_PLAN_MAX_STEPS + 1 },
      () => []
    );
    const visited = new Set<string>();
    const start: DemoPlanNode = {
      x: startX,
      z: startZ,
      step: 0,
      ride: p.ridingLog,
      first: null
    };
    buckets[0].push(start);
    visited.add(this.demoPlanKey(start));

    let expanded = 0;
    for (let step = 0; step <= DEMO_PLAN_MAX_STEPS; step++) {
      const bucket = buckets[step];
      if (!bucket) continue;

      for (const node of bucket) {
        if (++expanded > DEMO_PLAN_MAX_NODES) return null;
        const row = this.rows.get(node.z);
        if (!row) continue;

        if (node.z > startZ && row.type === "grass" && node.first) {
          return node.first;
        }

        // Waiting is only allowed where the player can actually stand.
        if (this.demoCanWait(row, node.ride)) {
          const nextStep = node.step + 1;
          if (nextStep <= DEMO_PLAN_MAX_STEPS) {
            let x = node.x;
            if (node.ride) x += node.ride.dir * node.ride.speed * DEMO_PLAN_STEP;
            if (Math.abs(x - startX) <= DEMO_PLAN_MAX_X) {
              const waitNode: DemoPlanNode = {
                x,
                z: node.z,
                step: nextStep,
                ride: node.ride,
                first: node.first ?? { dx: 0, dz: 0, wait: true }
              };
              const key = this.demoPlanKey(waitNode);
              if (!visited.has(key)) {
                visited.add(key);
                buckets[nextStep].push(waitNode);
              }
            }
          }
        }

        const actions: DemoAction[] = [{ dx: 0, dz: 1, wait: false }];
        if (row.type === "grass" || row.type === "water") {
          actions.push(
            { dx: -1, dz: 0, wait: false },
            { dx: 1, dz: 0, wait: false }
          );
        }

        for (const action of actions) {
          const targetZ = node.z + action.dz;
          if (targetZ > startZ + DEMO_PLAN_MAX_AHEAD) continue;
          const targetX = node.x + action.dx;
          if (Math.abs(targetX - startX) > DEMO_PLAN_MAX_X) continue;
          const targetRow = this.rows.get(targetZ);
          if (!targetRow) continue;

          const landingStep = node.step + 3;
          if (landingStep > DEMO_PLAN_MAX_STEPS) continue;
          const startTime = node.step * DEMO_PLAN_STEP;
          const landingTime = landingStep * DEMO_PLAN_STEP;
          let ride: LogData | null = null;

          if (targetRow.type === "road") {
            if (!this.demoRoadSafe(targetRow, targetX, startTime, landingTime)) continue;
          } else if (targetRow.type === "rail") {
            if (!this.demoTrainSafe(targetRow, landingTime)) continue;
          } else if (targetRow.type === "water") {
            ride = this.demoLogAt(targetRow, targetX, landingTime);
            if (!ride) continue;
          } else if (targetRow.type === "grass") {
            if (!this.demoGrassSafe(targetRow, targetX)) continue;
          }

          const nextFirst = node.first ?? action;
          if (targetRow.type === "grass" && targetZ > startZ) {
            return nextFirst;
          }

          const nextNode: DemoPlanNode = {
            x: targetX,
            z: targetZ,
            step: landingStep,
            ride,
            first: nextFirst
          };
          const key = this.demoPlanKey(nextNode);
          if (visited.has(key)) continue;
          visited.add(key);
          buckets[landingStep].push(nextNode);
        }
      }
    }
    return null;
  }

  private demoPlanKey(node: DemoPlanNode): string {
    const row = this.rows.get(node.z);
    const rideIndex = node.ride && row ? row.logs.indexOf(node.ride) : -1;
    return `${node.step}|${node.z}|${node.x.toFixed(2)}|${rideIndex}`;
  }

  private demoCanWait(row: Row, ride: LogData | null): boolean {
    return row.type === "grass" || (row.type === "water" && !!ride);
  }

  private demoGrassSafe(row: Row, x: number): boolean {
    for (const prop of row.props) {
      if (prop.collider && Math.abs(prop.x - x) < prop.radius + 0.28) return false;
    }
    return true;
  }

  private demoCarClear(row: Row, x: number, t: number): boolean {
    for (const car of row.cars) {
      const carX = car.x + car.dir * car.speed * t;
      if (Math.abs(carX - x) < car.len * 0.5 + 0.3) return false;
    }
    return true;
  }

  private demoRoadSafe(row: Row, x: number, startTime: number, landingTime: number): boolean {
    // Cover the whole hop and the short window after landing. This catches
    // cars that would hit mid-hop, not just exactly at the landing instant.
    for (let t = startTime; t <= landingTime + 0.25 + 0.0001; t += 0.05) {
      if (!this.demoCarClear(row, x, t)) return false;
    }
    return true;
  }

  private demoTrainSafe(row: Row, landingTime: number): boolean {
    const train = row.train;
    if (!train) return true;
    // Never enter the crossing while a train is running or about to spawn.
    if (train.active) return false;
    if (train.timer < landingTime + 0.55) return false;
    return true;
  }

  private demoLogAt(row: Row, x: number, t: number): LogData | null {
    for (const log of row.logs) {
      const logX = log.x + log.dir * log.speed * t;
      if (Math.abs(logX - x) >= log.len * 0.5 - 0.28) continue;
      if (log.crocodile) {
        const headX = logX + log.dir * log.len * 0.34;
        if (Math.abs(headX - x) < 0.42) continue;
      }
      return log;
    }
    return null;
  }

  private findLog(row: Row, x: number): LogData | null {
    for (const log of row.logs) {
      if (Math.abs(x - log.x) < log.len * 0.5 - 0.12) return log;
    }
    return null;
  }

  private checkCoins(): void {
    const p = this.player;
    if (p.dead) return;
    const row = this.rows.get(Math.round(p.z));
    const coin = row?.coin;
    if (!row || !coin || coin.collected) return;
    if (Math.abs(p.x - coin.x) > 0.56) return;
    if (Math.abs(p.z - row.z) > 0.68) return;

    coin.collected = true;
    this.runCoins += coin.value;
    p.runCoins += coin.value;
    this.events.push({ type: "coin", amount: coin.value, total: this.runCoins });
    this.sceneView.particles.burstCoin(coin.x, row.z, coin.value);
  }

  private checkCollisions(): void {
    const p = this.player;
    if (p.dead) return;
    const z = Math.round(p.z);
    for (let dz = -1; dz <= 1; dz++) {
      const row = this.rows.get(z + dz);
      if (!row) continue;
      if (row.type === "road") {
        for (const car of row.cars) {
          if (Math.abs(p.z - row.z) > 0.62) continue;
          if (Math.abs(p.x - car.x) < car.len * 0.5 + 0.26) {
            this.die("car");
            return;
          }
        }
      } else if (row.type === "rail" && row.train?.active) {
        if (Math.abs(p.z - row.z) > 0.62) continue;
        if (Math.abs(p.x - row.train.x) < row.train.length * 0.5 + 0.28) {
          this.die("train");
          return;
        }
      }
    }
  }

  private die(cause: DeathCause): void {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    p.deathCause = cause;
    p.ridingLog = null;
    this.deathTime = 0;
    this.deathBubbleTimer = 0;
    p.hopping = false;
    p.queued = null;
    this.events.push({ type: "death", cause, score: this.maxZ, coins: this.runCoins });

    if (cause === "water") {
      this.shake = Math.max(this.shake, 0.45);
      this.sceneView.particles.burstSplash(p.x, p.z);
      this.shadow.visible = false;
    } else {
      this.shake = Math.max(this.shake, cause === "train" ? 1.05 : 0.7);
      const skin = SKINS[this.skinId];
      this.sceneView.particles.burstFeathers(p.x, p.z, [skin.body, skin.bodyShade, skin.comb, 0xfff7e2]);
      this.sceneView.particles.burstDust(p.x, p.z, 10, 0xd8e8b6);
    }
  }

  getStats(): { rows: number; cars: number; logs: number; props: number } {
    let cars = 0;
    let logs = 0;
    let props = 0;
    for (const row of this.rows.values()) {
      cars += row.cars.length;
      logs += row.logs.length;
      props += row.props.length;
    }
    return { rows: this.rows.size, cars, logs, props };
  }
}
