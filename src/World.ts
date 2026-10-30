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
import {
  biomeForZ,
  biomeSegmentAt,
  BIOMES,
  BIOME_ORDER,
  INTERMEDIATE_SPAN,
  isSpecialBankRow,
  type BiomeDecorKind,
  type BiomeDef,
  type BiomeId,
  type BiomeMechanics
} from "./biomes";
import type {
  CarData,
  BeltData,
  CoinData,
  DeathCause,
  FallerData,
  FragileKind,
  FragileTileData,
  GameEvent,
  GeyserData,
  LeafPileData,
  LogData,
  PlayerState,
  PropData,
  RollerData,
  RollerKind,
  Row,
  RowType,
  SignData,
  SinkholeData,
  TarPitData,
  TrainData
} from "./types";
import {
  buildCar,
  buildCharacter,
  buildCoin,
  buildIdleHazard,
  buildLog,
  buildRoller,
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

/**
 * Target difficulty curve from the design brief. The value is the desired
 * pressure of the biome, from 4 (autumn tutorial) to 90 (void finale).
 * Everything below derives its density/speed from this single curve.
 */
const BIOME_TARGET: Record<BiomeId, number> = {
  autumn: 4,
  forest: 8,
  ocean: 15,
  swamp: 21,
  savanna: 26,
  desert: 28,
  frost: 29,
  candy: 31,
  jungle: 33,
  city: 40,
  prehistoric: 50,
  halloween: 60,
  lava: 70,
  ashlands: 82.5,
  space: 86,
  void: 90,
  storm: 22,
  flood: 15,
  crossroads: 35
};

const HAZARD_TUNE: Partial<Record<BiomeId, number>> = {
  autumn: 0.2,
  forest: 1.4,
  ocean: 0.8,
  swamp: 1.65,
  savanna: 1.07,
  desert: 0.9,
  frost: 1.04,
  candy: 1.4,
  jungle: 1.4,
  city: 1.15,
  prehistoric: 1.05,
  halloween: 0.51,
  lava: 0.8,
  ashlands: 0.9,
  space: 1.15,
  void: 0.62
};



const DEMO_BIOME_SPAN = 15;
const DEMO_PLAN_STEP = 0.05;
const DEMO_PLAN_MAX_STEPS = 120;
const DEMO_PLAN_MAX_NODES = 4200;
const DEMO_PLAN_MAX_X = 5;
const DEMO_PLAN_MAX_AHEAD = 7;
const EAGLE_IDLE_SECONDS = 15;
const EAGLE_WARNING_SECONDS = 10;
const PLAYER_X_LIMIT = 30;
/** How far trees, rocks and decorative props may spread across a row. */
const PROP_SPAN = 30;
// Geyser cycle: calm -> glowing warning (1.5 s) -> eruption (0.7 s) -> calm.
const GEYSER_WARN_SECONDS = 1.5;
const GEYSER_ERUPT_SECONDS = 0.7;
// Fragile floor: crack for 1.2 s, then the plate is gone for 3.2 s.
const FRAGILE_WARN_SECONDS = 1.2;
const FRAGILE_GONE_SECONDS = 3.2;
// Jungle coconuts: shadow grows for 1.2 s, the nut falls for 0.3 s.
const FALLER_WARN_SECONDS = 1.2;
const FALLER_FALL_SECONDS = 0.3;
const FALLER_IMPACT_SECONDS = 0.35;
// Ocean tide: a wave starts behind the hero and rolls forward for a few seconds.
const TIDE_FIRST_DELAY = 4;
const TIDE_GAP = 9;
const TIDE_START_BEHIND = 9;
const TIDE_SPEED = 2.2;
const TIDE_LIFE = 7;
// City traffic cycle: green -> amber -> red.
const LIGHT_GREEN_SECONDS = 4.4;
const LIGHT_AMBER_SECONDS = 0.8;
const LIGHT_CYCLE = LIGHT_GREEN_SECONDS + LIGHT_AMBER_SECONDS + 2.8;
// Swamp quicksand: the mud starts bubbling, then pulls the hero under.
const SINK_WARN_SECONDS = 1.25;
// Ashlands wind: dust telegraph, then a one-cell sideways shove.
const WIND_WARN_SECONDS = 1.15;
const WIND_FIRST_DELAY = 3.2;
const WIND_GAP_MIN = 5.5;
const WIND_GAP_MAX = 8;
const geyserRingGeometry = new THREE.RingGeometry(0.24, 0.44, 24);
const geyserVentGeometry = new THREE.CircleGeometry(0.24, 20);
const fragileTileGeometry = new THREE.BoxGeometry(0.94, 0.06, 0.94);
const fragileHoleGeometry = new THREE.PlaneGeometry(0.94, 0.94);
const fragileCrackGeometry = new THREE.BoxGeometry(0.04, 0.02, 0.62);
const coconutGeometry = new THREE.IcosahedronGeometry(0.32, 0);
const coconutStemGeometry = new THREE.BoxGeometry(0.07, 0.13, 0.07);
const fallerShadowGeometry = new THREE.CircleGeometry(0.42, 18);
const fallerShadowMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.32,
  depthWrite: false
});
const tarPitGeometry = new THREE.CircleGeometry(0.44, 20);
const tarRingGeometry = new THREE.RingGeometry(0.44, 0.52, 20);
const tarBubbleGeometry = new THREE.SphereGeometry(0.06, 6, 4);
const sinkMudGeometry = new THREE.CircleGeometry(0.48, 22);
const sinkRingGeometry = new THREE.RingGeometry(0.4, 0.52, 22);
const leafCubeGeometry = new THREE.BoxGeometry(0.15, 0.06, 0.13);
const leafMaterials = new Map<number, THREE.MeshLambertMaterial>();
const beltBaseTexture = (() => {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffd1e0";
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 16) {
    ctx.fillStyle = "#ff7ea6";
    ctx.fillRect(x, 0, 8, size);
    ctx.fillStyle = "#fff7e2";
    ctx.fillRect(x + 8, 0, 8, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
})();
const lampGeometry = new THREE.CircleGeometry(0.115, 14);
const lightHousingGeometry = new THREE.BoxGeometry(0.46, 1.05, 0.28);
const lightPoleGeometry = new THREE.CylinderGeometry(0.055, 0.055, 3.4, 8);
const lightBaseGeometry = new THREE.BoxGeometry(0.34, 0.12, 0.34);

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

/** Axis-aligned collision footprint in world space, for the debug overlay. */
export interface DebugHitbox {
  x: number;
  z: number;
  hx: number;
  hz: number;
  color: string;
  kind: string;
}

interface WorldOptions {
  menu: boolean;
  demo?: boolean;
  demoBiome?: number;
  skin: SkinId;
  sceneView: SceneView;
  /** Deterministic seed override (used by ?seed=). */
  seed?: number;
  /** Start the run at this row (used by ?row=). */
  startZ?: number;
  /** Force every row of the run into this biome (used by ?biome=). */
  forceBiome?: BiomeId;
  /** Let the autopilot drive the player during a normal run (used by ?bot=1). */
  bot?: boolean;
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
  private readonly tideGroup: THREE.Group;
  private tideActive = false;
  private tideTimer = TIDE_FIRST_DELAY;
  private tideAge = 0;
  private tideZ = 0;
  private windTimer = WIND_FIRST_DELAY;
  private windWarn = 0;
  private windDir: 1 | -1 = 1;
  private frontier = 4;
  private back = -38;
  private time = 0;
  private mode: "menu" | "run" | "demo";
  private skinId: SkinId;
  private demoMoveTimer = 0;
  private readonly demoBiomeIndex: number;
  private maxZ = 0;
  private runCoins = 0;
  private lastCoinZ = -99;
  private deathTime = 0;
  private deathBubbleTimer = 0;
  private shake = 0;
  private idleTime = 0;
  private backwardMoves = 0;
  private idleHazard: THREE.Group | null = null;
  private idleHazardTime = 0;
  private eagleWarnSecond = -1;
  private readonly forceBiomeId: BiomeId | null;
  private readonly botEnabled: boolean;
  private readonly debugStart: number;

  constructor(seed: number, options: WorldOptions) {
    this.rng = mulberry32((options.seed ?? seed) >>> 0 || 1);
    this.mode = options.demo ? "demo" : options.menu ? "menu" : "run";
    this.forceBiomeId = options.forceBiome ?? null;
    this.botEnabled = options.bot === true;
    this.debugStart = options.startZ ?? 0;
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
      idlePhase: this.rng() * Math.PI * 2,
      lastDx: 0,
      lastDz: 1,
      slide: false,
      tarred: false
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
    this.lastCoinZ = 2;
    this.generateAhead(35);

    // Debug launches (?row=) jump straight to a biome: generate up to the
    // requested position, then spawn on the nearest safe grass row.
    const wanted = this.debugStart > 0 ? Math.min(Math.floor(this.debugStart), 600) : 0;
    if (wanted > 2) this.generateAhead(wanted + GEN_AHEAD);
    if (wanted > 0) {
      let spawnZ = wanted;
      let spawnRow: Row | undefined;
      for (let i = 0; i <= 40; i++) {
        const candidate = this.rows.get(wanted - i);
        if (candidate && candidate.type === "grass") {
          spawnZ = candidate.z;
          spawnRow = candidate;
          break;
        }
      }
      const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4];
      let spawnX = 0;
      if (spawnRow) {
        for (const x of offsets) {
          const blocked = spawnRow.props.some(
            (prop) => prop.collider && Math.abs(prop.x - x) < prop.radius + 0.32
          );
          const geyser = (spawnRow.geysers ?? []).some((g) => Math.abs(g.x - x) < 0.8);
          const fragile = (spawnRow.fragile ?? []).some((tile) => Math.abs(tile.x - x) < 0.8);
          const faller = (spawnRow.fallers ?? []).some((drop) => Math.abs(drop.x - x) < 0.8);
          const sink = (spawnRow.sinkholes ?? []).some((hole) => Math.abs(hole.x - x) < 0.8);
          const roller = (spawnRow.rollers ?? []).some(
            (item) => Math.abs(item.x - x) < item.radius + 0.8
          );
          if (!blocked && !geyser && !fragile && !faller && !sink && !roller) {
            spawnX = x;
            break;
          }
        }
      }
      const p = this.player;
      p.x = spawnX;
      p.z = spawnZ;
      p.fromX = spawnX;
      p.fromZ = spawnZ;
      p.toX = spawnX;
      p.toZ = spawnZ;
      this.maxZ = spawnZ;
    }

    this.playerGroup = buildCharacter(this.skinId);
    this.playerGroup.position.set(this.player.x, 0, this.player.z);
    this.root.add(this.playerGroup);
    this.shadow.visible = true;
    this.tideGroup = this.buildTideWave();
    this.syncPlayerVisual(0);
  }

  getMode(): "menu" | "run" | "demo" {
    return this.mode;
  }

  /** True when the run was launched from a debug URL and must not touch records. */
  isDebugRun(): boolean {
    return this.debugStart > 0 || this.forceBiomeId !== null;
  }

  /** Elite cycles are after the first full pass through the 16 biomes. */
  getElite(): boolean {
    if (this.mode !== "run") return false;
    return biomeSegmentAt(Math.max(0, this.player.z)).cycle > 0;
  }

  getBiome() {
    return this.biomeAt(this.player.z);
  }

  getNextBiomeBoundary(): number {
    if (this.mode === "demo") {
      const span = DEMO_BIOME_SPAN;
      const z = Math.max(0, this.player.z);
      return (Math.floor(z / span) + 1) * span;
    }
    return Math.max(1, biomeSegmentAt(Math.max(0, this.player.z)).end);
  }

  /** Upcoming scheduled biomes, used to preload their music ahead of time. */
  getUpcomingBiomes(count = 2): BiomeId[] {
    if (this.mode !== "run" || this.forceBiomeId) return [];
    const result: BiomeId[] = [];
    let z = this.getNextBiomeBoundary();
    for (let i = 0; i < count; i++) {
      const segment = biomeSegmentAt(z);
      result.push(segment.biome);
      z = segment.end;
    }
    return result;
  }

  private biomeAt(z: number) {
    if (this.forceBiomeId) return BIOMES[this.forceBiomeId];
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

  private targetAt(z: number): number {
    return BIOME_TARGET[this.biomeAt(z).id] ?? 4;
  }

  private riskAt(z: number): number {
    return this.targetAt(z) / 100;
  }

  private tuneAt(z: number): number {
    return HAZARD_TUNE[this.biomeAt(z).id] ?? 1;
  }

  private pressureAt(z: number): number {
    return (0.2 + this.riskAt(z) * 3.7) * this.tuneAt(z);
  }

  /** 0 at the bank, 1 after row 95, multiplied by the biome target. */
  private difficultyAt(z: number): number {
    return clamp(z / 95, 0, 1) * this.pressureAt(z);
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
    this.root.remove(this.tideGroup);
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

    for (const geyser of row.geysers ?? []) {
      const ring = new THREE.Mesh(
        geyserRingGeometry,
        new THREE.MeshBasicMaterial({
          color: 0xff8a3d,
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(geyser.x, 0.024, 0);
      ring.renderOrder = 4;
      const vent = new THREE.Mesh(
        geyserVentGeometry,
        new THREE.MeshBasicMaterial({
          color: 0x3a1c12,
          transparent: true,
          opacity: 0.72,
          depthWrite: false
        })
      );
      vent.rotation.x = -Math.PI / 2;
      vent.position.set(geyser.x, 0.022, 0);
      vent.renderOrder = 3;
      row.group.add(vent, ring);
      geyser.ring = ring;
      geyser.vent = vent;
    }

    for (const roller of row.rollers ?? []) {
      const group = buildRoller(roller.kind, row.biome);
      group.position.set(roller.x, 0, 0);
      if (roller.kind === "beast") group.rotation.y = roller.dir === 1 ? 0 : Math.PI;
      roller.group = group;
      roller.spin = group.userData.spin as THREE.Group | undefined;
      row.group.add(group);
    }

    for (const fragile of row.fragile ?? []) this.buildFragileTile(fragile, row);
    for (const faller of row.fallers ?? []) this.buildFaller(faller, row);
    for (const pile of row.leafPiles ?? []) this.buildLeafPile(pile, row);
    for (const pit of row.tarPits ?? []) this.buildTarPit(pit, row);
    for (const hole of row.sinkholes ?? []) this.buildSinkhole(hole, row);
    for (const belt of row.belts ?? []) this.buildBelt(belt, row);

    if (row.light) this.buildTrafficLight(row);

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
    while (this.frontier < target && guard++ < 900) {
      const z = this.frontier + 1;
      const type = this.chooseSegment(z);
      if (type === "road") this.addRoadSegment(z);
      else if (type === "river") this.addRiverSegment(z);
      else if (type === "rail") this.addRailSegment(z);
      else if (type === "bank") this.addBankRow(z);
      else if (type === "flood") this.addFloodRow(z);
      else if (type === "crossroads") this.addCrossroadRow(z);
      else this.addSafeSegment(z);
    }
  }

  private chooseSegment(
    z: number
  ): "road" | "river" | "rail" | "safe" | "bank" | "flood" | "crossroads" {
    // Biome lab: a forced flood/crossroads run repeats the 12-row pattern.
    if (this.forceBiomeId === "flood" || this.forceBiomeId === "crossroads") {
      const rel = ((z % INTERMEDIATE_SPAN) + INTERMEDIATE_SPAN) % INTERMEDIATE_SPAN;
      if (isSpecialBankRow(rel)) return "bank";
      return this.forceBiomeId === "flood" ? "flood" : "crossroads";
    }

    const segment = biomeSegmentAt(z);
    if (
      segment.kind === "intermediate" &&
      (segment.biome === "flood" || segment.biome === "crossroads")
    ) {
      const rel = z - segment.start;
      if (isSpecialBankRow(rel)) return "bank";
      return segment.biome === "flood" ? "flood" : "crossroads";
    }

    // Two safe rows at the start of every main biome, so a new world always
    // begins with a short breather instead of a blind road.
    if (segment.kind === "main" && z - segment.start < 2) return "bank";

    const r = this.rng();
    const d = this.difficultyAt(z);
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

  private segmentRoom(z: number): number {
    return Math.max(1, biomeSegmentAt(z).end - z);
  }

  private addBankRow(z: number): void {
    const row = this.makeGrassRow(z, { allowProps: false, allowCoin: true });
    if (!row.coin) {
      const segment = biomeSegmentAt(z);
      const rel = z - segment.start;
      const firstOfBank =
        segment.kind === "main" ? rel === 0 : rel === 0 || rel === 5 || rel === 10;
      if (firstOfBank) this.addCoin(row, 1, -3.8, 3.8);
    }
    this.attachRow(row);
    this.frontier = z;
  }

  private addFloodRow(z: number): void {
    const d = this.difficultyAt(z);
    const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
    const speed = rr(this.rng, 0.85, 1.6) * (1 + d * 0.3);
    this.attachRow(this.makeWaterRow(z, dir, speed, d));
    this.frontier = z;
  }

  private addCrossroadRow(z: number): void {
    const d = this.difficultyAt(z);
    const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
    const speed =
      rr(this.rng, 1.9, 3.0) * (1 + d * 0.5) * this.mechanicsAt(z).speed;
    this.attachRow(this.makeRoadRow(z, dir, speed, d));
    this.frontier = z;
  }

  private addSafeSegment(z: number): void {
    const width = Math.min(1 + (this.rng() < 0.58 ? 1 : 0), this.segmentRoom(z));
    for (let i = 0; i < width; i++) {
      this.attachRow(this.makeGrassRow(z + i, { allowProps: true, allowCoin: true }));
    }
    this.frontier = z + width - 1;
  }

  private addRoadSegment(z: number): void {
    const d = this.difficultyAt(z);
    const width = Math.min(
      clamp(1 + Math.floor(this.rng() * (1.45 + d * 2.2)), 1, 3),
      this.segmentRoom(z)
    );
    const baseDir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
    for (let i = 0; i < width; i++) {
      const dir: 1 | -1 = i % 2 === 0 ? baseDir : baseDir === 1 ? -1 : 1;
      const speed =
        rr(this.rng, 1.9, 3.2) *
        (1 + d * 0.62) *
        this.mechanicsAt(z + i).speed;
      this.attachRow(this.makeRoadRow(z + i, dir, speed, d));
    }
    this.frontier = z + width - 1;
    this.addSpacer(z + width);
  }

  private addRiverSegment(z: number): void {
    const d = this.difficultyAt(z);
    const width = Math.min(
      clamp(1 + Math.floor(this.rng() * (1.05 + d * 1.45)), 1, 3),
      this.segmentRoom(z)
    );
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
    const d = this.difficultyAt(z);
    this.attachRow(this.makeRailRow(z, d));
    this.frontier = z;
    this.addSpacer(z + 1);
  }

  private addSpacer(z: number): void {
    const width = Math.min(this.rng() < 0.34 ? 2 : 1, this.segmentRoom(z));
    const segment = biomeSegmentAt(z);
    const clearBank =
      (segment.kind === "intermediate" &&
        (segment.biome === "flood" || segment.biome === "crossroads")) ||
      (segment.kind === "main" && z - segment.start < 2);
    for (let i = 0; i < width; i++) {
      this.attachRow(
        this.makeGrassRow(z + i, { allowProps: !clearBank, allowCoin: true })
      );
    }
    this.frontier = z + width - 1;
  }

  private makeGrassRow(z: number, options: { allowProps: boolean; allowCoin: boolean }): Row {
    const row = this.blankRow(z, "grass");
    row.variant = Math.floor(this.rng() * 4);
    this.addDecor(row);
    const mechanics = this.mechanicsAt(z);
    const risk = this.riskAt(z);
    const tune = this.tuneAt(z);
    const chance = (base: number) => Math.min(0.98, base * tune);
    // Keep roller and conveyor rows free of solid props: the hazard crosses
    // the whole lawn, and clipping through a tree trunk looks broken.
    const rollerKind =
      mechanics.rollers && this.mode !== "menu" && this.rng() < chance(0.2 + risk * 0.75)
        ? mechanics.rollers
        : null;
    const belt = mechanics.belts && this.mode !== "menu" && this.rng() < chance(0.3 + risk * 0.4);
    if (options.allowProps && !rollerKind && !belt) this.addProps(row);
    if (mechanics.geysers && this.mode !== "menu" && this.rng() < chance(0.3 + risk * 0.65)) {
      this.addGeysers(row);
    }
    if (rollerKind) this.addRoller(row, rollerKind);
    if (mechanics.fragile && this.mode !== "menu" && this.rng() < chance(0.15 + risk * 0.85)) {
      this.addFragile(row, mechanics.fragile);
    }
    if (mechanics.fallers && this.mode !== "menu" && this.rng() < chance(0.2 + risk * 0.7)) {
      this.addFaller(row);
    }
    if (mechanics.leafPiles && this.mode !== "menu" && this.rng() < 0.55) {
      this.addLeafPiles(row);
    }
    if (mechanics.tarPits && this.mode !== "menu" && this.rng() < chance(0.2 + risk * 0.8)) {
      this.addTarPit(row);
    }
    if (mechanics.sink && options.allowProps && this.mode !== "menu" && this.rng() < chance(0.2 + risk * 0.8)) {
      this.addSinkholes(row);
    }
    if (belt) this.addBelt(row);
    if (options.allowCoin) this.addCoin(row, 0.5, -3.8, 3.8);
    return row;
  }

  private addLeafPiles(row: Row): void {
    const count = this.rng() < 0.6 ? 1 : 2;
    const lane = [-3, -2, -1, 0, 1, 2, 3];
    this.shuffleLane(lane);
    const piles: LeafPileData[] = [];
    for (const x of lane) {
      if (piles.length >= count) break;
      if (row.props.some((prop) => prop.collider && Math.abs(prop.x - x) < prop.radius + 0.55)) continue;
      if ((row.geysers ?? []).some((geyser) => Math.abs(geyser.x - x) < 0.8)) continue;
      if ((row.fallers ?? []).some((faller) => Math.abs(faller.x - x) < 0.8)) continue;
      if ((row.fragile ?? []).some((tile) => Math.abs(tile.x - x) < 0.8)) continue;
      piles.push({ x, collected: false });
    }
    if (piles.length > 0) row.leafPiles = piles;
  }

  private addTarPit(row: Row): void {
    const count =
      (this.rng() < 0.65 ? 1 : 2) + Math.floor(this.riskAt(row.z) * 7 * this.tuneAt(row.z));
    const lane = [-3, -2, -1, 0, 1, 2, 3];
    this.shuffleLane(lane);
    const pits: TarPitData[] = [];
    for (const x of lane) {
      if (pits.length >= count) break;
      if (row.props.some((prop) => prop.collider && Math.abs(prop.x - x) < prop.radius + 0.55)) continue;
      if ((row.geysers ?? []).some((geyser) => Math.abs(geyser.x - x) < 0.8)) continue;
      if ((row.leafPiles ?? []).some((pile) => Math.abs(pile.x - x) < 0.8)) continue;
      pits.push({ x });
    }
    if (pits.length > 0) row.tarPits = pits;
  }

  private addSinkholes(row: Row): void {
    const count =
      (this.rng() < 0.7 ? 1 : 2) + Math.floor(this.riskAt(row.z) * 5 * this.tuneAt(row.z));
    const lanes = [-3, -2, -1, 0, 1, 2, 3];
    this.shuffleLane(lanes);
    const holes: SinkholeData[] = [];
    for (const x of lanes) {
      if (holes.length >= count) break;
      if (row.props.some((prop) => prop.collider && Math.abs(prop.x - x) < prop.radius + 0.55)) continue;
      if ((row.geysers ?? []).some((geyser) => Math.abs(geyser.x - x) < 0.8)) continue;
      if ((row.fallers ?? []).some((faller) => Math.abs(faller.x - x) < 0.8)) continue;
      if ((row.fragile ?? []).some((tile) => Math.abs(tile.x - x) < 0.8)) continue;
      if ((row.leafPiles ?? []).some((pile) => Math.abs(pile.x - x) < 0.8)) continue;
      if ((row.tarPits ?? []).some((pit) => Math.abs(pit.x - x) < 0.8)) continue;
      holes.push({ x, state: "idle", timer: 0 });
    }
    if (holes.length > 0) row.sinkholes = holes;
  }

  private buildSinkhole(sink: SinkholeData, row: Row): void {
    const biome = BIOMES[row.biome];
    const mud = new THREE.Mesh(
      sinkMudGeometry,
      new THREE.MeshLambertMaterial({ color: 0x2c2318, flatShading: true })
    );
    mud.rotation.x = -Math.PI / 2;
    mud.position.set(sink.x, 0.04, 0);
    mud.renderOrder = 2;
    row.group.add(mud);
    sink.mesh = mud;

    const ring = new THREE.Mesh(
      sinkRingGeometry,
      new THREE.MeshBasicMaterial({
        color: biome.accent,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(sink.x, 0.055, 0);
    ring.visible = false;
    ring.renderOrder = 3;
    row.group.add(ring);
    sink.ring = ring;
  }

  private addBelt(row: Row): void {
    const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
    const len = 3 + Math.floor(this.rng() * 3);
    const start = -Math.floor(len / 2);
    row.belts = [
      {
        x0: start,
        x1: start + len - 1,
        dir,
        speed: rr(this.rng, 1.1, 1.9)
      }
    ];
  }

  private shuffleLane(lane: number[]): void {
    for (let i = lane.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const swap = lane[i];
      lane[i] = lane[j];
      lane[j] = swap;
    }
  }

  /** Jungle: a coconut drops onto a cell after its shadow has grown. */
  private addFaller(row: Row): void {
    const count =
      (this.rng() < 0.55 ? 1 : 2) + Math.floor(this.riskAt(row.z) * 10 * this.tuneAt(row.z));
    const lane = [-3, -2, -1, 0, 1, 2, 3];
    for (let i = lane.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const swap = lane[i];
      lane[i] = lane[j];
      lane[j] = swap;
    }
    const fallers: FallerData[] = [];
    for (const x of lane) {
      if (fallers.length >= count) break;
      if (row.props.some((prop) => prop.collider && Math.abs(prop.x - x) < prop.radius + 0.55)) continue;
      if ((row.geysers ?? []).some((geyser) => Math.abs(geyser.x - x) < 0.8)) continue;
      if ((row.rollers ?? []).some((roller) => Math.abs(roller.x - x) < roller.radius + 0.6)) continue;
      if ((row.fragile ?? []).some((tile) => Math.abs(tile.x - x) < 0.8)) continue;
      const period =
        (FALLER_WARN_SECONDS + FALLER_FALL_SECONDS + FALLER_IMPACT_SECONDS + 2.4 + this.rng() * 1.5) /
        this.pressureAt(row.z);
      fallers.push({
        x,
        period,
        phase: this.rng() * period,
        state: "idle",
        timer: 0
      });
    }
    if (fallers.length > 0) row.fallers = fallers;
  }

  /** Void and Halloween ground plates that crack and drop out from under you. */
  private addFragile(row: Row, kind: FragileKind): void {
    const count =
      (this.rng() < 0.6 ? 1 : 2) +
      Math.floor(this.riskAt(row.z) * 5 * this.tuneAt(row.z));
    const lane = [-3, -2, -1, 0, 1, 2, 3];
    for (let i = lane.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const swap = lane[i];
      lane[i] = lane[j];
      lane[j] = swap;
    }
    const tiles: FragileTileData[] = [];
    const warn = clamp(0.35 + (1 - this.riskAt(row.z)) * 0.8, 0.35, 1.2);
    for (const x of lane) {
      if (tiles.length >= count) break;
      if (row.props.some((prop) => prop.collider && Math.abs(prop.x - x) < prop.radius + 0.55)) continue;
      if ((row.geysers ?? []).some((geyser) => Math.abs(geyser.x - x) < 0.8)) continue;
      tiles.push({ x, kind, state: "idle", timer: 0, warn });
    }
    if (tiles.length > 0) row.fragile = tiles;
  }

  /** Forest logs, desert tumbleweeds, and savanna herds crossing safe rows. */
  private addRoller(row: Row, kind: RollerKind): void {
    const dir: 1 | -1 = this.rng() < 0.5 ? 1 : -1;
    const edge = HALF_SPAN + 7;
    const pressure = this.pressureAt(row.z);
    if (kind === "beast") {
      const count = 2 + Math.floor(this.rng() * 2);
      const speed = rr(this.rng, 2.4, 3.6) * pressure;
      const herd: RollerData[] = [];
      for (let i = 0; i < count; i++) {
        herd.push({
          x: -dir * (edge + i * 2.3),
          dir,
          speed,
          radius: 0.55,
          kind,
          phase: this.rng() * Math.PI * 2
        });
      }
      row.rollers = herd;
      return;
    }
    row.rollers = [
      {
        x: -dir * edge,
        dir,
        speed: rr(this.rng, 3.4, 5.4) * pressure,
        radius: kind === "log" ? 0.55 : 0.42,
        kind,
        phase: this.rng() * Math.PI * 2
      }
    ];
  }

  /** Lava ground vents. They sit on walkable cells and telegraph before firing. */
  private addGeysers(row: Row): void {
    const count =
      (this.rng() < 0.55 ? 1 : 2) +
      Math.floor(this.riskAt(row.z) * 8 * this.tuneAt(row.z));
    const lane = [-3, -2, -1, 0, 1, 2, 3];
    for (let i = lane.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const swap = lane[i];
      lane[i] = lane[j];
      lane[j] = swap;
    }
    const geysers: GeyserData[] = [];
    const pressure = this.pressureAt(row.z);
    for (const x of lane) {
      if (geysers.length >= count) break;
      if (row.props.some((prop) => prop.collider && Math.abs(prop.x - x) < prop.radius + 0.55)) continue;
      geysers.push({
        x,
        phase: this.rng() * 6,
        period: (4.6 + this.rng() * 1.4) / pressure
      });
    }
    if (geysers.length > 0) row.geysers = geysers;
  }

  private addDecor(row: Row): void {
    const biome = BIOMES[row.biome];
    const count = 5 + Math.floor(this.rng() * 5);
    for (let i = 0; i < count; i++) {
      const kind = weightedPick(this.rng, biome.decorWeights).kind;
      row.decor.push({
        x: rr(this.rng, -PROP_SPAN, PROP_SPAN),
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

    // Fill the rest of the row, not just the central play strip. Trees and
    // rocks sit on both verges all the way to the edge of the lane; the inner
    // path keeps the same 0–2 props, so the crossing still has a route.
    for (const side of [-1, 1] as const) {
      const outer = this.rng() < 0.8 ? 1 + Math.floor(this.rng() * 2) : 0;
      for (let i = 0; i < outer; i++) {
        const x = side * rr(this.rng, 10.2, PROP_SPAN);
        if (row.props.some((p) => Math.abs(p.x - x) < 1.5)) continue;
        const kind = weightedPick(this.rng, biome.propWeights).kind;
        const radius =
          kind === "tree" || kind === "pine" || kind === "cactus" ? 0.5 :
          kind === "palm" || kind === "deadTree" || kind === "bush" ? 0.4 :
          kind === "rock" || kind === "obelisk" || kind === "snowman" ? 0.45 :
          kind === "ice" || kind === "crystal" || kind === "mushroom" ? 0.38 : 0.32;
        row.props.push({
          x,
          z: row.z,
          kind,
          variant: Math.floor(this.rng() * 4),
          collider: true,
          radius,
          scale: rr(this.rng, 0.88, 1.14)
        });
      }
    }
  }

  private addCoin(row: Row, chance: number, minX: number, maxX: number): void {
    if (row.coin) return;
    // Pity cadence: never let a long stretch go without a coin. This matters
    // most in river- and rail-heavy biomes, where few rows are eligible.
    const forced = row.z - this.lastCoinZ >= 5;
    if (!forced && this.rng() > chance) return;
    for (let attempt = 0; attempt < 5; attempt++) {
      // Keep coins within one sidestep of the centre lane: later roads and
      // rivers make wide detours expensive, so a wide spread reads as a
      // disappearing income even when the spawn rate is fine.
      const x = Math.round(rr(this.rng, minX * 0.58, maxX * 0.58) * 2) / 2;
      if (row.props.some((p) => p.collider && Math.abs(p.x - x) < 1.05)) continue;
      if (row.geysers?.some((g) => Math.abs(g.x - x) < 0.75)) continue;
      if (row.fragile?.some((tile) => Math.abs(tile.x - x) < 0.75)) continue;
      if (row.fallers?.some((faller) => Math.abs(faller.x - x) < 0.75)) continue;
      if (row.leafPiles?.some((pile) => Math.abs(pile.x - x) < 0.75)) continue;
      if (row.tarPits?.some((pit) => Math.abs(pit.x - x) < 0.75)) continue;
      if (row.sinkholes?.some((hole) => Math.abs(hole.x - x) < 0.75)) continue;
      row.coin = {
        x,
        z: row.z,
        collected: false,
        phase: this.rng() * Math.PI * 2,
        value: this.coinValue(row.z)
      };
      this.lastCoinZ = row.z;
      return;
    }
  }

  /** Coins are worth more the deeper the run goes, so the income keeps up. */
  private coinValue(z: number): number {
    return 1 + Math.min(2, Math.floor(Math.max(0, z) / 200));
  }

  private makeRoadRow(z: number, dir: 1 | -1, speed: number, difficulty: number): Row {
    const row = this.blankRow(z, "road");
    const biome = BIOMES[row.biome];
    row.dir = dir;
    row.speed = speed;
    const gap = rr(this.rng, 4.8, 8.2) - difficulty * 1.7;
    const mechanics = this.mechanicsAt(z);
    const policePossible = mechanics.police;
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
    if (mechanics.lights && this.rows.get(z - 1)?.type === "grass" && this.rng() < 0.62) {
      row.light = {
        cycle: LIGHT_CYCLE,
        phase: this.rng() * LIGHT_CYCLE,
        stop: false
      };
    }
    this.addCoin(row, 0.36, -3.9, 3.9);
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
    this.addCoin(row, 0.3, -3.9, 3.9);
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
    this.updateLights(time);
    this.updateTraffic(dt);
    this.updateBelts(dt);
    if ((this.mode === "demo" || (this.mode === "run" && this.botEnabled)) && !this.player.dead) {
      this.updateDemoBot(dt);
    }
    this.applyBelts(dt);
    this.updatePlayer(dt, time);
    this.updateGeysers(dt, time);
    this.updateFragile(dt, time);
    this.updateFallers(dt, time);
    this.updateTide(dt);
    this.updateSinkholes(dt);
    this.updateWind(dt);
    this.updateIdleHazard(dt);
    this.updateCoins(time);
    this.updateLeafPiles();
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
        const stopping = row.light?.stop === true;
        for (const car of row.cars) {
          // Do not freeze a car that is already next to the hero: let it clear
          // the lane first so the red light never slams a car into the player.
          const frozen =
            stopping && (Math.abs(row.z - p.z) > 0.7 || Math.abs(car.x - p.x) > 1.25);
          if (!frozen) {
            car.x += car.dir * car.speed * dt;
            if (car.x - car.len * 0.5 > ref + HALF_SPAN) car.x -= FULL_SPAN;
            if (car.x + car.len * 0.5 < ref - HALF_SPAN) car.x += FULL_SPAN;
          }
          if (car.group) car.group.position.x = car.x;
        }
        updateCarShadows(row.carShadows, row.cars);
      } else if (row.type === "water") {
        for (const log of row.logs) {
          log.x += log.dir * log.speed * dt;
          if (log.x - log.len * 0.5 > ref + HALF_SPAN) log.x -= FULL_SPAN;
          if (log.x + log.len * 0.5 < ref - HALF_SPAN) log.x += FULL_SPAN;
        }
        this.separateLogs(row);
        for (const log of row.logs) {
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
      if (row.rollers) this.updateRollers(row, dt);
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

  /**
   * Wrapping is per-log, so a log entering from one edge can occasionally
   * overlap the last log at the other edge. Push the right-hand log forward
   * until every pair has a visible water gap; this is cheap and keeps the
   * wrap seamless.
   */
  private separateLogs(row: Row): void {
    const logs = row.logs
      .filter((log) => !log.lily)
      .sort((a, b) => a.x - b.x);
    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1];
      const log = logs[i];
      const minLeft = prev.x + prev.len * 0.5 + 0.55;
      const left = log.x - log.len * 0.5;
      if (left < minLeft) log.x += minLeft - left;
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

  /** A stone/ghost plate with cracks and a black hole underneath. */
  private buildFragileTile(fragile: FragileTileData, row: Row): void {
    const isVoid = fragile.kind === "void";
    const base = isVoid ? 0x6b6478 : 0x8d7aad;
    const tile = new THREE.Mesh(
      fragileTileGeometry,
      new THREE.MeshLambertMaterial({ color: base, emissive: 0x000000 })
    );
    tile.position.set(fragile.x, 0.035, 0);

    const crackColor = isVoid ? 0xffb35c : 0xe8c8ff;
    const crackMaterial = new THREE.MeshBasicMaterial({ color: crackColor });
    const crack = new THREE.Group();
    crack.position.set(fragile.x, 0, 0);
    const specs = [
      { x: -0.14, z: 0.08, ry: 0.5, len: 0.62 },
      { x: 0.16, z: -0.06, ry: -0.9, len: 0.5 },
      { x: 0, z: 0.24, ry: 0.2, len: 0.42 }
    ];
    for (const spec of specs) {
      const piece = new THREE.Mesh(fragileCrackGeometry, crackMaterial);
      piece.scale.z = spec.len / 0.62;
      piece.scale.x = 1.4;
      piece.position.set(spec.x, 0.07, spec.z);
      piece.rotation.y = spec.ry;
      crack.add(piece);
    }
    const warnRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.6, 20),
      new THREE.MeshBasicMaterial({
        color: crackColor,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    warnRing.rotation.x = -Math.PI / 2;
    warnRing.position.y = 0.075;
    crack.add(warnRing);
    crack.visible = false;

    const hole = new THREE.Mesh(
      fragileHoleGeometry,
      new THREE.MeshBasicMaterial({ color: 0x040208 })
    );
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(fragile.x, 0.02, 0);
    const holeRim = new THREE.Mesh(
      new THREE.RingGeometry(0.44, 0.5, 20),
      new THREE.MeshBasicMaterial({ color: isVoid ? 0x8b6ff0 : 0xd8a0ff })
    );
    holeRim.position.z = 0.006;
    hole.add(holeRim);
    hole.visible = false;

    row.group.add(hole, tile, crack);
    fragile.tile = tile;
    fragile.crack = crack;
    fragile.hole = hole;
  }

  private buildLeafPile(pile: LeafPileData, row: Row): void {
    const group = new THREE.Group();
    group.position.set(pile.x, 0, 0);
    const colors = [0xff8a3d, 0xffd23f, 0xd96a2b, 0x8a5a2b, 0xffb35c];
    for (let i = 0; i < 9; i++) {
      const color = colors[i % colors.length];
      let material = leafMaterials.get(color);
      if (!material) {
        material = new THREE.MeshLambertMaterial({ color });
        leafMaterials.set(color, material);
      }
      const leaf = new THREE.Mesh(leafCubeGeometry, material);
      leaf.position.set((Math.random() - 0.5) * 0.52, 0.04 + Math.random() * 0.14, (Math.random() - 0.5) * 0.46);
      leaf.rotation.y = Math.random() * Math.PI;
      leaf.rotation.z = (Math.random() - 0.5) * 0.5;
      group.add(leaf);
    }
    row.group.add(group);
    pile.group = group;
  }

  private buildTarPit(pit: TarPitData, row: Row): void {
    const mesh = new THREE.Mesh(
      tarPitGeometry,
      new THREE.MeshBasicMaterial({ color: 0x120d09 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pit.x, 0.028, 0);
    mesh.scale.set(1.15, 0.8, 1);
    const rim = new THREE.Mesh(
      tarRingGeometry,
      new THREE.MeshBasicMaterial({ color: 0x4a3320 })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(pit.x, 0.03, 0);
    rim.scale.set(1.15, 0.8, 1);
    row.group.add(mesh, rim);
    for (let i = 0; i < 3; i++) {
      const bubble = new THREE.Mesh(
        tarBubbleGeometry,
        new THREE.MeshLambertMaterial({ color: 0x2a1c12 })
      );
      bubble.position.set(
        pit.x + (Math.random() - 0.5) * 0.5,
        0.045,
        (Math.random() - 0.5) * 0.3
      );
      row.group.add(bubble);
    }
    pit.mesh = mesh;
  }

  private buildBelt(belt: BeltData, row: Row): void {
    const width = belt.x1 - belt.x0 + 1;
    const texture = beltBaseTexture.clone();
    texture.needsUpdate = true;
    texture.wrapS = THREE.RepeatWrapping;
    texture.repeat.set(width / 1.1, 1);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 0.9),
      new THREE.MeshBasicMaterial({ map: texture })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((belt.x0 + belt.x1) / 2, 0.04, 0);
    row.group.add(mesh);
    const rollerGeometry = new THREE.CylinderGeometry(0.11, 0.11, 0.9, 10);
    const rollerMaterial = new THREE.MeshLambertMaterial({ color: 0xffb6cf });
    for (const x of [belt.x0 - 0.45, belt.x1 + 0.45]) {
      const roller = new THREE.Mesh(rollerGeometry, rollerMaterial);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(x, 0.11, 0);
      row.group.add(roller);
    }
    belt.mesh = mesh;
    belt.texture = texture;
  }

  private buildFaller(faller: FallerData, row: Row): void {
    const shadow = new THREE.Mesh(fallerShadowGeometry, fallerShadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(faller.x, 0.026, 0);
    shadow.visible = false;
    const warnRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffb35c,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    warnRing.position.z = 0.002;
    shadow.add(warnRing);
    const nut = new THREE.Group();
    const fallerColor =
      row.biome === "frost" ? 0xd9f4ff :
      row.biome === "candy" ? 0xff6f9f :
      row.biome === "void" ? 0xc48bff :
      0x6b4a2c;
    const shell = new THREE.Mesh(
      coconutGeometry,
      new THREE.MeshLambertMaterial({ color: fallerColor })
    );
    shell.scale.setScalar(1.2);
    nut.add(shell);
    if (row.biome !== "frost" && row.biome !== "candy" && row.biome !== "void") {
      const stem = new THREE.Mesh(
        coconutStemGeometry,
        new THREE.MeshLambertMaterial({ color: 0x4f8b3e })
      );
      stem.position.y = 0.4;
      nut.add(stem);
    }
    nut.position.set(faller.x, 6, 0);
    nut.visible = false;
    row.group.add(shadow, nut);
    faller.shadow = shadow;
    faller.nut = nut;
  }

  private updateFallers(dt: number, time: number): void {
    if (this.mode === "menu") return;
    const p = this.player;
    if (p.dead) return;
    const nearMin = p.z - 6;
    const nearMax = p.z + 20;
    for (const row of this.rows.values()) {
      if (!row.fallers || row.z < nearMin || row.z > nearMax) continue;
      for (const faller of row.fallers) {
        const local = ((time + faller.phase) % faller.period + faller.period) % faller.period;
        const warnEnd = FALLER_WARN_SECONDS;
        const fallEnd = warnEnd + FALLER_FALL_SECONDS;
        const impactEnd = fallEnd + FALLER_IMPACT_SECONDS;
        const next: FallerData["state"] =
          local < warnEnd
            ? "warn"
            : local < fallEnd
              ? "fall"
              : local < impactEnd
                ? "impact"
                : "idle";

        if (next !== faller.state) {
          faller.state = next;
          if (next === "warn") {
            if (faller.shadow) {
              faller.shadow.visible = true;
              faller.shadow.scale.setScalar(0.55);
            }
          } else if (next === "fall") {
            if (faller.nut) faller.nut.visible = true;
            if (faller.shadow) {
              faller.shadow.visible = true;
              faller.shadow.scale.setScalar(1);
            }
          } else if (next === "impact") {
            if (faller.shadow) faller.shadow.visible = false;
            if (faller.nut) {
              faller.nut.position.y = 0.32;
              faller.nut.scale.set(1.3, 0.4, 1.3);
            }
            this.sceneView.particles.burstDust(faller.x, row.z, 12, 0xb08a52);
            if (Math.abs(row.z - p.z) < 10) this.events.push({ type: "bump" });
            if (
              Math.abs(p.z - row.z) < 0.55 &&
              Math.abs(p.x - faller.x) < 0.45 &&
              p.y < 1.0
            ) {
              this.die("coconut");
              return;
            }
          } else {
            if (faller.shadow) faller.shadow.visible = false;
            if (faller.nut) {
              faller.nut.visible = false;
              faller.nut.scale.set(1, 1, 1);
            }
          }
        }

        if (local >= warnEnd && local < fallEnd) {
          const t = (local - warnEnd) / FALLER_FALL_SECONDS;
          if (faller.nut) {
            faller.nut.position.set(faller.x, 6 - t * t * 5.68, 0);
            faller.nut.rotation.set(t * 4, t * 2, t * 3);
          }
          if (faller.shadow) {
            faller.shadow.visible = true;
            faller.shadow.scale.setScalar(1);
          }
        } else if (local < warnEnd && faller.shadow) {
          faller.shadow.scale.setScalar(0.55 + (local / warnEnd) * 0.45);
        }
      }
    }
  }

  private updateLeafPiles(): void {
    if (this.mode === "menu" || this.player.dead) return;
    const p = this.player;
    if (p.hopping) return;
    const row = this.rows.get(Math.round(p.z));
    if (!row?.leafPiles) return;
    for (const pile of row.leafPiles) {
      if (pile.collected) continue;
      if (Math.abs(p.x - pile.x) > 0.55) continue;
      pile.collected = true;
      if (pile.group) pile.group.visible = false;
      this.runCoins += 2;
      p.runCoins += 2;
      this.events.push({ type: "coin", amount: 2, total: this.runCoins });
      this.sceneView.particles.burstCoin(pile.x, row.z, 3);
      for (let i = 0; i < 8; i++) {
        this.sceneView.particles.spawn({
          x: pile.x + (Math.random() - 0.5) * 0.4,
          y: 0.25,
          z: row.z + (Math.random() - 0.5) * 0.4,
          vx: (Math.random() - 0.5) * 1.2,
          vy: 0.8 + Math.random() * 1.2,
          vz: (Math.random() - 0.5) * 1.2,
          gravity: 2.4,
          life: 0.5 + Math.random() * 0.4,
          size: 0.05 + Math.random() * 0.04,
          color: [0xff8a3d, 0xffd23f, 0xd96a2b][i % 3],
          spin: 7
        });
      }
    }
  }

  private applyBelts(dt: number): void {
    const p = this.player;
    if (this.mode === "menu" || p.dead || p.hopping) return;
    const row = this.rows.get(Math.round(p.z));
    if (!row?.belts) return;
    for (const belt of row.belts) {
      if (p.x < belt.x0 - 0.5 || p.x > belt.x1 + 0.5) continue;
      p.x = clamp(p.x + belt.dir * belt.speed * dt, belt.x0 - 0.5, belt.x1 + 0.5);
    }
  }

  private updateBelts(dt: number): void {
    const p = this.player;
    for (const row of this.rows.values()) {
      if (!row.belts || Math.abs(row.z - p.z) > 20) continue;
      for (const belt of row.belts) {
        if (belt.texture) belt.texture.offset.x -= belt.dir * belt.speed * dt * 0.55;
      }
    }
  }

  private buildTideWave(): THREE.Group {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(46, 0.9, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x1d7f9a })
    );
    base.position.y = 0.45;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(46, 0.7, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x2fa8c8 })
    );
    body.position.y = 1.15;
    const foam = new THREE.Mesh(
      new THREE.BoxGeometry(46, 0.16, 1),
      new THREE.MeshLambertMaterial({ color: 0xdcfaff })
    );
    foam.position.y = 1.55;
    group.add(base, body, foam);
    const foamGeometry = new THREE.BoxGeometry(0.7, 0.25, 0.5);
    const foamMaterial = new THREE.MeshLambertMaterial({ color: 0xeaffff });
    for (let i = 0; i < 20; i++) {
      const crest = new THREE.Mesh(foamGeometry, foamMaterial);
      crest.position.set(
        -23 + i * 2.4 + Math.random() * 0.6,
        1.64 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.6
      );
      crest.scale.set(0.8 + Math.random() * 0.7, 0.6 + Math.random() * 0.9, 0.8 + Math.random() * 0.5);
      crest.rotation.z = (Math.random() - 0.5) * 0.4;
      group.add(crest);
    }
    group.visible = false;
    this.root.add(group);
    return group;
  }

  private updateTide(dt: number): void {
    if (this.mode !== "run") {
      if (this.tideActive) this.hideTide();
      return;
    }
    const isOcean = this.mechanicsAt(this.player.z).tide === true;
    if (!isOcean) {
      if (this.tideActive) this.hideTide();
      this.tideTimer = TIDE_FIRST_DELAY;
      return;
    }

    if (!this.tideActive) {
      this.tideTimer -= dt;
      if (this.tideTimer <= 0) {
        this.tideActive = true;
        this.tideAge = 0;
        this.tideZ = this.player.z - TIDE_START_BEHIND;
        this.tideGroup.position.z = this.tideZ;
        this.tideGroup.visible = true;
        this.events.push({ type: "tide" });
      }
      return;
    }

    this.tideAge += dt;
    this.tideZ += TIDE_SPEED * dt;
    this.tideGroup.position.z = this.tideZ;
    if (Math.random() < dt * 10) {
      this.sceneView.particles.spawn({
        x: (Math.random() - 0.5) * 34,
        y: 1.2,
        z: this.tideZ + (Math.random() - 0.5) * 0.4,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 1 + Math.random() * 1.4,
        vz: 0.4 + Math.random() * 0.8,
        gravity: 4,
        life: 0.4 + Math.random() * 0.3,
        size: 0.06 + Math.random() * 0.08,
        color: Math.random() < 0.5 ? 0xdcfaff : 0x8be1f4,
        spin: 5
      });
    }
    if (!this.player.dead && Math.abs(this.player.z - this.tideZ) < 0.7) {
      this.die("tide");
      return;
    }
    if (
      this.tideAge > TIDE_LIFE ||
      this.tideZ > this.player.z + 12 ||
      this.tideZ < this.player.z - 26
    ) {
      this.hideTide();
    }
  }

  private hideTide(): void {
    this.tideActive = false;
    this.tideTimer = TIDE_GAP;
    this.tideGroup.visible = false;
  }

  private updateSinkholes(dt: number): void {
    if (this.mode === "menu") return;
    const p = this.player;
    if (p.dead) return;
    const nearMin = p.z - 4;
    const nearMax = p.z + 9;

    for (const row of this.rows.values()) {
      if (!row.sinkholes || row.z < nearMin || row.z > nearMax) continue;
      for (const hole of row.sinkholes) {
        const on =
          !p.hopping &&
          Math.abs(p.z - row.z) < 0.55 &&
          Math.abs(p.x - hole.x) < 0.5 &&
          p.y < 1.1;

        if (!on) {
          if (hole.state === "warning") {
            hole.state = "idle";
            hole.timer = 0;
            if (hole.ring) hole.ring.visible = false;
            if (hole.mesh) hole.mesh.scale.set(1, 1, 1);
          }
          continue;
        }

        if (hole.state === "idle") {
          hole.state = "warning";
          hole.timer = 0;
          if (hole.ring) hole.ring.visible = true;
          this.events.push({ type: "sink", seconds: 1 });
          this.shake = Math.max(this.shake, 0.1);
        }

        hole.timer += dt;
        const k = clamp(hole.timer / SINK_WARN_SECONDS, 0, 1);
        if (hole.ring) {
          hole.ring.scale.setScalar(1 + k * 0.55);
          const material = hole.ring.material as THREE.MeshBasicMaterial;
          material.opacity = 0.3 + k * 0.6;
        }
        if (hole.mesh) hole.mesh.scale.set(1 + k * 0.16, 1, 1 + k * 0.16);

        if (Math.random() < dt * 18) {
          this.sceneView.particles.spawn({
            x: hole.x + (Math.random() - 0.5) * 0.5,
            y: 0.05,
            z: row.z + (Math.random() - 0.5) * 0.5,
            vy: 0.45 + Math.random() * 0.4,
            gravity: 1.1,
            life: 0.35 + Math.random() * 0.3,
            size: 0.04 + Math.random() * 0.05,
            color: 0x9fe86a
          });
        }

        if (hole.timer >= SINK_WARN_SECONDS) {
          this.die("sink");
          return;
        }
      }
    }
  }

  private updateWind(dt: number): void {
    if (this.mode !== "run" || this.player.dead) return;
    const p = this.player;
    if (this.mechanicsAt(p.z).wind !== true) {
      this.windWarn = 0;
      this.windTimer = WIND_FIRST_DELAY;
      return;
    }

    if (this.windWarn > 0) {
      this.windWarn -= dt;
      this.spawnWindDust(dt);
      if (this.windWarn <= 0) {
        this.windWarn = 0;
        if (!p.hopping && !p.dead) {
          const row = this.rows.get(Math.round(p.z));
          if (row?.type === "grass") {
            const first = this.windDir;
            if (!this.tryMove(first, 0)) this.tryMove((first === 1 ? -1 : 1), 0);
          }
        }
        this.windTimer = rr(this.rng, WIND_GAP_MIN, WIND_GAP_MAX);
      }
      return;
    }

    this.windTimer -= dt;
    if (this.windTimer > 0) return;
    if (p.hopping || p.dead) {
      this.windTimer = 0.5;
      return;
    }
    const row = this.rows.get(Math.round(p.z));
    if (!row || row.type !== "grass") {
      this.windTimer = 0.6;
      return;
    }
    const left = this.windCellOpen(p.x - 1, row);
    const right = this.windCellOpen(p.x + 1, row);
    if (!left && !right) {
      this.windTimer = 2;
      return;
    }
    this.windDir = left && right ? (this.rng() < 0.5 ? -1 : 1) : left ? -1 : 1;
    this.windWarn = WIND_WARN_SECONDS;
    this.events.push({ type: "wind", seconds: 1 });
    this.shake = Math.max(this.shake, 0.06);
  }

  private windCellOpen(x: number, row: Row): boolean {
    if (Math.abs(x) > 4) return false;
    if (row.props.some((prop) => prop.collider && Math.abs(prop.x - x) < prop.radius + 0.28)) return false;
    if ((row.sinkholes ?? []).some((hole) => Math.abs(hole.x - x) < 0.5)) return false;
    if ((row.fragile ?? []).some((tile) => tile.state !== "idle" && Math.abs(tile.x - x) < 0.55)) return false;
    if ((row.geysers ?? []).some((geyser) => Math.abs(geyser.x - x) < 0.6)) return false;
    return true;
  }

  private spawnWindDust(dt: number): void {
    if (Math.random() > dt * 30) return;
    const p = this.player;
    const dir = this.windDir;
    this.sceneView.particles.spawn({
      x: p.x - dir * 2.6 + (Math.random() - 0.5) * 1.6,
      y: 0.12 + Math.random() * 0.8,
      z: p.z + (Math.random() - 0.5) * 0.9,
      vx: dir * (2.6 + Math.random() * 1.8),
      vy: 0.05 + Math.random() * 0.2,
      vz: (Math.random() - 0.5) * 0.35,
      gravity: 0,
      life: 0.3 + Math.random() * 0.25,
      size: 0.04 + Math.random() * 0.06,
      color: 0xd8b090
    });
  }

  private updateFragile(dt: number, time: number): void {    if (this.mode === "menu") return;
    const p = this.player;
    if (p.dead) return;
    const nearMin = p.z - 6;
    const nearMax = p.z + 20;
    for (const row of this.rows.values()) {
      if (!row.fragile || row.z < nearMin || row.z > nearMax) continue;
      for (const fragile of row.fragile) {
        const on =
          !p.hopping &&
          Math.abs(p.z - row.z) < 0.55 &&
          Math.abs(p.x - fragile.x) < 0.5 &&
          p.y < 1.1;

        if (fragile.state === "idle") {
          if (on) {
            fragile.state = "warning";
            fragile.timer = fragile.warn ?? FRAGILE_WARN_SECONDS;
            if (fragile.crack) fragile.crack.visible = true;
          }
          continue;
        }

        if (fragile.state === "warning") {
          fragile.timer -= dt;
          const k = clamp(1 - fragile.timer / (fragile.warn ?? FRAGILE_WARN_SECONDS), 0, 1);
          if (fragile.tile) {
            const material = fragile.tile.material as THREE.MeshLambertMaterial;
            const base = fragile.kind === "void" ? 0x6b6478 : 0x8d7aad;
            const warn = fragile.kind === "void" ? 0xff8a3d : 0xd8a0ff;
            material.color.setHex(warn);
            material.emissive.setHex(warn);
            material.emissiveIntensity = 0.3 + Math.abs(Math.sin(time * 18)) * 0.35;
            fragile.tile.position.set(
              fragile.x + (Math.random() - 0.5) * 0.02 * k,
              0.035,
              (Math.random() - 0.5) * 0.02 * k
            );
            fragile.tile.scale.y = 1 + k * 0.12;
          }
          if (fragile.timer <= 0) {
            fragile.state = "gone";
            fragile.timer = FRAGILE_GONE_SECONDS;
            if (fragile.tile) fragile.tile.visible = false;
            if (fragile.crack) fragile.crack.visible = false;
            if (fragile.hole) fragile.hole.visible = true;
            if (on) {
              this.die(fragile.kind);
              return;
            }
          }
          continue;
        }

        fragile.timer -= dt;
        if (on) {
          this.die(fragile.kind);
          return;
        }
        if (fragile.timer <= 0) {
          fragile.state = "idle";
          fragile.timer = 0;
          if (fragile.tile) {
            fragile.tile.visible = true;
            fragile.tile.position.set(fragile.x, 0.035, 0);
            fragile.tile.scale.set(1, 1, 1);
            const material = fragile.tile.material as THREE.MeshLambertMaterial;
            material.color.setHex(fragile.kind === "void" ? 0x6b6478 : 0x8d7aad);
            material.emissive.setHex(0x000000);
            material.emissiveIntensity = 0;
          }
          if (fragile.hole) fragile.hole.visible = false;
        }
      }
    }
  }

  /** A cantilever signal over the lane, fed by a pole on the lawn behind it. */
  private buildTrafficLight(row: Row): void {
    const light = row.light;
    if (!light) return;
    const prev = this.rows.get(row.z - 1);
    const blocked = (x: number): boolean =>
      prev?.props.some((prop) => prop.collider && Math.abs(prop.x - x) < 0.9) ?? false;
    let poleX = 6;
    if (blocked(poleX)) poleX = -6;
    const group = new THREE.Group();
    const metal = new THREE.MeshLambertMaterial({ color: 0x2a3238 });
    const base = new THREE.Mesh(lightBaseGeometry, metal);
    base.position.set(poleX, 0.06, -1);
    const pole = new THREE.Mesh(lightPoleGeometry, metal);
    pole.position.set(poleX, 1.7, -1);
    const zBeam = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 1), metal);
    zBeam.position.set(poleX, 3.35, -0.5);
    const xBeam = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(poleX), 0.09, 0.09), metal);
    xBeam.position.set(poleX / 2, 3.35, 0);
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.24, 5),
      new THREE.MeshBasicMaterial({ color: 0x1c2226 })
    );
    cable.position.set(0, 3.23, 0);
    const housing = new THREE.Mesh(
      lightHousingGeometry,
      new THREE.MeshLambertMaterial({ color: 0x232a2f })
    );
    housing.position.set(0, 2.6, 0);
    group.add(base, pole, zBeam, xBeam, cable, housing);
    const makeLamp = (y: number): THREE.Mesh => {
      const lamp = new THREE.Mesh(
        lampGeometry,
        new THREE.MeshBasicMaterial({ color: 0x2a2426, side: THREE.DoubleSide })
      );
      lamp.position.set(0, y, -0.15);
      lamp.rotation.y = Math.PI;
      group.add(lamp);
      return lamp;
    };
    light.red = makeLamp(2.92);
    light.amber = makeLamp(2.6);
    light.green = makeLamp(2.28);
    light.housing = group;
    row.group.add(group);
  }

  private updateLights(time: number): void {
    for (const row of this.rows.values()) {
      const light = row.light;
      if (!light || !light.housing) continue;
      const local = ((time + light.phase) % light.cycle + light.cycle) % light.cycle;
      const state =
        local < LIGHT_GREEN_SECONDS
          ? "green"
          : local < LIGHT_GREEN_SECONDS + LIGHT_AMBER_SECONDS
            ? "amber"
            : "red";
      light.stop = state !== "green";
      this.setLamp(light.red, state === "red", 0xff3b30);
      this.setLamp(light.amber, state === "amber", 0xffb02e);
      this.setLamp(light.green, state === "green", 0x42e06a);
    }
  }

  private setLamp(lamp: THREE.Mesh | undefined, lit: boolean, color: number): void {
    if (!lamp) return;
    (lamp.material as THREE.MeshBasicMaterial).color.setHex(lit ? color : 0x2a2426);
  }

  private updateRollers(row: Row, dt: number): void {
    const p = this.player;
    const reach = Math.abs(p.x) + HALF_SPAN + 7;
    for (const roller of row.rollers ?? []) {
      roller.x += roller.dir * roller.speed * dt;
      if (roller.x > reach) roller.x = -reach;
      else if (roller.x < -reach) roller.x = reach;
      if (roller.group) roller.group.position.x = roller.x;
      if (roller.kind === "beast") {
        if (roller.spin) {
          roller.spin.position.y =
            0.02 + Math.abs(Math.sin(this.time * 11 + roller.phase)) * 0.05;
        }
      } else if (roller.spin) {
        roller.spin.rotation.z -= (roller.dir * roller.speed * dt) / 0.32;
      }
      if (Math.random() < dt * 9) {
        this.sceneView.particles.spawn({
          x: roller.x + (Math.random() - 0.5) * 0.25,
          y: 0.06,
          z: row.z + (Math.random() - 0.5) * 0.35,
          vx: -roller.dir * (0.35 + Math.random() * 0.5),
          vy: 0.5 + Math.random() * 0.7,
          vz: (Math.random() - 0.5) * 0.3,
          gravity: 3.2,
          life: 0.25 + Math.random() * 0.2,
          size: 0.04 + Math.random() * 0.04,
          color:
            roller.kind === "beast" ? 0xd8c08a : roller.kind === "log" ? 0xb98b56 : 0xd8b27a,
          spin: 4
        });
      }
      if (
        !p.dead &&
        Math.abs(p.z - row.z) < 0.62 &&
        Math.abs(p.x - roller.x) < roller.radius + 0.3
      ) {
        this.die(roller.kind === "log" ? "log" : roller.kind === "beast" ? "beast" : "tumble");
        return;
      }
    }
  }

  private updateGeysers(dt: number, time: number): void {
    if (this.mode === "menu") return;
    const p = this.player;
    if (p.dead) return;
    const nearMin = p.z - 7;
    const nearMax = p.z + 22;

    for (const row of this.rows.values()) {
      if (!row.geysers || row.z < nearMin || row.z > nearMax) continue;
      for (const geyser of row.geysers) {
        const cycle = ((time + geyser.phase) % geyser.period + geyser.period) % geyser.period;
        const eruptStart = geyser.period - GEYSER_ERUPT_SECONDS;
        const warnStart = eruptStart - GEYSER_WARN_SECONDS;
        const erupting = cycle >= eruptStart;

        if (geyser.ring) {
          const material = geyser.ring.material as THREE.MeshBasicMaterial;
          if (cycle >= warnStart) {
            const k = (cycle - warnStart) / GEYSER_WARN_SECONDS;
            const pulse = 0.5 + Math.abs(Math.sin(cycle * (7 + k * 9))) * 0.5;
            geyser.ring.scale.setScalar(1 + k * 0.5 + (erupting ? 0.35 : 0));
            material.opacity = 0.3 + pulse * 0.6;
          } else {
            geyser.ring.scale.setScalar(1);
            material.opacity = 0.2;
          }
        }

        if (erupting && !geyser.erupting) {
          geyser.erupting = true;
          const distance = Math.abs(row.z - p.z);
          if (distance < 11) {
            this.events.push({ type: "geyser", volume: clamp(0.1 - distance * 0.008, 0.02, 0.1) });
            this.shake = Math.max(this.shake, 0.24);
          }
        } else if (!erupting) {
          geyser.erupting = false;
        }

        if (!erupting || Math.abs(row.z - p.z) > 14) continue;
        if (Math.random() < Math.min(1, dt * 22)) {
          this.sceneView.particles.spawn({
            x: geyser.x + (Math.random() - 0.5) * 0.5,
            y: 0.05,
            z: row.z + (Math.random() - 0.5) * 0.5,
            vx: (Math.random() - 0.5) * 0.7,
            vy: 2.2 + Math.random() * 2.8,
            vz: (Math.random() - 0.5) * 0.7,
            gravity: 6.5,
            life: 0.32 + Math.random() * 0.3,
            size: 0.05 + Math.random() * 0.09,
            color: Math.random() < 0.4 ? 0xffe08a : 0xff7a2a,
            spin: 6
          });
        }
        if (Math.abs(p.z - row.z) < 0.64 && Math.abs(p.x - geyser.x) < 0.52 && p.y < 1.2) {
          this.die("geyser");
          return;
        }
      }
    }
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
      const mechanics = this.mechanicsAt(p.z);
      const gravity = mechanics.gravity ?? 1;
      // Low gravity stretches the arc; a slide is a fast, low glide.
      const duration = HOP_DURATION * gravity * (p.slide ? 1.6 : 1) * (p.tarred ? 1.75 : 1);
      p.hopT += dt / duration;
      const t = clamp(p.hopT, 0, 1);
      const eased = t * t * (3 - 2 * t);
      p.x = lerp(p.fromX, p.toX, eased);
      p.z = lerp(p.fromZ, p.toZ, eased);
      p.y = Math.sin(t * Math.PI) * HOP_HEIGHT * Math.sqrt(gravity) * (p.slide ? 0.55 : 1);
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
    if (p.deathCause === "water" || p.deathCause === "sink") {
      const sinking = p.deathCause === "sink";
      p.y = -this.deathTime * (sinking ? 0.55 : 0.8);
      p.surfaceY = -0.02;
      this.deathBubbleTimer -= dt;
      if (this.deathBubbleTimer <= 0 && this.deathTime < (sinking ? 0.8 : 0.9)) {
        this.deathBubbleTimer = 0.09;
        this.sceneView.particles.spawn({
          x: p.x + (this.rng() - 0.5) * 0.5,
          y: 0.05,
          z: p.z + (this.rng() - 0.5) * 0.5,
          vy: 0.4 + this.rng() * 0.6,
          gravity: -0.4,
          life: 0.5,
          size: 0.05,
          color: sinking ? 0x8a7a3a : 0xd8f8ff
        });
      }
      if (p.y < (sinking ? -0.75 : -0.9)) this.playerGroup.visible = false;
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
    const surface = (p.deathCause === "water" || p.deathCause === "sink") && p.dead ? -0.02 : p.surfaceY;
    this.playerGroup.position.set(p.x, surface + p.y + bob, p.z);
    this.playerGroup.rotation.y = p.faceYaw;
    const squash = p.dead && p.deathCause !== "water" && p.deathCause !== "sink" ? p.squash : 1;
    const menuScale = this.mode === "menu" ? 1.14 : 1;
    this.playerGroup.scale.set(
      menuScale * (1 + (1 - squash) * 0.3),
      menuScale * squash,
      menuScale * (1 + (1 - squash) * 0.3)
    );
    this.playerGroup.visible = !(
      p.dead &&
      (p.deathCause === "water" || p.deathCause === "sink") &&
      this.deathTime > (p.deathCause === "sink" ? 1 : 1.2)
    );

    const hideShadow = p.dead && (p.deathCause === "water" || p.deathCause === "sink");
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
      for (const fragile of targetRow.fragile ?? []) {
        if (fragile.state === "gone" && Math.abs(fragile.x - targetX) < 0.55) {
          p.bumpT = 0.22;
          this.shake = Math.max(this.shake, 0.14);
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
    p.lastDx = dx;
    p.lastDz = dz;
    p.slide = false;
    p.targetYaw = Math.atan2(dx, dz) + 0.14;
    p.squash = 0.82;
    p.queued = null;
    if (p.tarred) this.sceneView.particles.burstDust(p.x, p.z, 5, 0x3a2a1e);
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
    const wasSlide = p.slide;
    p.slide = false;
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

    p.tarred =
      row.type === "grass" && (row.tarPits ?? []).some((pit) => Math.abs(pit.x - p.x) < 0.5);
    if (p.tarred) this.sceneView.particles.burstDust(p.x, p.z, 6, 0x3a2a1e);

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

    // Frost: the landing carries the hero one more cell in the hop direction.
    // Only the first landing of a player-made hop slides, so ice cannot chain.
    if (
      !p.dead &&
      !p.queued &&
      !wasSlide &&
      this.mode !== "menu" &&
      row.type === "grass" &&
      this.mechanicsAt(p.z).slide
    ) {
      this.startSlide();
      return;
    }

    if (!p.dead && p.queued) {
      const queued = p.queued;
      p.queued = null;
      this.tryMove(queued.dx, queued.dz);
    }
  }

  /** Frost: keep gliding one cell in the direction of the last hop. */
  private startSlide(): void {
    const p = this.player;
    const dx = p.lastDx;
    const dz = p.lastDz;
    if (!dx && !dz) return;
    const targetX = p.x + dx;
    const targetZ = p.z + dz;
    if (Math.abs(targetX) > PLAYER_X_LIMIT) return;
    const row = this.rows.get(targetZ);
    if (!row || row.type !== "grass") return;
    if (row.props.some((prop) => prop.collider && Math.abs(prop.x - targetX) < prop.radius + 0.28)) return;
    if ((row.geysers ?? []).some((g) => Math.abs(g.x - targetX) < 0.7)) return;
    if ((row.fragile ?? []).some((tile) => Math.abs(tile.x - targetX) < 0.7)) return;
    if ((row.sinkholes ?? []).some((hole) => Math.abs(hole.x - targetX) < 0.7)) return;

    p.fromX = p.x;
    p.fromZ = p.z;
    p.toX = targetX;
    p.toZ = targetZ;
    p.hopT = 0;
    p.hopping = true;
    p.ridingLog = null;
    p.slide = true;
    p.targetYaw = Math.atan2(dx, dz) + 0.14;
    p.squash = 0.9;
    p.queued = null;
    this.sceneView.particles.burstDust(p.x, p.z, 6, 0xdff4ff);
    this.events.push({ type: "hop" });
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

    // Anti-eagle insurance: never let the autopilot stand still for 4 s.
    // Prefer a side step, then forward/backward, but only onto a cell that is
    // safe for the current traffic/log/geyser phase.
    if (this.idleTime >= 3.5 && this.emergencyBotMove()) {
      this.demoMoveTimer = 0.1;
      return;
    }

    this.demoMoveTimer -= dt;
    if (this.demoMoveTimer > 0) return;

    // The tide is right behind: run forward even if the planner wanted to wait.
    if (this.tideActive && this.tideZ > this.player.z - 5) {
      if (this.tryMove(0, 1)) {
        this.demoMoveTimer = 0.1;
        return;
      }
    }

    // A log or tumbleweed is about to reach the hero: sidestep it first.
    const here = this.rows.get(Math.round(p.z));
    const sink = here?.sinkholes?.find((hole) => Math.abs(hole.x - p.x) < 0.5);
    if (sink) {
      for (const action of [
        { dx: 0, dz: 1 },
        { dx: 1, dz: 0 },
        { dx: -1, dz: 0 },
        { dx: 0, dz: -1 }
      ]) {
        if (this.tryMove(action.dx, action.dz)) {
          this.demoMoveTimer = 0.1;
          return;
        }
      }
    }
    const threat = here?.rollers?.find((roller) => Math.abs(roller.x - p.x) < 2.8);
    if (threat) {
      const away = Math.sign(p.x - threat.x) || 1;
      // Try both side steps, then a forward/back hop: a roller can pin the
      // hero against the lane edge, and waiting there is a guaranteed hit.
      for (const action of [
        { dx: away, dz: 0 },
        { dx: -away, dz: 0 },
        { dx: 0, dz: 1 },
        { dx: 0, dz: -1 }
      ]) {
        if (this.tryMove(action.dx, action.dz)) {
          this.demoMoveTimer = 0.1;
          return;
        }
      }
    }

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

  private botLandingSafe(dx: number, dz: number): boolean {
    const targetX = this.player.x + dx;
    const targetZ = Math.round(this.player.z) + dz;
    const row = this.rows.get(targetZ);
    if (!row) return false;
    const landing = this.time + this.demoHopSeconds();
    if (row.type === "road") {
      return this.demoRoadSafe(row, targetX, this.time, landing);
    }
    if (row.type === "rail") {
      return this.demoTrainSafe(row, landing);
    }
    if (row.type === "water") {
      return this.demoLogAt(row, targetX, landing) !== null;
    }
    return this.demoGrassSafe(row, targetX, landing);
  }

  /** Last-resort safe hop for a stalled autopilot. */
  private emergencyBotMove(): boolean {
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [2, 0],
      [-2, 0],
      [0, 2]
    ]) {
      if (this.botLandingSafe(dx, dz) && this.tryMove(dx, dz)) return true;
    }
    return false;
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

        // Waiting is only allowed where the player can actually stand, and
        // never as the very first action: the caller already waits on a safe
        // row and re-plans, so a root wait would loop forever.
        if (node.step > 0 && this.demoCanWait(row, node.ride)) {
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

          const landingStep =
            node.step + Math.max(3, Math.ceil(this.demoHopSeconds() / DEMO_PLAN_STEP));
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
            if (!this.demoGrassSafe(targetRow, targetX, landingTime)) continue;
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

  /** Match the planner's landing window to the biome's real hop duration. */
  private demoHopSeconds(): number {
    const p = this.player;
    const gravity = this.mechanicsAt(p.z).gravity ?? 1;
    return HOP_DURATION * gravity * (p.slide ? 1.6 : 1) * (p.tarred ? 1.75 : 1);
  }

  private demoGrassSafe(row: Row, x: number, time = 0): boolean {
    for (const prop of row.props) {
      if (prop.collider && Math.abs(prop.x - x) < prop.radius + 0.28) return false;
    }
    for (const geyser of row.geysers ?? []) {
      if (Math.abs(geyser.x - x) >= 0.65) continue;
      // A vent is only dangerous while it is warning or erupting. Use the
      // actual phase so the bot can cross a field instead of freezing.
      for (let t = time; t <= time + 0.35; t += 0.05) {
        const cycle =
          ((this.time + t + geyser.phase) % geyser.period + geyser.period) % geyser.period;
        if (cycle >= geyser.period - GEYSER_ERUPT_SECONDS - GEYSER_WARN_SECONDS) return false;
      }
    }
    for (const roller of row.rollers ?? []) {
      // Check a short window after landing, not just the exact frame: a log
      // that arrives immediately afterwards would otherwise be a guaranteed
      // hit while the hero is still recovering from the hop.
      for (let t = time; t <= time + 0.4; t += 0.05) {
        const predicted = roller.x + roller.dir * roller.speed * t;
        if (Math.abs(predicted - x) < roller.radius + 0.85) return false;
      }
    }
    for (const fragile of row.fragile ?? []) {
      if (Math.abs(fragile.x - x) < 0.7) return false;
    }
    for (const faller of row.fallers ?? []) {
      if (Math.abs(faller.x - x) >= 0.7) continue;
      const local =
        ((this.time + time + faller.phase) % faller.period + faller.period) % faller.period;
      // The coconut only hurts during the fall/impact slice. Waiting for the
      // whole cycle would strand the bot on a safe lane and feed the eagle.
      if (local >= FALLER_WARN_SECONDS - 0.15 && local <= FALLER_WARN_SECONDS + FALLER_FALL_SECONDS + FALLER_IMPACT_SECONDS) {
        return false;
      }
    }
    // Sinkholes are avoided while routing: the bot is not good at lingering
    // next to them, and a wrong panic hop is worse than waiting for a lane.
    for (const sink of row.sinkholes ?? []) {
      if (Math.abs(sink.x - x) < 0.7) return false;
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
    // A red or amber light freezes the whole lane: cars stay where they are.
    // If the light never turns green inside the hop window, only the frozen
    // positions matter. Otherwise fall back to the conservative moving check.
    if (row.light) {
      let anyGreen = false;
      for (let t = startTime; t <= landingTime + 0.25 + 0.0001; t += 0.05) {
        const local =
          ((this.time + t + row.light.phase) % row.light.cycle + row.light.cycle) % row.light.cycle;
        if (local < LIGHT_GREEN_SECONDS) {
          anyGreen = true;
          break;
        }
      }
      if (!anyGreen) return this.demoCarClear(row, x, 0);
    }
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

    if (cause === "water" || cause === "tide") {
      this.shake = Math.max(this.shake, 0.45);
      this.sceneView.particles.burstSplash(p.x, p.z);
      this.shadow.visible = false;
    } else if (cause === "geyser") {
      this.shake = Math.max(this.shake, 0.8);
      const skin = SKINS[this.skinId];
      this.sceneView.particles.burstDust(p.x, p.z, 16, 0xff8a3d);
      this.sceneView.particles.burstFeathers(p.x, p.z, [0xffb35c, 0xff7a2a, 0xffe08a, skin.body]);
    } else if (cause === "log" || cause === "tumble") {
      this.shake = Math.max(this.shake, 0.6);
      const skin = SKINS[this.skinId];
      const wood = cause === "log" ? 0xb98b56 : 0xd8b27a;
      this.sceneView.particles.burstDust(p.x, p.z, 14, wood);
      this.sceneView.particles.burstFeathers(p.x, p.z, [wood, 0x8a6a3e, skin.body, 0xfff7e2]);
    } else if (cause === "void" || cause === "ghost") {
      this.shake = Math.max(this.shake, 0.55);
      const skin = SKINS[this.skinId];
      const color = cause === "void" ? 0x8b6ff0 : 0xd8a0ff;
      this.sceneView.particles.burstDust(p.x, p.z, 16, color);
      this.sceneView.particles.burstFeathers(p.x, p.z, [color, 0x2a1a33, skin.body, 0xfff7e2]);
    } else if (cause === "coconut" || cause === "beast") {
      this.shake = Math.max(this.shake, 0.6);
      const skin = SKINS[this.skinId];
      const color = cause === "coconut" ? 0xb08a52 : 0xd8c08a;
      this.sceneView.particles.burstDust(p.x, p.z, 14, color);
      this.sceneView.particles.burstFeathers(p.x, p.z, [color, 0x6b4a2c, skin.body, 0xfff7e2]);
    } else {
      this.shake = Math.max(this.shake, cause === "train" ? 1.05 : 0.7);
      const skin = SKINS[this.skinId];
      this.sceneView.particles.burstFeathers(p.x, p.z, [skin.body, skin.bodyShade, skin.comb, 0xfff7e2]);
      this.sceneView.particles.burstDust(p.x, p.z, 10, 0xd8e8b6);
    }
  }

  /**
   * Collision footprints near the player for `?hitboxes=1`. The shapes are
   * approximate (the game uses forgiving circles and a few per-hazard checks),
   * but they make the actual danger zones visible while tuning rows.
   */
  getDebugHitboxes(): DebugHitbox[] {
    const boxes: DebugHitbox[] = [];
    const p = this.player;
    boxes.push({ x: p.x, z: p.z, hx: 0.34, hz: 0.34, color: "#5ff0a8", kind: "player" });

    for (const row of this.rows.values()) {
      if (row.z < p.z - 3 || row.z > p.z + 16) continue;

      for (const prop of row.props) {
        if (!prop.collider) continue;
        boxes.push({
          x: prop.x,
          z: row.z,
          hx: Math.max(0.28, prop.radius),
          hz: Math.max(0.28, prop.radius),
          color: "#ffd166",
          kind: "prop"
        });
      }
      for (const car of row.cars) {
        if (Math.abs(car.x - p.x) > 13) continue;
        boxes.push({
          x: car.x,
          z: row.z,
          hx: car.len * 0.5,
          hz: car.width * 0.5,
          color: "#ff5d5d",
          kind: "car"
        });
      }
      for (const log of row.logs) {
        if (Math.abs(log.x - p.x) > 11) continue;
        boxes.push({
          x: log.x,
          z: row.z,
          hx: log.len * 0.5,
          hz: 0.45,
          color: log.crocodile ? "#ff7b54" : "#66c7ff",
          kind: "log"
        });
      }
      if (row.train?.active) {
        boxes.push({
          x: row.train.x,
          z: row.z,
          hx: row.train.length * 0.5,
          hz: 0.55,
          color: "#ff3d6e",
          kind: "train"
        });
      }
      for (const geyser of row.geysers ?? []) {
        boxes.push({ x: geyser.x, z: row.z, hx: 0.5, hz: 0.5, color: "#ff8a3d", kind: "geyser" });
      }
      for (const roller of row.rollers ?? []) {
        boxes.push({
          x: roller.x,
          z: row.z,
          hx: roller.radius,
          hz: roller.radius,
          color: "#ff9f43",
          kind: roller.kind
        });
      }
      for (const tile of row.fragile ?? []) {
        boxes.push({
          x: tile.x,
          z: row.z,
          hx: 0.45,
          hz: 0.45,
          color: tile.kind === "ghost" ? "#d8a0ff" : "#8b6ff0",
          kind: "fragile"
        });
      }
      for (const faller of row.fallers ?? []) {
        boxes.push({ x: faller.x, z: row.z, hx: 0.42, hz: 0.42, color: "#c9e265", kind: "faller" });
      }
      for (const hole of row.sinkholes ?? []) {
        boxes.push({ x: hole.x, z: row.z, hx: 0.48, hz: 0.48, color: "#9c7a4a", kind: "sink" });
      }
    }
    return boxes;
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
