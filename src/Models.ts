import * as THREE from "three";
import type { CarData, CubeSpec, LogData, RollerKind, TrainData } from "./types";
import { BIOMES, type BiomeId, type IdleHazardKind } from "./biomes";
import { PALETTE, SKINS, type SkinDef, type SkinId } from "./config";
import { createBlobShadow, createVoxelMesh } from "./Voxel";
import { clamp } from "./utils";
import coinPigUrl from "./assets/coin-pig.webp";
import coinTailsUrl from "./assets/coin-tails.webp";

const carShadow = createBlobShadow(1, 1, 0.012);
const logCylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
const logMaterials = new Map<number, THREE.MeshLambertMaterial>();
const coinFaceGeometry = new THREE.PlaneGeometry(0.72, 0.72);
const coinEdgeGeometry = new THREE.CylinderGeometry(0.345, 0.345, 0.055, 24, 1);
const coinEdgeMaterial = new THREE.MeshLambertMaterial({ color: 0xf2b62b, flatShading: true });

function coinTexture(url: string): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  return texture;
}

const coinPigTexture = coinTexture(coinPigUrl);
const coinTailsTexture = coinTexture(coinTailsUrl);
const coinPigMaterial = new THREE.MeshBasicMaterial({
  map: coinPigTexture,
  transparent: true,
  alphaTest: 0.08,
  side: THREE.FrontSide
});
const coinTailsMaterial = new THREE.MeshBasicMaterial({
  map: coinTailsTexture,
  transparent: true,
  alphaTest: 0.08,
  side: THREE.FrontSide
});

function getLogMaterial(color: number): THREE.MeshLambertMaterial {
  let material = logMaterials.get(color);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, flatShading: true });
    logMaterials.set(color, material);
  }
  return material;
}

export function buildCar(data: CarData): THREE.Group {
  const group = new THREE.Group();
  const cubes: CubeSpec[] = [];
  const len = data.len;
  const width = data.width;
  const s = data.dir;
  const color = data.color;
  const dark = shade(color, -0.24);
  const roof = 0xf1eee3;
  const glass = PALETTE.glass;
  const glassLight = PALETTE.glassLight;
  const wheel = PALETTE.wheel;
  const front = s * (len / 2 - 0.035);
  const rear = -s * (len / 2 - 0.035);
  const roofY = data.type === "decker" ? 1.22 : data.type === "bus" ? 1.02 : data.type === "truck" ? 0.82 : data.type === "van" ? 0.79 : 0.66;

  // Wheels are always aligned inside the body silhouette; the hub caps point
  // outward so the car reads correctly from either side.
  for (const ax of [-len * 0.31, len * 0.31]) {
    for (const side of [-1, 1]) {
      cubes.push({
        x: ax,
        y: 0.12,
        z: side * (width * 0.5 - 0.015),
        sx: 0.23,
        sy: 0.23,
        sz: 0.12,
        color: wheel
      });
      cubes.push({
        x: ax,
        y: 0.12,
        z: side * (width * 0.5 + 0.045),
        sx: 0.085,
        sy: 0.085,
        sz: 0.018,
        color: 0xf4f0e5
      });
    }
  }

  // Chassis and bumpers.
  cubes.push({ x: 0, y: 0.15, z: 0, sx: len * 0.9, sy: 0.1, sz: width * 0.78, color: PALETTE.underbody });
  cubes.push({ x: front, y: 0.23, z: 0, sx: 0.07, sy: 0.12, sz: width * 0.84, color: dark });
  cubes.push({ x: rear, y: 0.22, z: 0, sx: 0.06, sy: 0.1, sz: width * 0.8, color: dark });

  if (data.type === "truck") {
    const cargoLen = len * 0.54;
    const cargoX = -s * len * 0.13;
    const cabLen = len * 0.28;
    const cabX = s * len * 0.32;
    cubes.push({ x: cargoX, y: 0.49, z: 0, sx: cargoLen, sy: 0.6, sz: width * 0.94, color: data.cargo });
    cubes.push({ x: cargoX, y: 0.8, z: 0, sx: cargoLen * 0.98, sy: 0.045, sz: width * 0.94, color: shade(data.cargo, 0.16) });
    cubes.push({ x: cargoX, y: 0.34, z: 0, sx: cargoLen * 0.96, sy: 0.08, sz: width * 0.88, color: shade(data.cargo, -0.16) });
    cubes.push({ x: cabX, y: 0.27, z: 0, sx: cabLen, sy: 0.2, sz: width * 0.9, color: dark });
    cubes.push({ x: cabX, y: 0.49, z: 0, sx: cabLen, sy: 0.38, sz: width * 0.88, color });
    cubes.push({ x: cabX, y: 0.7, z: 0, sx: cabLen * 0.92, sy: 0.08, sz: width * 0.82, color: roof });
    cubes.push({ x: cabX + s * cabLen * 0.36, y: 0.53, z: 0, sx: 0.04, sy: 0.2, sz: width * 0.68, color: glass });
    cubes.push({ x: cabX - s * cabLen * 0.12, y: 0.53, z: -width * 0.45, sx: cabLen * 0.42, sy: 0.17, sz: 0.025, color: glassLight });
    cubes.push({ x: cabX - s * cabLen * 0.12, y: 0.53, z: width * 0.45, sx: cabLen * 0.42, sy: 0.17, sz: 0.025, color: glassLight });
    cubes.push({ x: cargoX, y: 0.79, z: -width * 0.45, sx: cargoLen * 0.86, sy: 0.06, sz: 0.025, color: shade(data.cargo, 0.24) });
  } else if (data.type === "decker") {
    cubes.push({ x: 0, y: 0.27, z: 0, sx: len * 0.94, sy: 0.2, sz: width * 0.92, color: dark });
    cubes.push({ x: 0, y: 0.38, z: 0, sx: len * 0.95, sy: 0.32, sz: width * 0.93, color });
    cubes.push({ x: 0, y: 0.74, z: 0, sx: len * 0.96, sy: 0.4, sz: width * 0.94, color });
    cubes.push({ x: 0, y: 1.02, z: 0, sx: len * 0.91, sy: 0.06, sz: width * 0.86, color: roof });
    cubes.push({ x: front, y: 0.75, z: 0, sx: 0.03, sy: 0.3, sz: width * 0.72, color: glass });
    cubes.push({ x: rear, y: 0.75, z: 0, sx: 0.03, sy: 0.28, sz: width * 0.7, color: glass });
    for (const side of [-1, 1]) {
      for (const y of [0.43, 0.8]) {
        cubes.push({ x: 0, y, z: side * width * 0.48, sx: len * 0.82, sy: 0.16, sz: 0.025, color: glass });
      }
      cubes.push({ x: 0, y: 0.61, z: side * width * 0.49, sx: len * 0.82, sy: 0.04, sz: 0.025, color: 0xf2c744 });
      for (let i = -1; i <= 1; i++) {
        cubes.push({ x: i * len * 0.26, y: 0.62, z: side * width * 0.5, sx: 0.055, sy: 0.4, sz: 0.018, color });
      }
    }
  } else if (data.type === "bus") {
    cubes.push({ x: 0, y: 0.3, z: 0, sx: len * 0.94, sy: 0.24, sz: width * 0.92, color: dark });
    cubes.push({ x: 0, y: 0.31, z: 0, sx: len * 0.94, sy: 0.24, sz: width * 0.92, color });
    cubes.push({ x: 0, y: 0.62, z: 0, sx: len * 0.96, sy: 0.52, sz: width * 0.94, color });
    cubes.push({ x: 0, y: 0.93, z: 0, sx: len * 0.92, sy: 0.07, sz: width * 0.86, color: roof });
    cubes.push({ x: front, y: 0.62, z: 0, sx: 0.035, sy: 0.36, sz: width * 0.76, color: glass });
    cubes.push({ x: rear, y: 0.62, z: 0, sx: 0.03, sy: 0.32, sz: width * 0.72, color: glass });
    for (const side of [-1, 1]) {
      cubes.push({ x: 0, y: 0.66, z: side * width * 0.474, sx: len * 0.82, sy: 0.22, sz: 0.025, color: glass });
      cubes.push({ x: 0, y: 0.38, z: side * width * 0.474, sx: len * 0.82, sy: 0.055, sz: 0.025, color: 0xf4d56a });
      for (let i = -1; i <= 1; i++) {
        cubes.push({ x: i * len * 0.26, y: 0.63, z: side * width * 0.5, sx: 0.055, sy: 0.28, sz: 0.018, color });
      }
    }
  } else if (data.type === "van") {
    cubes.push({ x: 0, y: 0.3, z: 0, sx: len * 0.9, sy: 0.18, sz: width * 0.9, color: dark });
    cubes.push({ x: 0, y: 0.47, z: 0, sx: len * 0.92, sy: 0.5, sz: width * 0.9, color });
    cubes.push({ x: -s * len * 0.03, y: 0.75, z: 0, sx: len * 0.86, sy: 0.07, sz: width * 0.82, color: roof });
    cubes.push({ x: s * len * 0.36, y: 0.51, z: 0, sx: 0.035, sy: 0.22, sz: width * 0.7, color: glass });
    for (const side of [-1, 1]) {
      cubes.push({ x: -s * len * 0.02, y: 0.53, z: side * width * 0.455, sx: len * 0.4, sy: 0.17, sz: 0.025, color: glassLight });
      cubes.push({ x: s * len * 0.24, y: 0.53, z: side * width * 0.455, sx: len * 0.22, sy: 0.17, sz: 0.025, color: glass });
    }
  } else {
    cubes.push({ x: 0, y: 0.25, z: 0, sx: len * 0.92, sy: 0.2, sz: width * 0.88, color });
    cubes.push({ x: 0, y: 0.34, z: 0, sx: len * 0.88, sy: 0.08, sz: width * 0.9, color: shade(color, 0.12) });
    const cabinX = -s * len * 0.035;
    const cabinLen = len * 0.52;
    cubes.push({ x: cabinX, y: 0.45, z: 0, sx: cabinLen, sy: 0.18, sz: width * 0.78, color });
    cubes.push({ x: cabinX, y: 0.56, z: 0, sx: cabinLen * 0.9, sy: 0.06, sz: width * 0.72, color: roof });
    cubes.push({ x: cabinX + s * cabinLen * 0.48, y: 0.47, z: 0, sx: 0.035, sy: 0.14, sz: width * 0.68, color: glass });
    cubes.push({ x: cabinX - s * cabinLen * 0.48, y: 0.47, z: 0, sx: 0.035, sy: 0.13, sz: width * 0.64, color: glass });
    for (const side of [-1, 1]) {
      cubes.push({ x: cabinX, y: 0.48, z: side * width * 0.395, sx: cabinLen * 0.74, sy: 0.13, sz: 0.025, color: glassLight });
    }
    if (data.type === "taxi") {
      cubes.push({ x: cabinX, y: 0.63, z: 0, sx: 0.34, sy: 0.1, sz: 0.26, color: 0xfff7dc });
      cubes.push({ x: cabinX, y: 0.69, z: 0, sx: 0.2, sy: 0.035, sz: 0.16, color: 0x20313a });
    }
  }

  if (data.type === "race") {
    const spoilerX = -s * (len * 0.44);
    cubes.push({ x: spoilerX, y: 0.5, z: 0, sx: 0.13, sy: 0.22, sz: width * 0.96, color: 0x39434a });
    cubes.push({ x: spoilerX, y: 0.38, z: -width * 0.33, sx: 0.1, sy: 0.2, sz: 0.08, color: 0x2a3238 });
    cubes.push({ x: spoilerX, y: 0.38, z: width * 0.33, sx: 0.1, sy: 0.2, sz: 0.08, color: 0x2a3238 });
    cubes.push({ x: s * len * 0.2, y: 0.4, z: 0, sx: 0.34, sy: 0.14, sz: width * 0.45, color: 0x2d3b46 });
    cubes.push({ x: 0, y: 0.63, z: 0, sx: len * 0.72, sy: 0.035, sz: width * 0.42, color: 0xf4f0e5 });
    for (const side of [-1, 1]) {
      cubes.push({ x: -s * len * 0.05, y: 0.33, z: side * width * 0.49, sx: len * 0.52, sy: 0.09, sz: 0.025, color: 0xe64b35 });
    }
  }

  // Headlights, tail lights and a police light bar.
  cubes.push({ x: front, y: 0.28, z: -width * 0.27, sx: 0.045, sy: 0.1, sz: 0.16, color: PALETTE.light });
  cubes.push({ x: front, y: 0.28, z: width * 0.27, sx: 0.045, sy: 0.1, sz: 0.16, color: PALETTE.light });
  cubes.push({ x: rear, y: 0.29, z: 0, sx: 0.035, sy: 0.09, sz: width * 0.46, color: PALETTE.taillight });

  if (data.police) {
    cubes.push({ x: -s * len * 0.02, y: roofY, z: 0, sx: 0.44, sy: 0.05, sz: 0.36, color: 0xe8e5da });
    cubes.push({ x: -s * len * 0.1, y: roofY + 0.065, z: 0, sx: 0.16, sy: 0.1, sz: 0.28, color: 0x2d73d2 });
    cubes.push({ x: s * len * 0.06, y: roofY + 0.065, z: 0, sx: 0.16, sy: 0.1, sz: 0.28, color: 0xd94343 });
    for (const side of [-1, 1]) {
      cubes.push({ x: 0, y: 0.37, z: side * width * 0.49, sx: len * 0.5, sy: 0.075, sz: 0.025, color: 0x2d73d2 });
    }
  }

  group.add(createVoxelMesh(cubes));
  group.position.x = data.x;
  group.position.z = 0;
  return group;
}

export function buildLog(data: LogData, biomeId?: BiomeId): THREE.Group {
  const group = new THREE.Group();
  const visual = new THREE.Group();
  const biome = biomeId ? BIOMES[biomeId] : null;
  const logColor = biome?.log ?? PALETTE.log;
  const logDark = biome?.logDark ?? PALETTE.logDark;
  const logLight = biome?.logLight ?? PALETTE.logLight;
  const length = data.len;

  if (data.lily) {
    const padColor = biome?.leaves[1] ?? 0x4f9e4a;
    const padLight = biome?.leavesLight[0] ?? 0x7fbd62;
    const pad = new THREE.Mesh(logCylinderGeometry, getLogMaterial(padColor));
    pad.scale.set(0.68, 0.045, 0.68);
    pad.position.y = 0.045;
    visual.add(pad);
    const padDetails: CubeSpec[] = [
      { x: -0.12, y: 0.085, z: 0.1, sx: 0.55, sy: 0.018, sz: 0.55, color: padLight },
      { x: 0.1, y: 0.1, z: 0.34, sx: 0.16, sy: 0.03, sz: 0.16, color: biome?.flowers[0] ?? 0xffd56a },
      { x: 0.15, y: 0.1, z: 0.34, sx: 0.04, sy: 0.04, sz: 0.04, color: 0xfff4cf }
    ];
    visual.add(createVoxelMesh(padDetails));
    group.add(visual);
    group.userData.visual = visual;
    group.position.x = data.x;
    const padShadow = carShadow.clone();
    padShadow.scale.set(1.05, 0.52, 1);
    padShadow.position.y = -0.03;
    group.add(padShadow);
    return group;
  }

  if (data.ice) {
    const ice = new THREE.Mesh(logCylinderGeometry, getLogMaterial(0xc8edf2));
    ice.scale.set(length * 0.48, 0.055, 0.58);
    ice.position.y = 0.045;
    visual.add(ice);
    const iceDetails: CubeSpec[] = [
      { x: -length * 0.2, y: 0.085, z: 0.04, sx: length * 0.42, sy: 0.015, sz: 0.05, color: 0xe9fbff },
      { x: length * 0.14, y: 0.085, z: -0.16, sx: length * 0.2, sy: 0.012, sz: 0.035, color: 0x8fd9e8 },
      { x: length * 0.02, y: 0.09, z: 0.26, sx: length * 0.28, sy: 0.012, sz: 0.03, color: 0xe9fbff }
    ];
    visual.add(createVoxelMesh(iceDetails));
    group.add(visual);
    group.userData.visual = visual;
    group.position.x = data.x;
    const iceShadow = carShadow.clone();
    iceShadow.scale.set(length * 1.02, 0.58, 1);
    iceShadow.position.y = -0.03;
    group.add(iceShadow);
    return group;
  }

  if (data.chocolate) {
    const chocolate = 0x6a3a22;
    const chocolateLight = 0x8b5130;
    const chocolateDark = 0x482416;
    const cocoa: CubeSpec[] = [
      { x: 0, y: 0.2, z: 0, sx: length * 0.94, sy: 0.26, sz: 0.88, color: chocolateDark },
      { x: 0, y: 0.35, z: 0, sx: length * 0.9, sy: 0.08, sz: 0.82, color: chocolate },
      { x: 0, y: 0.4, z: 0, sx: length * 0.86, sy: 0.025, sz: 0.76, color: chocolateLight }
    ];
    const cells = 4;
    for (let i = 0; i < cells; i++) {
      const cx = -length * 0.34 + (i / (cells - 1)) * length * 0.68;
      cocoa.push({ x: cx, y: 0.414, z: -0.17, sx: length * 0.11, sy: 0.012, sz: 0.22, color: chocolate });
      cocoa.push({ x: cx, y: 0.414, z: 0.17, sx: length * 0.11, sy: 0.012, sz: 0.22, color: chocolate });
    }
    visual.add(createVoxelMesh(cocoa));
    group.add(visual);
    group.userData.visual = visual;
    group.position.x = data.x;
    const chocolateShadow = carShadow.clone();
    chocolateShadow.scale.set(length * 1.04, 0.6, 1);
    chocolateShadow.position.y = -0.03;
    group.add(chocolateShadow);
    return group;
  }

  if (data.crocodile) {
    const green = 0x4f8b3e;
    const greenDark = 0x2f5f2c;
    const greenLight = 0x78aa52;
    const headX = data.dir * length * 0.34;
    const cubes: CubeSpec[] = [
      { x: 0, y: 0.16, z: 0, sx: length * 0.78, sy: 0.16, sz: 0.46, color: green },
      { x: data.dir * length * 0.4, y: 0.12, z: 0, sx: length * 0.16, sy: 0.1, sz: 0.36, color: greenDark },
      { x: -data.dir * length * 0.36, y: 0.15, z: 0, sx: length * 0.12, sy: 0.08, sz: 0.3, color: greenDark },
      { x: headX, y: 0.2, z: 0, sx: 0.54, sy: 0.22, sz: 0.58, color: green },
      { x: headX + data.dir * 0.31, y: 0.16, z: 0, sx: 0.42, sy: 0.13, sz: 0.46, color: greenLight },
      { x: headX + data.dir * 0.53, y: 0.14, z: 0, sx: 0.16, sy: 0.1, sz: 0.38, color: greenLight },
      { x: headX - data.dir * 0.1, y: 0.28, z: -0.18, sx: 0.12, sy: 0.1, sz: 0.12, color: 0xfff4d0 },
      { x: headX - data.dir * 0.1, y: 0.28, z: 0.18, sx: 0.12, sy: 0.1, sz: 0.12, color: 0xfff4d0 },
      { x: headX - data.dir * 0.1, y: 0.29, z: -0.18, sx: 0.05, sy: 0.05, sz: 0.05, color: 0x15201b },
      { x: headX - data.dir * 0.1, y: 0.29, z: 0.18, sx: 0.05, sy: 0.05, sz: 0.05, color: 0x15201b }
    ];
    for (let i = 0; i < 5; i++) {
      cubes.push({
        x: -length * 0.22 + i * length * 0.13,
        y: 0.27,
        z: 0,
        sx: 0.12,
        sy: 0.1,
        sz: 0.56,
        color: greenDark
      });
    }
    for (let i = 0; i < 4; i++) {
      cubes.push({
        x: headX + data.dir * (0.2 + i * 0.09),
        y: 0.1,
        z: 0.22,
        sx: 0.05,
        sy: 0.06,
        sz: 0.06,
        color: 0xfff4d0
      });
    }
    visual.add(createVoxelMesh(cubes));
    group.add(visual);
    group.userData.visual = visual;
    group.position.x = data.x;
    const crocShadow = carShadow.clone();
    crocShadow.scale.set(length * 1.08, 0.58, 1);
    crocShadow.position.y = -0.028;
    group.add(crocShadow);
    return group;
  }

  const cylinder = new THREE.Mesh(logCylinderGeometry, getLogMaterial(logColor));
  cylinder.scale.set(0.22, length * 0.98, 0.22);
  cylinder.rotation.z = Math.PI / 2;
  cylinder.position.y = 0.17;
  visual.add(cylinder);

  const details: CubeSpec[] = [
    { x: 0, y: 0.395, z: -0.08, sx: length * 0.92, sy: 0.026, sz: 0.06, color: logDark },
    { x: 0, y: 0.395, z: 0.08, sx: length * 0.92, sy: 0.026, sz: 0.06, color: logDark },
    { x: -length * 0.3, y: 0.4, z: 0.02, sx: 0.16, sy: 0.02, sz: 0.12, color: logLight },
    { x: length * 0.2, y: 0.4, z: -0.02, sx: 0.22, sy: 0.02, sz: 0.1, color: logDark }
  ];
  visual.add(createVoxelMesh(details));
  group.add(visual);
  group.userData.visual = visual;
  group.position.x = data.x;

  const shadow = carShadow.clone();
  shadow.scale.set(length * 1.12, 0.62, 1);
  shadow.position.y = -0.028;
  group.add(shadow);
  return group;
}

/**
 * A hazard that crosses safe rows: a log rolling along the row in the forest,
 * or a tumbleweed in the desert. `group.userData.spin` is rotated by the world.
 */
export function buildRoller(kind: RollerKind, biomeId?: BiomeId): THREE.Group {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  const biome = biomeId ? BIOMES[biomeId] : null;
  group.add(spin);
  group.userData.spin = spin;

  if (kind === "log") {
    spin.position.y = 0.3;
    const logColor = biome?.log ?? PALETTE.log;
    const logDark = biome?.logDark ?? PALETTE.logDark;
    const logLight = biome?.logLight ?? PALETTE.logLight;
    const cylinder = new THREE.Mesh(logCylinderGeometry, getLogMaterial(logColor));
    cylinder.scale.set(0.3, 1.5, 0.3);
    cylinder.rotation.x = Math.PI / 2;
    spin.add(cylinder);
    const details: CubeSpec[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      details.push({
        x: Math.cos(angle) * 0.28,
        y: Math.sin(angle) * 0.28,
        z: i % 2 === 0 ? 0.52 : -0.52,
        sx: 0.09,
        sy: 0.09,
        sz: 0.12,
        color: i % 2 === 0 ? logDark : logLight,
        rz: angle
      });
    }
    spin.add(createVoxelMesh(details));
    group.add(createBlobShadow(1.7, 0.9, 0.014));
    return group;
  }

  spin.position.y = 0.5;
  const wood = 0x8a6738;
  const dark = 0x55401f;
  const light = 0xd9b477;
  const cubes: CubeSpec[] = [];
  for (let i = 0; i < 20; i++) {
    const angle = i * 2.399;
    const radius = 0.38 + (i % 3) * 0.055;
    cubes.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.9,
      z: Math.sin(angle * 1.7) * 0.28,
      sx: 0.11 + (i % 4) * 0.025,
      sy: 0.11,
      sz: 0.11,
      color: i % 5 === 0 ? light : i % 3 === 0 ? dark : wood,
      rz: angle
    });
  }
  spin.add(createVoxelMesh(cubes));
  group.scale.setScalar(1.28);
  group.add(createBlobShadow(1.15, 0.72, 0.014));
  return group;
}

export function buildIdleHazard(kind: IdleHazardKind, biomeId?: BiomeId): THREE.Group {  const group = new THREE.Group();
  const biome = biomeId ? BIOMES[biomeId] : null;
  const cubes: CubeSpec[] = [];
  const accent = biome?.accent ?? 0xffd23f;
  const dark = biome?.road ?? 0x30343a;

  if (kind === "ufo") {
    cubes.push({ x: 0, y: 0, z: 0, sx: 1.5, sy: 0.16, sz: 1.5, color: 0x8fa8b8 });
    cubes.push({ x: 0, y: 0.12, z: 0, sx: 1.05, sy: 0.14, sz: 1.05, color: 0xb8d6df });
    cubes.push({ x: 0, y: 0.3, z: 0, sx: 0.62, sy: 0.34, sz: 0.62, color: accent });
    cubes.push({ x: 0, y: 0.48, z: 0, sx: 0.4, sy: 0.12, sz: 0.4, color: 0xd8fbff });
    for (const side of [-1, 1]) {
      cubes.push({ x: side * 0.72, y: 0.01, z: 0, sx: 0.18, sy: 0.08, sz: 0.16, color: accent });
      cubes.push({ x: side * 0.5, y: -0.03, z: 0.36, sx: 0.16, sy: 0.06, sz: 0.12, color: 0xffb35c });
    }
    group.add(createVoxelMesh(cubes));
    return group;
  }

  if (kind === "candy-plane") {
    const pink = 0xf08ab4;
    cubes.push({ x: 0, y: 0, z: 0, sx: 1.35, sy: 0.32, sz: 0.42, color: pink });
    cubes.push({ x: 0.2, y: 0.18, z: 0, sx: 0.58, sy: 0.28, sz: 0.34, color: 0xffd8e8 });
    cubes.push({ x: -0.1, y: 0.08, z: 0, sx: 1.9, sy: 0.1, sz: 0.2, color: 0xfff2f6 });
    cubes.push({ x: -0.1, y: 0.08, z: -0.55, sx: 0.35, sy: 0.06, sz: 1.0, color: 0xfff2f6 });
    cubes.push({ x: -0.1, y: 0.08, z: 0.55, sx: 0.35, sy: 0.06, sz: 1.0, color: 0xfff2f6 });
    cubes.push({ x: -0.62, y: 0.18, z: 0, sx: 0.28, sy: 0.3, sz: 0.18, color: accent });
    group.add(createVoxelMesh(cubes));
    return group;
  }

  const isBat = kind === "bat";
  const isVulture = kind === "vulture";
  const isPtero = kind === "pterodactyl";
  const body = isBat ? 0x2c2538 : isVulture ? 0x534b45 : isPtero ? 0xb74635 : 0x6b4a32;
  const wing = isBat ? 0x40374d : isVulture ? 0x3f3a36 : isPtero ? 0x8e2f2b : 0x8b5b36;
  const head = isBat ? 0x40374d : isVulture ? 0xb8a58a : isPtero ? 0xc7583d : 0xf4f0df;
  const size = isPtero ? 1.55 : isVulture ? 1.28 : 1;

  cubes.push({ x: 0, y: 0, z: 0, sx: 0.58 * size, sy: 0.42 * size, sz: 0.4 * size, color: body });
  cubes.push({ x: 0.36 * size, y: 0.22 * size, z: 0, sx: 0.34 * size, sy: 0.3 * size, sz: 0.34 * size, color: head });
  cubes.push({ x: 0.58 * size, y: 0.18 * size, z: 0, sx: 0.26 * size, sy: 0.1 * size, sz: 0.16 * size, color: isBat ? 0x2a222f : 0xffbc45 });
  cubes.push({ x: 0.43 * size, y: 0.32 * size, z: -0.1 * size, sx: 0.075 * size, sy: 0.075 * size, sz: 0.075 * size, color: 0x111719 });
  cubes.push({ x: 0.43 * size, y: 0.32 * size, z: 0.1 * size, sx: 0.075 * size, sy: 0.075 * size, sz: 0.075 * size, color: 0x111719 });
  cubes.push({ x: -0.32 * size, y: 0.06 * size, z: 0, sx: 0.3 * size, sy: 0.14 * size, sz: 0.32 * size, color: wing });
  cubes.push({ x: -0.02, y: 0.04, z: -0.84 * size, sx: 0.3, sy: 0.1, sz: 0.9 * size, color: wing });
  cubes.push({ x: -0.02, y: 0.04, z: 0.84 * size, sx: 0.3, sy: 0.1, sz: 0.9 * size, color: wing });
  cubes.push({ x: -0.28, y: 0.03, z: -1.12 * size, sx: 0.18, sy: 0.06, sz: 0.3, color: body });
  cubes.push({ x: -0.28, y: 0.03, z: 1.12 * size, sx: 0.18, sy: 0.06, sz: 0.3, color: body });
  if (isPtero) {
    cubes.push({ x: 0.78 * size, y: 0.3 * size, z: 0, sx: 0.24 * size, sy: 0.12 * size, sz: 0.12 * size, color: 0x8e2f2b });
  }
  group.add(createVoxelMesh(cubes));
  return group;
}

export function buildTrain(data: TrainData, shadow: boolean, biomeId?: BiomeId): THREE.Group {
  const group = new THREE.Group();
  const cubes: CubeSpec[] = [];
  const centers = [-3.25, 0, 3.25];
  const leadIndex = data.dir > 0 ? 2 : 0;
  const biome = biomeId ? BIOMES[biomeId] : null;

  if (biome?.mechanics?.stampede) {
    // Prehistoric railroad: a stampeding herd instead of the metal train.
    const hide = biome.rockDark;
    const hideLight = biome.rock;
    for (const cx of centers) {
      const dir = data.dir;
      cubes.push({ x: cx, y: 0.48, z: 0, sx: 2.25, sy: 0.55, sz: 0.72, color: hide });
      cubes.push({ x: cx + dir * 0.9, y: 0.78, z: 0, sx: 0.72, sy: 0.5, sz: 0.62, color: hideLight });
      cubes.push({ x: cx + dir * 1.3, y: 0.74, z: 0, sx: 0.18, sy: 0.2, sz: 0.36, color: hide });
      cubes.push({ x: cx + dir * 1.22, y: 0.92, z: 0, sx: 0.46, sy: 0.36, sz: 0.56, color: hideLight });
      cubes.push({ x: cx - dir * 0.8, y: 0.42, z: 0, sx: 0.55, sy: 0.18, sz: 0.26, color: hide });
      for (const sx of [-0.55, 0.55]) {
        for (const sz of [-0.27, 0.27]) {
          cubes.push({ x: cx + sx, y: 0.16, z: sz, sx: 0.24, sy: 0.42, sz: 0.16, color: hide });
        }
      }
      cubes.push({ x: cx - dir * 1.05, y: 0.5, z: 0, sx: 0.65, sy: 0.18, sz: 0.2, color: hideLight });
      cubes.push({ x: cx + dir * 0.95, y: 0.9, z: -0.2, sx: 0.09, sy: 0.09, sz: 0.09, color: 0xffd06a });
      cubes.push({ x: cx + dir * 0.95, y: 0.9, z: 0.2, sx: 0.09, sy: 0.09, sz: 0.09, color: 0xffd06a });
    }
    group.add(createVoxelMesh(cubes));
    if (shadow) {
      const blob = carShadow.clone();
      blob.scale.set(10.2, 1.2, 1);
      blob.position.y = 0.012;
      group.add(blob);
    }
    return group;
  }

  const lead = biomeId === "autumn" ? 0x2d7fbd : biome?.accent ?? 0xf0b42e;
  const body = biomeId === "autumn" ? 0x4db4df : biome?.vehicleColors[1] ?? 0x2f6f96;
  const roof = biomeId === "autumn" ? 0xf4f1e6 : biome?.railLight ?? 0x6cb1cc;
  const stripe = biomeId === "autumn" ? 0xf7cf48 : biome?.roadLine ?? 0xf8db64;
  const windowColor = 0x1e3541;
  for (let i = 0; i < centers.length; i++) {
    const cx = centers[i];
    const isLead = i === leadIndex;
    const bodyColor = isLead ? lead : body;
    const roofColor = isLead ? shade(lead, 0.3) : roof;
    for (const z of [-0.46, 0.46]) {
      for (const x of [-1.05, 1.05]) {
        cubes.push({ x: cx + x, y: 0.12, z, sx: 0.3, sy: 0.24, sz: 0.13, color: 0x1c2429 });
      }
    }
    cubes.push({ x: cx, y: 0.56, z: 0, sx: 2.94, sy: 0.82, sz: 0.96, color: bodyColor });
    cubes.push({ x: cx, y: 1.0, z: 0, sx: 2.82, sy: 0.08, sz: 0.88, color: roofColor });
    cubes.push({ x: cx, y: 0.38, z: -0.486, sx: 2.75, sy: 0.11, sz: 0.025, color: stripe });
    for (let j = 0; j < 4; j++) {
      for (const side of [-0.505, 0.505]) {
        cubes.push({ x: cx - 0.9 + j * 0.6, y: 0.7, z: side, sx: 0.4, sy: 0.26, sz: 0.025, color: windowColor });
        cubes.push({ x: cx - 0.8 + j * 0.6, y: 0.78, z: side + Math.sign(side) * 0.012, sx: 0.08, sy: 0.06, sz: 0.02, color: biome?.waterLight ?? 0x8bc7d4 });
      }
    }
    if (isLead) {
      const front = cx + data.dir * 1.52;
      cubes.push({ x: front, y: 0.52, z: -0.3, sx: 0.05, sy: 0.16, sz: 0.2, color: biome?.snow ?? 0xfff1a8 });
      cubes.push({ x: front, y: 0.52, z: 0.3, sx: 0.05, sy: 0.16, sz: 0.2, color: biome?.snow ?? 0xfff1a8 });
      cubes.push({ x: front - data.dir * 0.02, y: 0.8, z: 0, sx: 0.04, sy: 0.22, sz: 0.76, color: roofColor });
    }
  }
  group.add(createVoxelMesh(cubes));
  if (shadow) {
    const blob = carShadow.clone();
    blob.scale.set(10.2, 1.2, 1);
    blob.position.y = 0.012;
    group.add(blob);
  }
  return group;
}

export function buildCoin(value: number): THREE.Group {
  const group = new THREE.Group();
  const faceY = 0.37;

  const edge = new THREE.Mesh(coinEdgeGeometry, coinEdgeMaterial);
  edge.rotation.x = Math.PI / 2;
  edge.position.y = faceY;
  group.add(edge);

  const front = new THREE.Mesh(coinFaceGeometry, coinPigMaterial);
  front.position.set(0, faceY, 0.032);
  group.add(front);

  const back = new THREE.Mesh(coinFaceGeometry, coinTailsMaterial);
  back.position.set(0, faceY, -0.032);
  back.rotation.y = Math.PI;
  group.add(back);

  if (value === 3) {
    group.scale.setScalar(1.24);
  }
  return group;
}

/* --------------------------------------------------------------------------
   Characters
   -------------------------------------------------------------------------- */

function part(
  out: CubeSpec[],
  color: number,
  x: number,
  baseY: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  ry = 0
): void {
  out.push({ x, y: baseY + sy / 2, z, sx, sy, sz, color, ry });
}

function buildChicken(skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const body = skin.body;
  const shade = skin.bodyShade;
  const wing = skin.wing;
  const belly = skin.belly;
  const eye = skin.eye;
  const beak = skin.beak;
  const feet = skin.feet;
  const comb = skin.comb;

  // Tail fan.
  part(c, shade, 0, 0.28, -0.38, 0.32, 0.18, 0.2);
  part(c, body, -0.12, 0.4, -0.45, 0.12, 0.38, 0.14);
  part(c, body, 0, 0.4, -0.48, 0.14, 0.46, 0.14);
  part(c, body, 0.12, 0.4, -0.45, 0.12, 0.38, 0.14);
  part(c, wing, -0.12, 0.78, -0.45, 0.12, 0.09, 0.13);
  part(c, wing, 0, 0.88, -0.48, 0.14, 0.09, 0.13);
  part(c, wing, 0.12, 0.78, -0.45, 0.12, 0.09, 0.13);

  // Feet.
  part(c, feet, -0.2, 0, -0.02, 0.14, 0.08, 0.25);
  part(c, feet, 0.2, 0, -0.02, 0.14, 0.08, 0.25);
  part(c, beak, -0.2, 0.04, -0.13, 0.13, 0.04, 0.11);
  part(c, beak, 0.2, 0.04, -0.13, 0.13, 0.04, 0.11);

  // Body.
  part(c, body, 0, 0.07, 0, 0.64, 0.35, 0.65);
  part(c, body, 0, 0.38, 0.01, 0.6, 0.24, 0.6);

  // Wings.
  part(c, wing, -0.36, 0.18, 0.02, 0.12, 0.32, 0.48);
  part(c, wing, 0.36, 0.18, 0.02, 0.12, 0.32, 0.48);
  for (let i = 0; i < 3; i++) {
    part(c, shade, -0.38, 0.16 + i * 0.09, -0.09, 0.065, 0.08, 0.23);
    part(c, shade, 0.38, 0.16 + i * 0.09, -0.09, 0.065, 0.08, 0.23);
  }

  // Belly + head.
  part(c, belly, 0, 0.14, 0.315, 0.38, 0.3, 0.05);
  part(c, body, 0, 0.59, 0.04, 0.4, 0.37, 0.42);
  part(c, belly, 0, 0.51, 0.295, 0.28, 0.15, 0.04);

  // Eyes: one pair on the front of the head. The old extra side pair made
  // the chicken look four-eyed from the menu camera.
  part(c, eye, -0.14, 0.86, 0.27, 0.066, 0.082, 0.045);
  part(c, eye, 0.14, 0.86, 0.27, 0.066, 0.082, 0.045);
  part(c, 0xffffff, -0.14, 0.89, 0.294, 0.02, 0.026, 0.01);
  part(c, 0xffffff, 0.14, 0.89, 0.294, 0.02, 0.026, 0.01);

  // Beak, wattles, comb.
  part(c, beak, 0.045, 0.77, 0.345, 0.22, 0.1, 0.23);
  part(c, comb, 0.15, 0.69, 0.3, 0.07, 0.11, 0.07);
  part(c, comb, -0.15, 0.69, 0.3, 0.07, 0.11, 0.07);
  part(c, comb, 0, 1.04, 0.025, 0.092, 0.14, 0.1);
  part(c, comb, -0.098, 1.06, 0.015, 0.078, 0.19, 0.088);
  part(c, comb, 0.098, 1.05, 0.025, 0.072, 0.16, 0.08);

  return c;
}

function buildPenguin(skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const body = skin.body;
  const belly = skin.belly;
  const wing = skin.wing;
  const eye = skin.eye;
  const beak = skin.beak;
  const feet = skin.feet;

  part(c, 0x182631, 0, 0.3, -0.37, 0.28, 0.18, 0.18);
  part(c, feet, -0.18, 0, -0.04, 0.14, 0.07, 0.25);
  part(c, feet, 0.18, 0, -0.04, 0.14, 0.07, 0.25);
  part(c, body, 0, 0.08, 0, 0.64, 0.54, 0.66);
  part(c, wing, -0.35, 0.18, 0, 0.1, 0.38, 0.34);
  part(c, wing, 0.35, 0.18, 0, 0.1, 0.38, 0.34);
  part(c, belly, 0, 0.15, 0.32, 0.4, 0.38, 0.07);
  part(c, body, 0, 0.55, 0.055, 0.48, 0.4, 0.45);
  part(c, belly, 0, 0.61, 0.285, 0.36, 0.3, 0.04);

  // Scarf.
  part(c, skin.accent, 0, 0.52, 0.02, 0.5, 0.075, 0.52);
  part(c, skin.accent, 0.2, 0.34, -0.28, 0.1, 0.28, 0.07);
  part(c, skin.accent, 0.2, 0.18, -0.32, 0.13, 0.08, 0.08);

  // Face.
  part(c, belly, -0.225, 0.72, 0.08, 0.05, 0.16, 0.17);
  part(c, belly, 0.225, 0.72, 0.08, 0.05, 0.16, 0.17);
  part(c, eye, -0.253, 0.77, 0.11, 0.018, 0.068, 0.06);
  part(c, eye, 0.253, 0.77, 0.11, 0.018, 0.068, 0.06);
  part(c, beak, -0.248, 0.67, 0.22, 0.055, 0.07, 0.1);
  part(c, beak, 0.248, 0.67, 0.22, 0.055, 0.07, 0.1);
  part(c, eye, -0.12, 0.79, 0.296, 0.074, 0.085, 0.05);
  part(c, eye, 0.12, 0.79, 0.296, 0.074, 0.085, 0.05);
  part(c, beak, 0, 0.7, 0.35, 0.21, 0.1, 0.19);
  part(c, 0xe08a1c, 0, 0.72, 0.34, 0.25, 0.035, 0.16);
  return c;
}

function buildFrog(skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const body = skin.body;
  const belly = skin.belly;
  const eye = skin.eye;
  const pupil = skin.pupil;
  const beak = skin.beak;

  part(c, skin.feet, -0.17, 0, 0.12, 0.15, 0.07, 0.24);
  part(c, skin.feet, 0.17, 0, 0.12, 0.15, 0.07, 0.24);
  part(c, body, 0, 0.06, 0, 0.68, 0.46, 0.64);
  part(c, belly, 0, 0.1, 0.305, 0.46, 0.3, 0.05);
  part(c, body, 0, 0.54, 0.05, 0.5, 0.36, 0.44);

  // Bulging eyes, with pupils on the front and on the back.
  part(c, eye, -0.13, 0.82, 0.14, 0.19, 0.18, 0.18);
  part(c, eye, 0.13, 0.82, 0.14, 0.19, 0.18, 0.18);
  part(c, pupil, -0.13, 0.83, 0.235, 0.09, 0.12, 0.06);
  part(c, pupil, 0.13, 0.83, 0.235, 0.09, 0.12, 0.06);
  part(c, pupil, -0.13, 0.84, 0.03, 0.09, 0.11, 0.055);
  part(c, pupil, 0.13, 0.84, 0.03, 0.09, 0.11, 0.055);

  part(c, beak, 0, 0.64, 0.33, 0.31, 0.06, 0.05);
  part(c, skin.bodyShade, -0.25, 0.28, -0.26, 0.12, 0.1, 0.08);
  part(c, skin.bodyShade, 0.24, 0.2, -0.24, 0.1, 0.09, 0.07);
  part(c, skin.bodyShade, -0.25, 0.28, -0.07, 0.11, 0.1, 0.08);
  part(c, skin.bodyShade, 0.24, 0.2, 0.08, 0.09, 0.09, 0.08);
  part(c, skin.wing, -0.36, 0.18, 0, 0.09, 0.25, 0.34);
  part(c, skin.wing, 0.36, 0.18, 0, 0.09, 0.25, 0.34);
  return c;
}

function buildUnicorn(skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const body = skin.body;
  const belly = skin.belly;
  const eye = skin.eye;
  const mane = skin.mane;
  const beak = skin.beak;

  part(c, 0xf0d6e4, 0, 0.28, -0.38, 0.32, 0.25, 0.18);
  part(c, skin.feet, -0.16, 0, -0.02, 0.13, 0.075, 0.24);
  part(c, skin.feet, 0.16, 0, -0.02, 0.13, 0.075, 0.24);
  part(c, body, 0, 0.08, 0, 0.64, 0.53, 0.68);
  part(c, skin.wing, -0.36, 0.2, 0, 0.1, 0.33, 0.42);
  part(c, skin.wing, 0.36, 0.2, 0, 0.1, 0.33, 0.42);
  part(c, belly, 0, 0.15, 0.325, 0.4, 0.33, 0.05);
  part(c, body, 0, 0.56, 0.055, 0.48, 0.4, 0.45);
  part(c, belly, 0, 0.49, 0.295, 0.32, 0.18, 0.04);

  // Side eyes and front eyes.
  part(c, eye, -0.212, 0.86, 0.11, 0.045, 0.084, 0.08);
  part(c, eye, 0.212, 0.86, 0.11, 0.045, 0.084, 0.08);
  part(c, 0xffffff, -0.235, 0.89, 0.14, 0.015, 0.03, 0.02);
  part(c, 0xffffff, 0.235, 0.89, 0.14, 0.015, 0.03, 0.02);
  part(c, eye, -0.126, 0.86, 0.285, 0.072, 0.09, 0.052);
  part(c, eye, 0.126, 0.86, 0.285, 0.072, 0.09, 0.052);

  part(c, beak, 0, 0.77, 0.35, 0.2, 0.1, 0.18);
  part(c, mane, 0, 0.93, -0.1, 0.18, 0.16, 0.2);
  part(c, mane, -0.1, 0.9, -0.15, 0.18, 0.14, 0.16);
  part(c, mane, 0.1, 0.92, -0.12, 0.16, 0.16, 0.16);
  part(c, mane, 0, 0.9, -0.3, 0.28, 0.24, 0.15);
  part(c, skin.horn, 0, 1.0, 0.02, 0.11, 0.22, 0.11);
  part(c, 0xffe27c, 0, 1.17, 0.05, 0.075, 0.16, 0.075);
  part(c, 0xfff1b0, 0, 1.3, 0.07, 0.045, 0.12, 0.045);
  return c;
}

type MoryakaEyeShape = "open" | "sleepy" | "wink" | "closed";
type MoryakaEyeHighlight = "single" | "double" | "star" | "heart" | "none";

interface MoryakaEyeStyle {
  label: string;
  shape: MoryakaEyeShape;
  sclera: number | null;
  iris: number;
  iris2?: number;
  pupil: number;
  eyeW: number;
  eyeH: number;
  irisW: number;
  irisH: number;
  pupilW: number;
  pupilH: number;
  lash: boolean;
  highlight: MoryakaEyeHighlight;
  glow?: boolean;
}

const MORYAKA_EYE_STYLES: MoryakaEyeStyle[] = [
  { label: "Р В Р’В Р В РІР‚РЋР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", shape: "open", sclera: null, iris: 0xffa12e, pupil: 0x3a2017, eyeW: 0.13, eyeH: 0.16, irisW: 0.12, irisH: 0.14, pupilW: 0.045, pupilH: 0.08, lash: true, highlight: "double" },
  { label: "Р В Р’В Р В Р вЂ№Р В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р РЏР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚В", shape: "open", sclera: 0xfffdf8, iris: 0xffa83a, pupil: 0x2b1a18, eyeW: 0.12, eyeH: 0.14, irisW: 0.1, irisH: 0.11, pupilW: 0.04, pupilH: 0.07, lash: true, highlight: "single" },
  { label: "Р В Р’В Р РЋРЎв„ўР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В¦Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°", shape: "open", sclera: 0xfff6e2, iris: 0xffb347, pupil: 0x3a2017, eyeW: 0.16, eyeH: 0.12, irisW: 0.13, irisH: 0.1, pupilW: 0.045, pupilH: 0.07, lash: true, highlight: "double" },
  { label: "Р В Р’В Р РЋРІвЂћСћР В Р Р‹Р РЋРІР‚СљР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", shape: "open", sclera: null, iris: 0xf2932c, pupil: 0x2b1a18, eyeW: 0.15, eyeH: 0.18, irisW: 0.145, irisH: 0.17, pupilW: 0.035, pupilH: 0.05, lash: true, highlight: "double" },
  { label: "Р В Р’В Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РІР‚С™Р В Р’В Р вЂ™Р’В°Р В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В»Р В Р Р‹Р В Р вЂ°", shape: "open", sclera: 0xfff3dd, iris: 0xe8892e, pupil: 0x3a2017, eyeW: 0.14, eyeH: 0.14, irisW: 0.12, irisH: 0.12, pupilW: 0.05, pupilH: 0.075, lash: false, highlight: "double" },
  { label: "Р В Р’В Р РЋРІвЂћСћР В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†РІР‚С™Р’В¬Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р Р‹Р В Р вЂ°Р В Р’В Р РЋРІР‚В", shape: "open", sclera: 0xfff1cf, iris: 0xffab35, pupil: 0x2b1a18, eyeW: 0.13, eyeH: 0.11, irisW: 0.11, irisH: 0.095, pupilW: 0.022, pupilH: 0.09, lash: true, highlight: "single" },
  { label: "Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СћР В Р’В Р В РІР‚В¦Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", shape: "sleepy", sclera: null, iris: 0xf0a043, pupil: 0x3a2017, eyeW: 0.14, eyeH: 0.13, irisW: 0.12, irisH: 0.11, pupilW: 0.045, pupilH: 0.065, lash: true, highlight: "single" },
  { label: "Р В Р’В Р РЋРЎСџР В Р’В Р РЋРІР‚СћР В Р’В Р СћРІР‚ВР В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚вЂњР В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В Р В Р’В Р вЂ™Р’В°Р В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’Вµ", shape: "wink", sclera: null, iris: 0xffa12e, pupil: 0x3a2017, eyeW: 0.13, eyeH: 0.15, irisW: 0.12, irisH: 0.13, pupilW: 0.045, pupilH: 0.08, lash: true, highlight: "single" },
  { label: "Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В»Р В Р’В Р РЋРІР‚ВР В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", shape: "closed", sclera: null, iris: 0xffa12e, pupil: 0x3a2017, eyeW: 0.14, eyeH: 0.12, irisW: 0.1, irisH: 0.1, pupilW: 0.04, pupilH: 0.06, lash: false, highlight: "none" },
  { label: "Р В Р’В Р Р†Р вЂљРЎвЂќР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РЎвЂњР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", shape: "open", sclera: 0xfffdf8, iris: 0x78b04b, pupil: 0x20301b, eyeW: 0.13, eyeH: 0.14, irisW: 0.11, irisH: 0.12, pupilW: 0.045, pupilH: 0.075, lash: true, highlight: "double" },
  { label: "Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В±Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РЎвЂњР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", shape: "open", sclera: 0xfffdf8, iris: 0x65b8d1, pupil: 0x1c2f38, eyeW: 0.13, eyeH: 0.14, irisW: 0.11, irisH: 0.12, pupilW: 0.045, pupilH: 0.075, lash: true, highlight: "double" },
  { label: "Р В Р’В Р РЋРІР‚в„ўР В Р’В Р РЋР’ВР В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р Р‹Р Р†Р вЂљРЎв„ў", shape: "open", sclera: 0xfff4f2, iris: 0x9d72c9, pupil: 0x2c1c3c, eyeW: 0.13, eyeH: 0.14, irisW: 0.11, irisH: 0.12, pupilW: 0.045, pupilH: 0.075, lash: true, highlight: "double" },
  { label: "Р В Р’В Р Р†Р вЂљРЎС™Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р Р‹Р Р†Р вЂљР’В¦Р В Р Р‹Р В РІР‚С™Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋР’ВР В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏ", shape: "open", sclera: 0xfff6e2, iris: 0xffa12e, iris2: 0x9d72c9, pupil: 0x2b1a18, eyeW: 0.13, eyeH: 0.14, irisW: 0.11, irisH: 0.13, pupilW: 0.04, pupilH: 0.08, lash: true, highlight: "single" },
  { label: "Р В Р’В Р В Р С“Р В Р’В Р РЋРІР‚СћР В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚СћР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°Р В Р’В Р СћРІР‚В", shape: "open", sclera: 0xfff1d6, iris: 0x9b5a2e, pupil: 0x24140f, eyeW: 0.14, eyeH: 0.16, irisW: 0.12, irisH: 0.14, pupilW: 0.06, pupilH: 0.09, lash: true, highlight: "double" },
  { label: "Р В Р’В Р РЋРЎС™Р В Р’В Р вЂ™Р’ВµР В Р’В Р вЂ™Р’В¶Р В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", shape: "open", sclera: 0xfffdf8, iris: 0xffc06a, pupil: 0x3a2017, eyeW: 0.12, eyeH: 0.12, irisW: 0.1, irisH: 0.1, pupilW: 0.04, pupilH: 0.065, lash: false, highlight: "double" },
  { label: "Р В Р’В Р Р†Р вЂљРІР‚СњР В Р’В Р В РІР‚В Р В Р Р‹Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В·Р В Р’В Р СћРІР‚ВР В Р’В Р В РІР‚В¦Р В Р Р‹Р Р†Р вЂљРІвЂћвЂ“Р В Р’В Р вЂ™Р’Вµ", shape: "open", sclera: 0xfff6e2, iris: 0xffad35, pupil: 0x2b1a18, eyeW: 0.14, eyeH: 0.15, irisW: 0.12, irisH: 0.13, pupilW: 0.04, pupilH: 0.075, lash: true, highlight: "star" },
  { label: "Р В Р’В Р В Р вЂ№Р В Р’В Р вЂ™Р’ВµР В Р Р‹Р В РІР‚С™Р В Р’В Р СћРІР‚ВР В Р’В Р вЂ™Р’ВµР В Р Р‹Р Р†Р вЂљР Р‹Р В Р’В Р РЋРІР‚СњР В Р’В Р РЋРІР‚В", shape: "open", sclera: 0xfff6e2, iris: 0xf5a13d, pupil: 0x3a2017, eyeW: 0.14, eyeH: 0.15, irisW: 0.12, irisH: 0.13, pupilW: 0.04, pupilH: 0.075, lash: true, highlight: "heart" },
  { label: "Р В Р’В Р Р†Р вЂљРЎвЂќР В Р’В Р РЋРІР‚ВР В Р Р‹Р В РЎвЂњР В Р Р‹Р В Р вЂ°Р В Р’В Р РЋРІР‚В", shape: "open", sclera: 0xfff6e2, iris: 0xe8902e, pupil: 0x3a2017, eyeW: 0.16, eyeH: 0.1, irisW: 0.13, irisH: 0.085, pupilW: 0.04, pupilH: 0.06, lash: true, highlight: "double" },
  { label: "Р В Р’В Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В»Р В Р’В Р вЂ™Р’В°Р В Р Р‹Р В РЎвЂњР В Р Р‹Р В РЎвЂњР В Р’В Р РЋРІР‚ВР В Р’В Р РЋРІР‚СњР В Р’В Р вЂ™Р’В°", shape: "open", sclera: 0xfffdf8, iris: 0xffa12e, pupil: 0x24140f, eyeW: 0.145, eyeH: 0.155, irisW: 0.12, irisH: 0.135, pupilW: 0.05, pupilH: 0.075, lash: true, highlight: "double" },
  { label: "Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚ВР В Р Р‹Р В Р РЏР В Р’В Р В РІР‚В¦Р В Р’В Р РЋРІР‚ВР В Р’В Р вЂ™Р’Вµ", shape: "open", sclera: null, iris: 0xffc83d, pupil: 0x3a2017, eyeW: 0.15, eyeH: 0.16, irisW: 0.135, irisH: 0.15, pupilW: 0.04, pupilH: 0.07, lash: true, highlight: "double", glow: true }
];

let moryakaEyeVariant = 18;

export function setMoryakaEyeVariant(index: number): void {
  moryakaEyeVariant = clamp(Math.round(index), 0, MORYAKA_EYE_STYLES.length - 1);
}

export function getMoryakaEyeVariant(): number {
  return moryakaEyeVariant;
}

function eyeStack(
  c: CubeSpec[],
  color: number,
  x: number,
  baseY: number,
  z: number,
  w: number,
  h: number,
  depth: number
): void {
  // Five stepped bands make a soft oval eye instead of a rectangular window.
  const bands: Array<[number, number, number]> = [
    [0.55, 0.15, 0],
    [0.82, 0.2, 0.15],
    [1, 0.3, 0.35],
    [0.82, 0.2, 0.65],
    [0.55, 0.15, 0.85]
  ];
  for (const [bw, bh, by] of bands) {
    part(c, color, x, baseY + h * by, z, w * bw, h * bh, depth);
  }
}

type HairDepthProfile = "bob" | "long" | "ponytail" | "hat";

/** Small rear hair accents (streaks, tips, flowers) that survive the back view. */
function addRearHairAccents(c: CubeSpec[], style: string): void {
  if (style === "higanbanban") {
    part(c, 0xb8323e, -0.2, 1.0, -0.27, 0.08, 0.28, 0.015);
    part(c, 0xb8323e, 0.22, 0.9, -0.27, 0.06, 0.2, 0.015);
  } else if (style === "ditoshey") {
    part(c, 0xe4c8ff, -0.2, 0.5, -0.23, 0.2, 0.18, 0.02);
    part(c, 0xe4c8ff, 0.2, 0.5, -0.23, 0.2, 0.18, 0.02);
  } else if (style === "squimeh") {
    part(c, 0xff7fae, -0.2, 0.82, -0.27, 0.06, 0.3, 0.015);
    part(c, 0xff7fae, 0.2, 0.82, -0.27, 0.06, 0.3, 0.015);
  } else if (style === "snezha") {
    part(c, 0xfff8ef, -0.18, 0.7, -0.27, 0.08, 0.4, 0.015);
  } else if (style === "alaskanyan") {
    part(c, 0xc92f42, -0.2, 0.86, -0.27, 0.05, 0.28, 0.015);
    part(c, 0xc92f42, 0.2, 0.86, -0.27, 0.05, 0.28, 0.015);
  } else if (style === "alysque") {
    part(c, 0xff9dc8, -0.18, 0.72, -0.28, 0.08, 0.26, 0.015);
  } else if (style === "nyamuras") {
    part(c, 0x86c4ee, -0.2, 1.04, -0.27, 0.06, 0.06, 0.02);
    part(c, 0x86c4ee, 0.2, 1.02, -0.27, 0.06, 0.06, 0.02);
  } else if (style === "knjazevdesu") {
    part(c, 0x73dfce, 0.1, 1.1, -0.27, 0.05, 0.2, 0.015);
  } else if (style === "yuchii") {
    part(c, 0xef4c3a, -0.18, 1.0, -0.28, 0.1, 0.3, 0.02);
    part(c, 0xf28a2e, 0.1, 0.94, -0.28, 0.08, 0.24, 0.015);
  }
}

/** Thin outfit panels on the back so the torso does not read as bare blocks. */
function addBackOutfit(c: CubeSpec[], style: string): void {
  if (style === "higanbanban") {
    part(c, 0x1b2227, 0, 0.62, -0.19, 0.4, 0.3, 0.03);
    part(c, 0x8f2f3a, 0, 0.78, -0.2, 0.07, 0.16, 0.02);
  } else if (style === "ditoshey") {
    part(c, 0xd9c8ef, 0, 0.58, -0.2, 0.42, 0.34, 0.03);
    part(c, 0xfff8ef, 0, 0.66, -0.22, 0.18, 0.12, 0.02);
  } else if (style === "squimeh") {
    part(c, 0x1b1a22, 0, 0.58, -0.2, 0.44, 0.3, 0.03);
    part(c, 0xfff8ef, 0, 0.64, -0.22, 0.08, 0.2, 0.02);
  } else if (style === "snezha") {
    part(c, 0x1b1a22, 0, 0.69, -0.2, 0.48, 0.24, 0.04);
    part(c, 0xfff8ef, 0, 0.56, -0.22, 0.3, 0.06, 0.02);
  } else if (style === "meowlody") {
    part(c, 0xfff8ef, 0, 0.66, -0.19, 0.4, 0.22, 0.03);
    part(c, 0x17151d, 0, 0.55, -0.21, 0.38, 0.2, 0.03);
  } else if (style === "miliray") {
    part(c, 0x171318, 0, 0.5, -0.2, 0.44, 0.34, 0.04);
    part(c, 0xb8202f, -0.2, 0.4, -0.23, 0.14, 0.2, 0.02);
  } else if (style === "yuchii") {
    part(c, 0xf2b544, 0, 0.58, -0.2, 0.4, 0.26, 0.03);
    part(c, 0x3fa3a5, -0.28, 0.6, -0.24, 0.16, 0.22, 0.03);
    part(c, 0x3fa3a5, 0.28, 0.6, -0.24, 0.16, 0.22, 0.03);
  } else if (style === "alaskanyan") {
    part(c, 0x7c2430, 0, 0.5, -0.2, 0.42, 0.3, 0.03);
    part(c, 0xfff8ef, 0, 0.66, -0.22, 0.36, 0.12, 0.02);
  } else if (style === "alysque") {
    part(c, 0xf5c518, 0, 0.6, -0.21, 0.5, 0.3, 0.04);
    part(c, 0x17141a, 0, 0.82, -0.23, 0.34, 0.14, 0.03);
  } else if (style === "amelia") {
    part(c, 0x2c1b4f, 0, 0.48, -0.2, 0.44, 0.36, 0.04);
    part(c, 0xd8b36a, 0, 0.56, -0.23, 0.3, 0.025, 0.02);
  } else if (style === "nyamuras") {
    part(c, 0xf2b544, 0, 0.58, -0.2, 0.44, 0.28, 0.03);
    part(c, 0x707fc2, 0, 0.45, -0.22, 0.34, 0.16, 0.02);
  } else if (style === "knjazevdesu") {
    part(c, 0xfff8ef, 0, 0.58, -0.2, 0.4, 0.26, 0.03);
    part(c, 0x86b5d7, 0, 0.42, -0.22, 0.36, 0.14, 0.02);
  }
}

/** Small back-facing parts so ears, hats, horns and ponytails read from behind. */
function addRearDetails(c: CubeSpec[], style: string): void {
  if (style === "higanbanban") {
    part(c, 0xc0392b, -0.32, 1.2, -0.15, 0.1, 0.05, 0.12);
    part(c, 0xe05a43, -0.38, 1.23, -0.14, 0.07, 0.04, 0.08);
  } else if (style === "ditoshey") {
    for (const side of [-1, 1]) {
      part(c, 0xf3a7a7, side * 0.32, 1.3, -0.16, 0.12, 0.16, 0.1);
      part(c, 0xfff8ef, side * 0.32, 1.32, -0.1, 0.07, 0.1, 0.04);
    }
  } else if (style === "severina") {
    part(c, 0x8e7ab5, 0, 0.95, -0.34, 0.5, 0.36, 0.08);
    part(c, 0xf5c542, 0.22, 1.28, -0.2, 0.07, 0.07, 0.05);
  } else if (style === "squimeh") {
    for (const side of [-1, 1]) {
      part(c, 0x5a3829, side * 0.28, 1.34, -0.16, 0.14, 0.14, 0.1);
      part(c, 0xfff6e8, side * 0.28, 1.35, -0.1, 0.08, 0.08, 0.04);
    }
  } else if (style === "snezha") {
    for (const side of [-1, 1]) {
      part(c, 0x263a9e, side * 0.28, 1.32, -0.16, 0.14, 0.14, 0.1);
      part(c, 0xfff8ef, side * 0.28, 1.33, -0.1, 0.08, 0.08, 0.04);
    }
  } else if (style === "meowlody") {
    for (const side of [-1, 1]) {
      part(c, 0xff8fae, side * 0.4, 1.16, -0.2, 0.15, 0.15, 0.12);
    }
  } else if (style === "miliray") {
    part(c, 0x151318, 0, 1.3, -0.22, 0.2, 0.1, 0.08);
    part(c, 0x151318, -0.08, 1.38, -0.2, 0.06, 0.12, 0.05);
  } else if (style === "yuchii") {
    part(c, 0xf5c542, 0, 1.18, -0.28, 0.44, 0.16, 0.08);
    part(c, 0xfff8ef, 0.16, 1.44, -0.2, 0.1, 0.12, 0.08);
  } else if (style === "alaskanyan") {
    for (const side of [-1, 1]) {
      part(c, 0xf1eef2, side * 0.28, 1.32, -0.16, 0.14, 0.14, 0.1);
      part(c, 0xffc5d8, side * 0.28, 1.33, -0.1, 0.07, 0.07, 0.04);
    }
  } else if (style === "alysque") {
    part(c, 0xf5c518, 0, 1.05, -0.3, 0.52, 0.32, 0.08);
    part(c, 0x17141a, -0.3, 1.2, -0.24, 0.1, 0.14, 0.08);
  } else if (style === "amelia") {
    for (const side of [-1, 1]) {
      part(c, 0x1a1420, side * 0.16, 1.34, -0.14, 0.08, 0.12, 0.08);
    }
  } else if (style === "nyamuras") {
    part(c, 0xf2e2a8, 0, 1.22, -0.26, 0.72, 0.06, 0.1);
  } else if (style === "knjazevdesu") {
    part(c, 0x2fbfae, 0, 1.24, -0.24, 0.16, 0.2, 0.14);
    part(c, 0x2fbfae, 0.08, 1.06, -0.28, 0.12, 0.24, 0.1);
  }
}

/** Thin depth pass: hair reads from every angle, but never becomes a second wig. */
function addHairDepth(c: CubeSpec[], color: number, profile: HairDepthProfile): void {
  // Very thin rear shell, hugging the skull.
  part(c, color, 0, 1.0, -0.235, 0.52, 0.38, 0.025);
  if (profile === "long") {
    part(c, color, 0, 0.68, -0.205, 0.44, 0.36, 0.035);
  }
  for (const side of [-1, 1]) {
    // Side rim, only a few centimetres thick.
    part(c, color, side * 0.27, 0.9, -0.06, 0.035, 0.42, 0.22);
    // Outer locks in front of the eyes, framing the face.
    part(c, color, side * 0.19, 0.86, 0.30, 0.06, 0.3, 0.025);
    part(c, color, side * 0.15, 1.13, 0.3, 0.13, 0.1, 0.02);
  }
}

interface BlockEyeOptions {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  white: number;
  iris: number;
  pupil: number;
  outline: number;
  frame?: number;
}

/** Maximally simple voxel eyes: stacked flat rectangles, no 3D or decals. */
function blockEye(c: CubeSpec[], o: BlockEyeOptions): void {
  if (o.frame !== undefined) {
    c.push({ x: o.x, y: o.y, z: o.z, sx: o.w + 0.055, sy: o.h + 0.055, sz: 0.008, color: o.frame });
  }
  c.push({ x: o.x, y: o.y, z: o.z + 0.004, sx: o.w + 0.018, sy: o.h + 0.018, sz: 0.007, color: o.outline });
  c.push({ x: o.x, y: o.y, z: o.z + 0.008, sx: o.w, sy: o.h, sz: 0.006, color: o.white });
  c.push({ x: o.x, y: o.y - 0.004, z: o.z + 0.012, sx: o.w * 0.67, sy: o.h * 0.74, sz: 0.005, color: o.iris });
  c.push({ x: o.x, y: o.y - 0.004, z: o.z + 0.016, sx: o.w * 0.26, sy: o.h * 0.46, sz: 0.004, color: o.pupil });
  c.push({ x: o.x - o.w * 0.2, y: o.y + o.h * 0.22, z: o.z + 0.019, sx: o.w * 0.12, sy: o.h * 0.14, sz: 0.003, color: 0xffffff });
}

function buildMoryakaEyes(c: CubeSpec[], style: MoryakaEyeStyle): void {
  const baseY = 0.86;
  const eyeW = style.eyeW;
  const eyeH = style.eyeH;
  const irisW = style.irisW;
  const irisH = style.irisH;
  const pupilW = style.pupilW;
  const pupilH = style.pupilH;
  for (const side of [-1, 1]) {
    const closed = style.shape === "closed" || (style.shape === "wink" && side > 0);
    if (closed) {
      part(c, 0x76513d, side * 0.145, 0.92, 0.336, 0.14, 0.022, 0.006);
      part(c, 0x76513d, side * 0.2, 0.94, 0.336, 0.03, 0.018, 0.006);
      continue;
    }
    const outlineW = eyeW + 0.008;
    const outlineH = eyeH + 0.008;
    eyeStack(c, 0x76513d, side * 0.145, baseY - 0.01, 0.333, outlineW, outlineH, 0.007);
    if (style.glow) {
      eyeStack(c, 0xffe69a, side * 0.145, baseY - 0.003, 0.335, irisW + 0.026, irisH + 0.026, 0.006);
    }
    if (style.sclera !== null) {
      eyeStack(c, style.sclera, side * 0.145, baseY + 0.003, 0.336, eyeW, eyeH, 0.006);
    }
    const iris = style.iris2 !== undefined && side > 0 ? style.iris2 : style.iris;
    const irisY = baseY + (eyeH - irisH) / 2;
    eyeStack(c, iris, side * 0.145, irisY, 0.339, irisW, irisH, 0.006);
    const pupilY = baseY + (eyeH - pupilH) / 2;
    eyeStack(c, style.pupil, side * 0.145, pupilY, 0.342, pupilW, pupilH, 0.005);
    if (style.highlight === "single" || style.highlight === "double") {
      part(c, 0xffffff, side * 0.145 - 0.025, baseY + eyeH * 0.62, 0.345, 0.03, 0.032, 0.003);
      if (style.highlight === "double") {
        part(c, 0xffffff, side * 0.145 + 0.018, baseY + eyeH * 0.28, 0.345, 0.018, 0.018, 0.003);
      }
    } else if (style.highlight === "star") {
      part(c, 0xffffff, side * 0.145 - 0.016, baseY + eyeH * 0.6, 0.345, 0.034, 0.011, 0.003);
      part(c, 0xffffff, side * 0.145 - 0.016, baseY + eyeH * 0.6, 0.347, 0.011, 0.034, 0.003);
    } else if (style.highlight === "heart") {
      part(c, 0xffffff, side * 0.145 - 0.027, baseY + eyeH * 0.68, 0.345, 0.017, 0.017, 0.003);
      part(c, 0xffffff, side * 0.145 - 0.003, baseY + eyeH * 0.68, 0.345, 0.017, 0.017, 0.003);
      part(c, 0xffffff, side * 0.145 - 0.015, baseY + eyeH * 0.52, 0.345, 0.023, 0.017, 0.003);
    }
    if (style.lash) {
      part(c, 0x76513d, side * (0.145 + eyeW * 0.54), baseY + eyeH * 0.82, 0.334, 0.025, 0.07, 0.005);
      part(c, 0x76513d, side * (0.145 + eyeW * 0.36), baseY + eyeH * 0.94, 0.334, 0.062, 0.018, 0.005);
    }
    if (style.shape === "sleepy") {
      part(c, 0xfff7e4, side * 0.145, baseY + eyeH * 0.55, 0.346, eyeW + 0.01, eyeH * 0.42, 0.004);
    }
  }
}

function buildMoryaka(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const fur = 0x8a563d;
  const furDark = 0x663c2b;
  const furLight = 0xa86f50;
  const cream = 0xfff7e4;
  const purple = 0x4f3f66;
  const purpleLight = 0x6d5a86;
  const yellow = 0xffb72e;
  const orange = 0xf08a2c;
  const orangeDeep = 0xd8681e;
  const lens = 0x3b3446;
  const green = 0x65d17c;
  const ink = 0x2b1a18;

  // Boots and legs.
  for (const side of [-1, 1]) {
    part(c, furDark, side * 0.15, 0, 0.02, 0.2, 0.08, 0.28);
    part(c, orange, side * 0.15, 0.08, 0.02, 0.16, 0.16, 0.2);
    part(c, cream, side * 0.15, 0.2, 0.01, 0.18, 0.09, 0.22);
    part(c, yellow, side * 0.21, 0.24, 0.04, 0.045, 0.035, 0.12);
  }

  // Hips and jacket.
  part(c, purple, 0, 0.24, 0, 0.44, 0.14, 0.34);
  part(c, cream, 0, 0.31, 0.01, 0.46, 0.3, 0.38);
  part(c, purple, -0.245, 0.34, 0, 0.07, 0.31, 0.39);
  part(c, purple, 0.245, 0.34, 0, 0.07, 0.31, 0.39);
  part(c, yellow, 0, 0.34, 0.205, 0.055, 0.31, 0.035);
  for (let i = 0; i < 6; i++) {
    part(c, 0xe6e2db, 0, 0.22 + i * 0.055, 0.225, 0.09, 0.035, 0.025);
  }
  part(c, purple, 0, 0.59, 0.01, 0.5, 0.09, 0.41);
  part(c, yellow, -0.17, 0.63, 0.19, 0.13, 0.05, 0.05);
  part(c, yellow, 0.17, 0.63, 0.19, 0.13, 0.05, 0.05);

  // Big mitten paws.
  for (const side of [-1, 1]) {
    part(c, purple, side * 0.34, 0.27, 0.06, 0.13, 0.2, 0.2);
    part(c, cream, side * 0.39, 0.17, 0.12, 0.21, 0.25, 0.29);
    part(c, purple, side * 0.5, 0.2, 0.12, 0.08, 0.22, 0.28);
    part(c, yellow, side * 0.36, 0.14, 0.28, 0.1, 0.09, 0.06);
    part(c, orange, side * 0.45, 0.15, 0.28, 0.055, 0.065, 0.05);
    part(c, cream, side * 0.3, 0.31, 0.1, 0.07, 0.11, 0.12);
  }

  // Slim mostly-white tail rooted at the centre of the lower back, then
  // curving outward so it does not look attached to the hip.
  const tailBands: Array<[number, number, number, number, number, number]> = [
    [0.0, 0.14, -0.16, 0.18, 0.12, 0xfff7ea],
    [0.0, 0.26, -0.2, 0.15, 0.12, 0xfff7ea],
    [0.02, 0.38, -0.23, 0.135, 0.11, 0x6d5a86],
    [0.06, 0.5, -0.25, 0.12, 0.11, 0xfff7ea],
    [0.11, 0.62, -0.25, 0.11, 0.11, 0xfff7ea],
    [0.16, 0.74, -0.23, 0.1, 0.1, 0xffc247],
    [0.22, 0.86, -0.2, 0.09, 0.1, 0xfff7ea],
    [0.28, 0.98, -0.17, 0.08, 0.09, 0xfff7ea],
    [0.34, 1.08, -0.14, 0.07, 0.09, 0xb9b3ac]
  ];
  for (const [x, y, z, sx, sy, color] of tailBands) {
    part(c, color, x, y, z, sx, sy, 0.1);
  }
  // Small side hood fin only; the big purple block that used to sit behind
  // the head is gone.
  part(c, 0x6d5a86, 0.38, 1.08, -0.18, 0.12, 0.16, 0.05);

  // Back-facing hair accents and jacket hardware, so the character reads from
  // the gameplay camera as well as from the front portrait.
  part(c, purple, -0.36, 0.82, -0.3, 0.1, 0.1, 0.08);
  part(c, yellow, 0.36, 0.82, -0.3, 0.1, 0.1, 0.08);
  part(c, yellow, -0.5, 0.82, -0.28, 0.1, 0.15, 0.07);
  part(c, purple, 0.5, 0.82, -0.28, 0.1, 0.15, 0.07);
  part(c, furLight, -0.15, 0.87, -0.3, 0.16, 0.2, 0.06);
  part(c, furLight, 0.15, 0.87, -0.3, 0.16, 0.2, 0.06);
  part(c, purple, 0, 0.5, -0.205, 0.44, 0.06, 0.04);
  part(c, cream, 0, 0.36, -0.205, 0.38, 0.05, 0.035);

  // Head and fluffy cheeks.
  part(c, fur, 0, 0.67, 0.01, 0.66, 0.5, 0.54);
  part(c, fur, -0.3, 0.74, 0.01, 0.16, 0.3, 0.46);
  part(c, fur, 0.3, 0.74, 0.01, 0.16, 0.3, 0.46);
  part(c, furLight, 0, 0.72, 0.27, 0.4, 0.24, 0.05);

  // Face: soft cream mask and a selectable eye style.
  part(c, cream, 0, 0.78, 0.305, 0.46, 0.31, 0.03);
  part(c, cream, 0, 0.72, 0.315, 0.42, 0.22, 0.035);
  // Rectangular fringe under the goggles and the signature white blaze.
  part(c, furDark, -0.23, 0.92, 0.338, 0.09, 0.18, 0.04);
  part(c, fur, -0.13, 0.9, 0.342, 0.1, 0.2, 0.04);
  part(c, fur, -0.02, 0.9, 0.344, 0.09, 0.21, 0.04);
  part(c, furLight, 0.09, 0.91, 0.342, 0.09, 0.19, 0.04);
  part(c, furDark, 0.21, 0.92, 0.338, 0.08, 0.18, 0.04);
  part(c, 0xfff6e5, -0.045, 0.88, 0.352, 0.065, 0.28, 0.035);
  part(c, 0xf0d8be, 0.015, 0.9, 0.348, 0.045, 0.18, 0.03);

  // Simple stacked-rectangle face using the selected eye colours.
  const simpleEye = MORYAKA_EYE_STYLES[moryakaEyeVariant] ?? MORYAKA_EYE_STYLES[0];
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.145, y: 0.86, z: 0.348, w: 0.16, h: 0.14, white: 0xfff8ec, iris: simpleEye.iris, pupil: simpleEye.pupil, outline: 0x5b3a2e });
  }
  part(c, 0x9b5a5a, 0, 0.79, 0.354, 0.04, 0.022, 0.012);
  part(c, 0x8e4b4b, 0, 0.758, 0.354, 0.065, 0.018, 0.012);

  // Hair masses, ponytails and a white blaze.
  for (const side of [-1, 1]) {
    part(c, furDark, side * 0.39, 0.58, -0.06, 0.24, 0.34, 0.4);
    part(c, fur, side * 0.46, 0.7, -0.03, 0.2, 0.35, 0.32);
    part(c, furLight, side * 0.5, 0.85, -0.08, 0.16, 0.17, 0.2);
    part(c, side < 0 ? yellow : purple, side * 0.52, 0.72, 0.02, 0.09, 0.2, 0.18);
    part(c, side < 0 ? purple : yellow, side * 0.43, 0.56, -0.16, 0.13, 0.2, 0.18);
    part(c, cream, side * 0.5, 0.58, 0.08, 0.09, 0.13, 0.07);
  }
  part(c, cream, -0.03, 0.98, 0.305, 0.09, 0.22, 0.04);

  // Raccoon ears with different inner colours. They sit outside the head
  // silhouette so they stay visible from the front instead of hiding in hair.
  for (const side of [-1, 1]) {
    part(c, fur, side * 0.42, 1.12, 0.02, 0.18, 0.12, 0.16);
    part(c, furLight, side * 0.43, 1.23, 0.02, 0.14, 0.12, 0.14);
    part(c, fur, side * 0.44, 1.33, 0.02, 0.08, 0.08, 0.1);
    part(c, side < 0 ? purple : yellow, side * 0.41, 1.15, 0.11, 0.1, 0.15, 0.04);
    part(c, side < 0 ? purple : yellow, side * 0.43, 1.15, -0.07, 0.13, 0.15, 0.04);
  }

  // Forehead tuft.
  part(c, fur, -0.08, 1.14, -0.09, 0.14, 0.2, 0.16);
  part(c, furDark, 0.02, 1.27, -0.05, 0.11, 0.16, 0.12);
  part(c, fur, 0.02, 1.38, -0.02, 0.09, 0.12, 0.1);

  // Goggles pushed up on the forehead, clear of the eyes.
  part(c, purple, 0, 1.15, 0.31, 0.68, 0.055, 0.055);
  part(c, purpleLight, -0.34, 1.15, 0.2, 0.075, 0.055, 0.16);
  part(c, purpleLight, 0.34, 1.15, 0.2, 0.075, 0.055, 0.16);
  part(c, lens, -0.14, 1.13, 0.345, 0.25, 0.11, 0.03);
  part(c, lens, 0.14, 1.13, 0.345, 0.25, 0.11, 0.03);
  part(c, yellow, 0, 1.13, 0.36, 0.055, 0.08, 0.02);
  part(c, yellow, 0, 1.115, 0.356, 0.54, 0.025, 0.02);
  part(c, yellow, -0.14, 1.225, 0.356, 0.26, 0.025, 0.02);
  part(c, yellow, 0.14, 1.225, 0.356, 0.26, 0.025, 0.02);
  part(c, 0x8a8093, -0.21, 1.16, 0.365, 0.06, 0.075, 0.012);
  part(c, 0x8a8093, 0.2, 1.16, 0.365, 0.045, 0.06, 0.012);
  part(c, 0xe8b45f, 0.235, 1.175, 0.365, 0.055, 0.032, 0.014);
  part(c, green, 0.225, 1.18, 0.375, 0.03, 0.018, 0.008);
  part(c, 0xe3ddd3, -0.24, 1.13, 0.365, 0.06, 0.015, 0.01);

  // Extra detail pass: goggle strap, floppy ear tips, jacket hardware.
  part(c, purple, -0.35, 1.17, 0.02, 0.05, 0.05, 0.36);
  part(c, purple, 0.35, 1.17, 0.02, 0.05, 0.05, 0.36);
  part(c, purple, 0, 1.17, -0.31, 0.66, 0.045, 0.05);
  part(c, 0x8a8093, -0.35, 1.185, 0.06, 0.055, 0.012, 0.34);
  part(c, 0x8a8093, 0.35, 1.185, 0.06, 0.055, 0.012, 0.34);
  for (const side of [-1, 1]) {
    part(c, cream, side * 0.5, 0.56, 0.08, 0.1, 0.14, 0.08);
    part(c, 0xfff7ea, side * 0.52, 0.54, 0.06, 0.07, 0.1, 0.06);
    part(c, furLight, side * 0.46, 0.7, 0.02, 0.12, 0.12, 0.14);
    part(c, yellow, side * 0.34, 0.33, 0.12, 0.13, 0.04, 0.24);
    part(c, 0x8a8093, side * 0.15, 0.12, 0.08, 0.18, 0.03, 0.02);
    part(c, yellow, side * 0.15, 0.09, 0.2, 0.06, 0.03, 0.03);
  }
  part(c, yellow, 0, 0.3, 0.235, 0.03, 0.06, 0.03);
  part(c, 0xe6e2db, -0.18, 0.5, 0.215, 0.05, 0.05, 0.02);
  part(c, purpleLight, 0, 0.66, 0.22, 0.26, 0.04, 0.02);

  return c;
}

function buildSeverina(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const purple = 0x8a74c9;
  const purpleDark = 0x6a56a6;
  const purpleLight = 0xa692d8;
  const purpleDeep = 0x4e3d7d;
  const fin = 0x3f7776;
  const finLight = 0x6ba29b;
  const finDark = 0x2b5a59;
  const skin = 0xfff1e8;
  const hair = 0xe8d4f2;
  const hairDark = 0xcdb2dd;
  const cream = 0xf6ead7;
  const teal = 0x6fd3d0;
  const gold = 0xd9a640;
  const green = 0x5caf7a;
  const greenDark = 0x3f8159;
  const white = 0xfffbf4;
  const black = 0x221a2c;

  // Green webbed feet and onesie legs.
  for (const side of [-1, 1]) {
    part(c, greenDark, side * 0.13, 0.01, 0.06, 0.19, 0.06, 0.24);
    for (const dx of [-0.06, 0, 0.06]) {
      part(c, green, side * 0.13 + dx, 0.02, 0.2, 0.05, 0.035, 0.09);
    }
    part(c, purple, side * 0.13, 0.06, 0.0, 0.17, 0.36, 0.19);
    part(c, purpleLight, side * 0.13, 0.3, 0.0, 0.15, 0.04, 0.17);
  }

  // Purple kigurumi body with a cream belly and drawstrings.
  part(c, purple, 0, 0.4, 0.0, 0.46, 0.34, 0.36);
  part(c, purpleDark, 0, 0.4, 0.0, 0.48, 0.07, 0.37);
  part(c, cream, 0, 0.43, 0.185, 0.26, 0.28, 0.03);
  part(c, 0xe1d8c8, 0, 0.45, 0.2, 0.02, 0.22, 0.012);
  part(c, purple, 0, 0.72, 0.0, 0.4, 0.08, 0.33);
  for (const side of [-1, 1]) {
    part(c, white, side * 0.05, 0.62, 0.2, 0.022, 0.12, 0.012);
    part(c, white, side * 0.05, 0.58, 0.212, 0.035, 0.035, 0.02);
  }

  // Sleeves with soft paws.
  for (const side of [-1, 1]) {
    part(c, purple, side * 0.29, 0.46, 0.02, 0.14, 0.22, 0.2);
    part(c, purpleLight, side * 0.3, 0.4, 0.03, 0.13, 0.08, 0.19);
    part(c, purple, side * 0.31, 0.34, 0.06, 0.12, 0.08, 0.15);
  }

  // Neck and head.
  part(c, skin, 0, 0.74, 0.0, 0.15, 0.14, 0.15);
  part(c, skin, 0, 0.8, 0.08, 0.46, 0.36, 0.32);

  // Pale lavender-pink bob and fringe.
  part(c, hair, 0, 0.9, -0.02, 0.5, 0.34, 0.42);
  part(c, hair, 0, 1.2, -0.04, 0.44, 0.1, 0.34);
  for (const side of [-1, 1]) {
    part(c, hair, side * 0.26, 0.82, 0.02, 0.1, 0.34, 0.34);
    part(c, hairDark, side * 0.3, 0.84, -0.02, 0.08, 0.3, 0.28);
    part(c, hair, side * 0.19, 1.02, 0.25, 0.12, 0.14, 0.05);
  }
  part(c, hair, 0, 1.04, 0.25, 0.36, 0.12, 0.05);
  part(c, hair, -0.1, 1.03, 0.26, 0.14, 0.1, 0.045);
  part(c, hair, 0.1, 1.05, 0.26, 0.13, 0.09, 0.045);
  part(c, hairDark, -0.02, 1.1, 0.27, 0.03, 0.08, 0.015);

  // Big sleepy teal eyes with heavy lids and a small mouth.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.115, y: 0.95, z: 0.245, w: 0.17, h: 0.15, white: 0xfff8ec, iris: teal, pupil: 0x1e3a38, outline: 0x3a2a4a });
    part(c, skin, side * 0.115, 0.998, 0.258, 0.18, 0.03, 0.012);
    part(c, 0x3a2a4a, side * 0.115, 1.018, 0.261, 0.19, 0.012, 0.01);
    part(c, 0x8f7aa6, side * 0.115, 1.035, 0.252, 0.15, 0.016, 0.01);
    part(c, 0xf6c9c1, side * 0.19, 0.9, 0.255, 0.06, 0.022, 0.01);
  }
  part(c, 0xd8a0a8, 0, 0.875, 0.258, 0.04, 0.016, 0.012);
  part(c, 0xc98f9a, 0, 0.858, 0.256, 0.055, 0.014, 0.01);

  // Anglerfish hood: shell, top, face plate and rim.
  part(c, purple, 0, 0.84, -0.24, 0.6, 0.44, 0.18);
  part(c, purpleDark, 0, 0.84, -0.34, 0.54, 0.4, 0.04);
  part(c, purple, 0, 1.3, -0.12, 0.58, 0.14, 0.32);
  part(c, purple, 0, 1.2, 0.12, 0.56, 0.18, 0.1);
  for (const side of [-1, 1]) {
    part(c, purple, side * 0.28, 0.84, -0.14, 0.1, 0.4, 0.32);
    part(c, purpleLight, side * 0.33, 0.9, -0.1, 0.04, 0.28, 0.26);
  }
  part(c, purpleLight, 0, 1.14, 0.19, 0.54, 0.08, 0.14);
  part(c, purpleLight, 0, 0.74, 0.19, 0.56, 0.08, 0.14);
  for (const side of [-1, 1]) {
    part(c, purpleLight, side * 0.25, 0.8, 0.19, 0.08, 0.36, 0.14);
  }
  part(c, purpleDeep, 0, 1.1, 0.265, 0.46, 0.02, 0.02);
  part(c, purpleDeep, 0, 0.79, 0.265, 0.48, 0.02, 0.02);
  for (const side of [-1, 1]) {
    part(c, purpleDeep, side * 0.215, 0.82, 0.265, 0.02, 0.26, 0.02);
  }

  // Zigzag teeth around the hood mouth.
  for (let i = 0; i < 6; i++) {
    const x = -0.19 + i * 0.076;
    c.push({ x, y: 1.115, z: 0.3, sx: 0.055, sy: 0.055, sz: 0.02, color: cream, rz: Math.PI / 4 });
  }
  for (let i = 0; i < 3; i++) {
    const y = 0.9 + i * 0.075;
    c.push({ x: -0.245, y, z: 0.3, sx: 0.05, sy: 0.05, sz: 0.02, color: cream, rz: Math.PI / 4 });
    c.push({ x: 0.245, y, z: 0.3, sx: 0.05, sy: 0.05, sz: 0.02, color: cream, rz: Math.PI / 4 });
  }
  for (let i = 0; i < 4; i++) {
    const x = -0.15 + i * 0.1;
    c.push({ x, y: 0.8, z: 0.3, sx: 0.05, sy: 0.05, sz: 0.02, color: cream, rz: Math.PI / 4 });
  }

  // Googly eyes on the hood.
  for (const side of [-1, 1]) {
    part(c, black, side * 0.19, 1.235, 0.13, 0.17, 0.17, 0.06);
    part(c, white, side * 0.19, 1.24, 0.17, 0.15, 0.15, 0.1);
    part(c, black, side * 0.175, 1.245, 0.268, 0.07, 0.07, 0.02);
    part(c, white, side * 0.155, 1.275, 0.276, 0.025, 0.025, 0.01);
  }

  // Lure stalk with a hanging gold bell.
  part(c, purpleDeep, 0.02, 1.42, -0.02, 0.05, 0.1, 0.05);
  part(c, purpleDeep, 0.03, 1.5, 0.04, 0.045, 0.08, 0.045);
  part(c, purple, 0.04, 1.56, 0.1, 0.04, 0.06, 0.04);
  part(c, purpleDeep, 0.04, 1.54, 0.15, 0.03, 0.05, 0.03);
  part(c, gold, 0.04, 1.42, 0.2, 0.1, 0.1, 0.1);
  part(c, 0x8b5e1a, 0.04, 1.445, 0.252, 0.04, 0.02, 0.012);
  part(c, 0xf7d778, 0.02, 1.48, 0.25, 0.025, 0.025, 0.008);
  part(c, gold, 0.04, 1.52, 0.2, 0.06, 0.03, 0.06);

  // Hood fins and the kigurumi fish tail.
  for (const side of [-1, 1]) {
    part(c, fin, side * 0.34, 0.94, -0.04, 0.14, 0.2, 0.1);
    part(c, finLight, side * 0.38, 1.04, -0.08, 0.1, 0.13, 0.07);
    part(c, finDark, side * 0.31, 0.82, -0.08, 0.1, 0.12, 0.06);
  }
  part(c, fin, 0, 1.26, -0.34, 0.14, 0.16, 0.05);
  part(c, finLight, 0, 1.36, -0.33, 0.09, 0.09, 0.04);
  part(c, purple, 0, 0.44, -0.24, 0.16, 0.13, 0.13);
  part(c, purple, 0.12, 0.48, -0.32, 0.15, 0.12, 0.12);
  part(c, purpleLight, 0.24, 0.54, -0.35, 0.13, 0.11, 0.11);
  part(c, fin, 0.34, 0.6, -0.34, 0.14, 0.13, 0.07);
  part(c, finLight, 0.42, 0.66, -0.31, 0.1, 0.1, 0.05);
  part(c, finDark, 0.37, 0.55, -0.36, 0.07, 0.09, 0.04);

  return c;
}
function buildHiganbanban(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const green = 0x1f6b5a;
  const greenLight = 0x2e8f73;
  const greenDark = 0x124d43;
  const greenDeep = 0x0c3a33;
  const red = 0xd8343f;
  const redLight = 0xef4e4e;
  const redDark = 0x8f1f2e;
  const black = 0x181d1f;
  const charcoal = 0x242b2d;
  const cream = 0xfff9ec;
  const skin = 0xffe8dc;
  const orange = 0xff5a2e;
  const orangeLight = 0xff9a3d;
  const gold = 0xe9c46a;
  const silver = 0x9aa5a1;

  // Laced platform boots and thigh-high stockings.
  for (const side of [-1, 1]) {
    part(c, black, side * 0.15, 0.02, 0.02, 0.19, 0.1, 0.26);
    part(c, greenDeep, side * 0.15, 0.1, 0.02, 0.18, 0.04, 0.24);
    part(c, red, side * 0.15, 0.13, 0.14, 0.05, 0.03, 0.06);
    part(c, black, side * 0.14, 0.12, 0.0, 0.16, 0.3, 0.19);
    part(c, silver, side * 0.14, 0.22, 0.1, 0.1, 0.012, 0.01);
    part(c, silver, side * 0.14, 0.28, 0.1, 0.1, 0.012, 0.01);
    part(c, green, side * 0.14, 0.4, 0.0, 0.17, 0.04, 0.2);
  }

  // Flared black skirt with a red trim.
  part(c, black, 0, 0.4, 0.0, 0.46, 0.14, 0.34);
  part(c, charcoal, 0, 0.38, 0.02, 0.5, 0.06, 0.36);
  part(c, redDark, 0, 0.38, 0.19, 0.44, 0.03, 0.02);
  part(c, black, 0, 0.52, 0.0, 0.4, 0.08, 0.3);

  // Jacket with a white shirt, red tie and green racing panel.
  part(c, charcoal, 0, 0.58, 0.0, 0.46, 0.28, 0.36);
  part(c, black, -0.21, 0.58, 0.02, 0.1, 0.28, 0.33);
  part(c, green, 0.19, 0.58, 0.02, 0.08, 0.26, 0.33);
  part(c, cream, 0, 0.6, 0.19, 0.14, 0.2, 0.03);
  part(c, red, 0, 0.66, 0.205, 0.06, 0.14, 0.02);
  part(c, red, 0, 0.72, 0.205, 0.1, 0.035, 0.02);
  part(c, red, 0, 0.61, 0.205, 0.08, 0.03, 0.02);
  for (let i = 0; i < 4; i++) {
    part(c, silver, 0.13, 0.63 + i * 0.05, 0.19, 0.025, 0.015, 0.012);
  }

  // Arms with cuffs and silver knuckles.
  for (const side of [-1, 1]) {
    part(c, black, side * 0.28, 0.52, 0.02, 0.14, 0.3, 0.24);
    part(c, charcoal, side * 0.3, 0.44, 0.04, 0.12, 0.1, 0.22);
    part(c, skin, side * 0.3, 0.38, 0.1, 0.11, 0.08, 0.14);
    part(c, black, side * 0.31, 0.33, 0.1, 0.11, 0.07, 0.14);
    part(c, silver, side * 0.31, 0.34, 0.18, 0.06, 0.04, 0.02);
    part(c, red, side * 0.24, 0.6, 0.16, 0.05, 0.16, 0.03);
  }

  // Choker with a red gem.
  part(c, skin, 0, 0.9, 0.0, 0.18, 0.12, 0.18);
  part(c, black, 0, 0.88, 0.0, 0.26, 0.06, 0.22);
  part(c, red, 0, 0.855, 0.12, 0.055, 0.06, 0.03);
  part(c, redLight, 0, 0.875, 0.14, 0.02, 0.02, 0.01);

  // Head.
  part(c, skin, 0, 0.94, 0.09, 0.46, 0.36, 0.34);

  // Layered dark-green bob: stepped cap, crown, jagged back mass.
  part(c, green, 0, 1.0, -0.04, 0.56, 0.34, 0.46);
  part(c, green, 0, 1.32, -0.06, 0.48, 0.1, 0.38);
  part(c, greenDeep, 0, 0.5, -0.26, 0.48, 0.56, 0.12);
  part(c, greenDeep, 0, 0.44, -0.27, 0.44, 0.1, 0.1);
  part(c, green, -0.15, 0.38, -0.28, 0.13, 0.1, 0.08);
  part(c, green, 0.02, 0.36, -0.28, 0.12, 0.09, 0.08);
  part(c, green, 0.17, 0.4, -0.28, 0.11, 0.09, 0.08);
  part(c, greenLight, 0, 0.52, -0.33, 0.02, 0.44, 0.012);
  part(c, redDark, -0.17, 0.62, -0.332, 0.05, 0.34, 0.012);
  part(c, redDark, 0.15, 0.7, -0.332, 0.04, 0.28, 0.012);
  part(c, greenLight, -0.2, 0.9, -0.33, 0.03, 0.24, 0.012);

  // Side masses with jaw-length tips and red streaks.
  for (const side of [-1, 1]) {
    part(c, green, side * 0.29, 0.74, -0.02, 0.14, 0.56, 0.4);
    part(c, greenDark, side * 0.3, 0.74, -0.01, 0.1, 0.34, 0.32);
    part(c, green, side * 0.25, 0.66, 0.06, 0.11, 0.16, 0.26);
    part(c, greenLight, side * 0.33, 1.06, 0.0, 0.1, 0.18, 0.3);
    part(c, red, side * 0.3, 0.72, 0.19, 0.045, 0.22, 0.03);
    part(c, redDark, side * 0.3, 0.58, 0.13, 0.04, 0.14, 0.03);
  }

  // Blunt layered fringe: five locks with a red streak on the left.
  part(c, green, 0, 1.16, 0.28, 0.46, 0.16, 0.05);
  part(c, green, -0.18, 1.15, 0.29, 0.14, 0.15, 0.05);
  part(c, green, -0.03, 1.17, 0.295, 0.11, 0.13, 0.05);
  part(c, green, 0.1, 1.16, 0.295, 0.11, 0.14, 0.05);
  part(c, greenLight, 0.2, 1.15, 0.285, 0.1, 0.15, 0.045);
  part(c, red, -0.22, 1.14, 0.285, 0.07, 0.15, 0.04);
  part(c, redLight, -0.19, 1.22, 0.305, 0.03, 0.08, 0.02);
  part(c, greenDeep, 0.02, 1.16, 0.31, 0.015, 0.12, 0.008);

  // Ahoge: a four-segment curl.
  part(c, green, -0.02, 1.4, -0.02, 0.06, 0.1, 0.06);
  part(c, green, -0.08, 1.48, -0.03, 0.055, 0.09, 0.055);
  part(c, greenLight, -0.12, 1.55, -0.04, 0.05, 0.08, 0.05);
  part(c, greenLight, -0.1, 1.61, -0.05, 0.04, 0.06, 0.04);

  // Detailed spider lily on the right side, with a stem and gold core.
  const fx = 0.3;
  const fy = 1.32;
  const fz = 0.24;
  for (let petalIndex = 0; petalIndex < 8; petalIndex++) {
    const angle = (petalIndex / 8) * Math.PI * 2 - 0.2;
    for (let seg = 0; seg < 3; seg++) {
      const radius = 0.05 + seg * 0.055;
      const petalAngle = angle + seg * 0.1;
      c.push({
        x: fx + Math.cos(petalAngle) * radius,
        y: fy + Math.sin(petalAngle) * radius,
        z: fz + seg * 0.004,
        sx: 0.12 - seg * 0.025,
        sy: 0.035,
        sz: 0.03,
        color: seg === 2 ? redLight : red,
        rz: petalAngle
      });
    }
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    c.push({
      x: fx + Math.cos(a) * 0.025, y: fy + Math.sin(a) * 0.025, z: fz + 0.02,
      sx: 0.07, sy: 0.01, sz: 0.01, color: gold, rz: a
    });
  }
  part(c, redDark, fx, fy, fz + 0.012, 0.1, 0.1, 0.05);
  part(c, gold, fx, fy, fz + 0.05, 0.045, 0.045, 0.03);
  part(c, green, fx - 0.02, fy - 0.16, fz - 0.04, 0.035, 0.18, 0.03);
  part(c, green, fx - 0.06, fy - 0.2, fz - 0.03, 0.1, 0.045, 0.025, -0.4);
  part(c, green, fx + 0.03, fy - 0.19, fz - 0.03, 0.09, 0.04, 0.025, 0.4);

  // Red eyes with sharp liner and a calm mouth.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.125, y: 1.085, z: 0.275, w: 0.155, h: 0.14, white: 0xfff8ec, iris: orange, pupil: 0x2a1117, outline: 0x211518 });
    c.push({ x: side * 0.125, y: 1.158, z: 0.29, sx: 0.18, sy: 0.02, sz: 0.012, color: black, rz: side * 0.16 });
  }
  part(c, 0x9b5a5a, 0, 0.99, 0.282, 0.03, 0.02, 0.012);
  part(c, 0x7a3a3e, 0, 0.965, 0.284, 0.07, 0.018, 0.012);

  return c;
}
function buildDitoshey(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const pink = 0xf3a7a7;
  const pinkLight = 0xf9c3bb;
  const pinkDark = 0xd98a91;
  const lavender = 0xb9afd9;
  const lavenderDark = 0x9587bb;
  const blueStreak = 0x9fb8df;
  const cream = 0xfff8ee;
  const skin = 0xffe9dd;
  const onesie = 0xcdbce6;
  const onesieDark = 0xa58fc8;
  const bone = 0xfffdf7;
  const green = 0x9fd36b;
  const pupil = 0x1e2a1e;
  const gold = 0xe9c46a;
  const heart = 0xe84f5b;

  // Onesie feet and legs with bone stripes.
  for (const side of [-1, 1]) {
    part(c, onesieDark, side * 0.15, 0, 0.02, 0.2, 0.09, 0.26);
    part(c, onesie, side * 0.15, 0.08, 0.0, 0.18, 0.34, 0.2);
    part(c, bone, side * 0.15, 0.12, 0.1, 0.055, 0.22, 0.015);
  }

  // Onesie body with a ribcage print and a red heart.
  part(c, onesie, 0, 0.4, 0.0, 0.48, 0.34, 0.36);
  part(c, onesieDark, 0, 0.38, 0.0, 0.5, 0.08, 0.37);
  part(c, cream, 0, 0.43, 0.185, 0.3, 0.28, 0.025);
  part(c, bone, 0, 0.45, 0.205, 0.05, 0.24, 0.02);
  for (const y of [0.44, 0.49, 0.54, 0.59]) {
    part(c, bone, 0, y, 0.21, 0.2, 0.02, 0.015);
  }
  part(c, heart, 0, 0.6, 0.215, 0.1, 0.09, 0.025);
  part(c, pinkLight, 0, 0.615, 0.23, 0.03, 0.03, 0.01);
  part(c, onesie, 0, 0.72, 0.0, 0.44, 0.18, 0.34);

  // Arms with bone stripes and little paws.
  for (const side of [-1, 1]) {
    part(c, onesie, side * 0.32, 0.4, 0.02, 0.14, 0.3, 0.22);
    part(c, bone, side * 0.32, 0.44, 0.13, 0.05, 0.24, 0.015);
    part(c, cream, side * 0.33, 0.34, 0.06, 0.15, 0.08, 0.18);
  }

  // Fluffy hood folded behind the neck.
  part(c, onesieDark, 0, 0.86, -0.11, 0.5, 0.3, 0.22);
  part(c, lavender, 0, 0.9, -0.25, 0.46, 0.26, 0.12);
  part(c, cream, 0, 0.92, -0.2, 0.4, 0.08, 0.06);

  // Head.
  part(c, skin, 0, 0.94, 0.09, 0.46, 0.36, 0.34);
  part(c, skin, 0, 0.9, 0.0, 0.16, 0.08, 0.16);

  // Long wavy hair: cap, crown, back mass and wavy hem.
  part(c, pink, 0, 1.02, -0.04, 0.56, 0.34, 0.46);
  part(c, pink, 0, 1.34, -0.06, 0.48, 0.08, 0.36);
  part(c, pink, 0, 0.42, -0.26, 0.5, 0.68, 0.12);
  part(c, pinkDark, 0, 0.42, -0.315, 0.44, 0.06, 0.03);
  part(c, lavender, -0.16, 0.34, -0.34, 0.14, 0.12, 0.06);
  part(c, lavender, 0.02, 0.32, -0.34, 0.13, 0.1, 0.06);
  part(c, pink, 0.18, 0.36, -0.34, 0.12, 0.1, 0.06);
  part(c, lavender, -0.06, 0.4, -0.335, 0.08, 0.1, 0.05);
  part(c, lavenderDark, 0.02, 0.42, -0.33, 0.02, 0.5, 0.012);
  part(c, pinkDark, -0.14, 0.5, -0.33, 0.03, 0.34, 0.012);
  part(c, blueStreak, 0.15, 0.55, -0.33, 0.03, 0.28, 0.012);

  // Side hair that fades to lavender near the tips.
  for (const side of [-1, 1]) {
    part(c, pink, side * 0.29, 0.5, -0.1, 0.1, 0.52, 0.32);
    part(c, lavender, side * 0.29, 0.42, -0.1, 0.1, 0.14, 0.3);
    part(c, pink, side * 0.24, 0.6, 0.29, 0.075, 0.68, 0.03);
    part(c, lavender, side * 0.245, 0.52, 0.295, 0.06, 0.14, 0.02);
    part(c, pinkLight, side * 0.34, 1.1, -0.02, 0.12, 0.2, 0.3);
  }

  // Side-swept bangs with a lock beside the left eye.
  part(c, pink, 0, 1.16, 0.28, 0.46, 0.16, 0.05);
  part(c, pink, -0.18, 1.16, 0.29, 0.15, 0.16, 0.05);
  part(c, pink, 0.03, 1.17, 0.295, 0.12, 0.14, 0.05);
  part(c, pinkLight, 0.17, 1.16, 0.285, 0.12, 0.15, 0.045);
  part(c, lavender, -0.1, 1.17, 0.31, 0.04, 0.12, 0.02);
  part(c, pinkDark, 0.2, 1.16, 0.29, 0.05, 0.12, 0.02);
  part(c, pink, -0.245, 1.1, 0.29, 0.05, 0.2, 0.03);

  // Four fox ears: two large upper and two smaller lower.
  for (const side of [-1, 1]) {
    part(c, pink, side * 0.2, 1.4, -0.02, 0.2, 0.1, 0.22);
    part(c, pink, side * 0.21, 1.49, -0.02, 0.16, 0.09, 0.18);
    part(c, pink, side * 0.22, 1.57, -0.02, 0.11, 0.08, 0.13);
    part(c, pinkLight, side * 0.22, 1.64, -0.02, 0.07, 0.07, 0.09);
    part(c, cream, side * 0.2, 1.415, 0.095, 0.11, 0.06, 0.04);
    part(c, cream, side * 0.21, 1.49, 0.08, 0.07, 0.05, 0.03);
    part(c, cream, side * 0.22, 1.56, 0.06, 0.04, 0.04, 0.025);
    part(c, pinkDark, side * 0.36, 1.14, -0.02, 0.14, 0.16, 0.14);
    part(c, pink, side * 0.37, 1.22, -0.02, 0.1, 0.12, 0.11);
    part(c, pinkLight, side * 0.38, 1.29, -0.02, 0.07, 0.07, 0.08);
    part(c, cream, side * 0.36, 1.16, 0.055, 0.07, 0.05, 0.03);
    part(c, cream, side * 0.37, 1.23, 0.045, 0.045, 0.04, 0.025);
  }

  // Half-lidded green eyes with thick lashes.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.125, y: 1.085, z: 0.275, w: 0.155, h: 0.14, white: 0xfff8ec, iris: green, pupil, outline: 0x2a2024 });
    part(c, skin, side * 0.125, 1.14, 0.288, 0.17, 0.03, 0.012);
    part(c, 0x2a2024, side * 0.125, 1.163, 0.292, 0.18, 0.014, 0.01);
    part(c, 0x2a2024, side * 0.21, 1.15, 0.292, 0.035, 0.022, 0.01);
    part(c, 0xf6b3b1, side * 0.19, 1.02, 0.268, 0.07, 0.026, 0.01);
  }
  part(c, 0xd89a94, 0, 0.99, 0.282, 0.03, 0.02, 0.012);
  part(c, 0x9b4e52, 0, 0.965, 0.284, 0.08, 0.02, 0.012);

  // Fluffy fox tail from the centre of the lower back.
  part(c, pink, 0, 0.42, -0.26, 0.16, 0.14, 0.15);
  part(c, pink, 0.12, 0.46, -0.33, 0.17, 0.14, 0.16);
  part(c, pinkLight, 0.25, 0.52, -0.35, 0.18, 0.15, 0.16);
  part(c, lavender, 0.37, 0.6, -0.33, 0.16, 0.14, 0.15);
  part(c, lavender, 0.47, 0.68, -0.29, 0.14, 0.13, 0.13);
  part(c, cream, 0.55, 0.76, -0.25, 0.1, 0.11, 0.1);

  return c;
}
function buildSquimeh(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const skin = 0xffe6d8;
  const skinShade = 0xf0cbb8;
  const brown = 0x5a3829;
  const brownDark = 0x3e241d;
  const brownLight = 0x7a4a33;
  const pink = 0xff7fae;
  const pinkLight = 0xffa7c8;
  const lilac = 0xcdb8e8;
  const lilacDark = 0xa78fc9;
  const lilacLight = 0xe4d7f4;
  const mint = 0xc8f1e4;
  const black = 0x1b1a22;
  const blackLight = 0x2c2a36;
  const white = 0xfff8ef;
  const silver = 0xd9d9e8;
  const cream = 0xfff6e8;

  // Purple Crocs, bare legs, one black thigh strap.
  for (const side of [-1, 1]) {
    part(c, lilacDark, side * 0.15, 0.02, 0.02, 0.21, 0.08, 0.3);
    part(c, lilac, side * 0.15, 0.08, 0.01, 0.19, 0.06, 0.27);
    for (const z of [-0.1, 0, 0.1]) {
      part(c, lilacDark, side * 0.15, 0.12, z, 0.07, 0.02, 0.035);
    }
    part(c, skin, side * 0.145, 0.12, 0.0, 0.145, 0.35, 0.16);
    part(c, skinShade, side * 0.145, 0.12, 0.09, 0.11, 0.27, 0.015);
  }
  for (const z of [-0.06, 0.02, 0.1]) {
    part(c, black, 0.145, 0.27, z, 0.17, 0.035, 0.035);
  }
  c.push({ x: 0.18, y: 0.3, z: 0.1, sx: 0.14, sy: 0.035, sz: 0.035, color: black, rz: 0.35 });
  c.push({ x: 0.11, y: 0.3, z: 0.1, sx: 0.13, sy: 0.035, sz: 0.035, color: black, rz: -0.35 });

  // Lavender dress with white ruffles and mint sash.
  part(c, lilacDark, 0, 0.4, 0.0, 0.52, 0.07, 0.38);
  part(c, lilac, 0, 0.44, 0.0, 0.5, 0.24, 0.36);
  part(c, lilacLight, 0, 0.4, 0.02, 0.48, 0.08, 0.34);
  for (const side of [-1, 1]) {
    for (const x of [0.14, 0.24]) {
      part(c, white, side * x, 0.36, 0.16, 0.12, 0.1, 0.02);
      part(c, white, side * x, 0.32, 0.16, 0.1, 0.06, 0.02);
    }
  }
  part(c, lilac, 0, 0.66, 0.0, 0.44, 0.28, 0.32);
  part(c, lilacLight, 0, 0.79, 0.17, 0.34, 0.08, 0.04);
  part(c, mint, 0, 0.62, 0.02, 0.46, 0.065, 0.34);
  part(c, white, 0, 0.8, 0.17, 0.18, 0.06, 0.025);
  for (const side of [-1, 1]) {
    part(c, white, side * 0.1, 0.79, 0.17, 0.06, 0.08, 0.02);
    part(c, mint, side * 0.18, 0.74, 0.17, 0.06, 0.05, 0.02);
  }

  // Oversized black jacket, white cuffs and lacing.
  for (const side of [-1, 1]) {
    part(c, black, side * 0.3, 0.55, 0.02, 0.17, 0.4, 0.34);
    part(c, blackLight, side * 0.34, 0.5, 0.08, 0.13, 0.12, 0.26);
    part(c, black, side * 0.35, 0.42, 0.02, 0.15, 0.16, 0.26);
    part(c, white, side * 0.35, 0.36, 0.04, 0.17, 0.06, 0.27);
    part(c, skin, side * 0.37, 0.31, 0.12, 0.12, 0.08, 0.14);
    for (let i = 0; i < 3; i++) {
      c.push({ x: side * (0.25 + i * 0.045), y: 0.62 + i * 0.07, z: 0.19, sx: 0.11, sy: 0.025, sz: 0.012, color: white, rz: side * 0.55 });
      c.push({ x: side * (0.27 + i * 0.045), y: 0.62 + i * 0.07, z: 0.19, sx: 0.11, sy: 0.025, sz: 0.012, color: white, rz: -side * 0.55 });
    }
    part(c, black, side * 0.19, 0.58, -0.08, 0.12, 0.34, 0.26);
  }
  part(c, black, 0, 0.57, -0.12, 0.5, 0.3, 0.16);

  // Neck and choker.
  part(c, skin, 0, 0.9, 0.0, 0.17, 0.12, 0.17);
  part(c, black, 0, 0.88, 0.0, 0.22, 0.045, 0.2);
  part(c, silver, 0, 0.87, 0.11, 0.055, 0.055, 0.02);
  part(c, silver, 0, 0.84, 0.11, 0.025, 0.045, 0.012);

  // Head, brown hair, pink inner streaks and buns.
  part(c, skin, 0, 0.94, 0.08, 0.46, 0.36, 0.32);
  part(c, brown, 0, 1.02, -0.05, 0.6, 0.46, 0.5);
  part(c, brownDark, 0, 0.96, -0.3, 0.55, 0.4, 0.1);
  for (const side of [-1, 1]) {
    part(c, brown, side * 0.32, 0.56, -0.01, 0.18, 0.6, 0.4);
    part(c, brownDark, side * 0.36, 0.54, 0.02, 0.12, 0.42, 0.3);
    part(c, brown, side * 0.4, 1.12, -0.06, 0.2, 0.2, 0.22);
    part(c, brownLight, side * 0.45, 1.18, -0.03, 0.12, 0.12, 0.15);
    part(c, pink, side * 0.19, 0.86, 0.255, 0.09, 0.35, 0.04);
    part(c, pinkLight, side * 0.22, 0.74, 0.25, 0.06, 0.22, 0.03);
  }
  // Bangs and side fringe.
  part(c, brown, 0, 1.12, 0.245, 0.5, 0.12, 0.055);
  part(c, brown, 0, 1.23, 0.245, 0.5, 0.08, 0.05);
  part(c, brownDark, -0.2, 1.08, 0.25, 0.14, 0.2, 0.05);
  part(c, brown, -0.1, 1.1, 0.255, 0.13, 0.17, 0.05);
  part(c, brown, 0.12, 1.1, 0.255, 0.12, 0.18, 0.05);
  part(c, pink, 0.22, 0.94, 0.255, 0.06, 0.2, 0.04);
  // White streak down the left side of the hair.
  part(c, white, -0.24, 0.86, 0.21, 0.05, 0.4, 0.02);
  part(c, 0xfff6e8, -0.245, 1.2, 0.2, 0.045, 0.1, 0.02);

  // Rectangular cat ears, raised above the hair so they read from the front.
  for (const side of [-1, 1]) {
    part(c, brown, side * 0.23, 1.45, 0.16, 0.2, 0.09, 0.16);
    part(c, brown, side * 0.235, 1.52, 0.14, 0.15, 0.08, 0.14);
    part(c, brown, side * 0.24, 1.58, 0.12, 0.1, 0.07, 0.1);
    part(c, cream, side * 0.23, 1.47, 0.225, 0.12, 0.06, 0.05);
    part(c, cream, side * 0.235, 1.53, 0.205, 0.08, 0.06, 0.04);
    part(c, pink, side * 0.24, 1.58, 0.18, 0.05, 0.04, 0.03);
  }
  // White criss-cross clips on the right.
  for (const rz of [-0.55, 0.55]) {
    c.push({ x: 0.2, y: 1.17, z: 0.275, sx: 0.18, sy: 0.035, sz: 0.02, color: white, rz });
  }

  // Simple violet block eyes and a small smile.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.125, y: 1.08, z: 0.275, w: 0.145, h: 0.127, white: 0xfff8ec, iris: 0x8b5fbf, pupil: 0x23152f, outline: 0x34213a });
  }
  part(c, 0xd89a94, 0, 0.985, 0.286, 0.035, 0.022, 0.012);
  part(c, 0x9b4e52, 0, 0.955, 0.286, 0.075, 0.02, 0.012);

  // Rear hair locks and a second cat-ear plane for side/back views.
  part(c, 0x5a3829, -0.22, 0.5, -0.22, 0.12, 0.28, 0.06);
  part(c, 0x5a3829, 0.22, 0.5, -0.22, 0.12, 0.28, 0.06);
  part(c, 0x3e241d, 0, 0.4, -0.2, 0.3, 0.16, 0.05);
  for (const side of [-1, 1]) {
    part(c, 0x5a3829, side * 0.28, 1.32, -0.16, 0.12, 0.12, 0.08);
    part(c, 0xfff6e8, side * 0.28, 1.33, -0.1, 0.06, 0.06, 0.03);
  }

  return c;
}

function buildSnezha(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const skin = 0xffe6d8;
  const skinShade = 0xf0cbb8;
  const blue = 0x263a9e;
  const blueDark = 0x1a2864;
  const blueLight = 0x5d7de0;
  const blueMid = 0x304fc4;
  const black = 0x171724;
  const blackLight = 0x29273b;
  const white = 0xfff8ef;
  const gold = 0xf3c44f;
  const amber = 0xffa12e;

  // White shoes and blue thigh-high stockings.
  for (const side of [-1, 1]) {
    part(c, blueDark, side * 0.15, 0.0, 0.02, 0.2, 0.07, 0.28);
    part(c, white, side * 0.15, 0.07, 0.02, 0.18, 0.06, 0.25);
    part(c, blue, side * 0.145, 0.13, 0.0, 0.15, 0.34, 0.16);
    part(c, blueLight, side * 0.145, 0.16, 0.09, 0.11, 0.22, 0.015);
    part(c, white, side * 0.145, 0.45, 0.0, 0.15, 0.035, 0.17);
    part(c, gold, side * 0.17, 0.36, 0.09, 0.03, 0.03, 0.015);
  }

  // Black/blue star skirt, white ruffles and white blouse.
  part(c, black, 0, 0.42, 0.0, 0.52, 0.1, 0.38);
  part(c, blackLight, 0, 0.49, 0.0, 0.5, 0.2, 0.36);
  part(c, blueDark, 0, 0.45, 0.02, 0.5, 0.08, 0.34);
  for (const side of [-1, 1]) {
    for (const x of [0.14, 0.25]) {
      part(c, white, side * x, 0.37, 0.16, 0.13, 0.12, 0.02);
      part(c, white, side * x, 0.34, 0.16, 0.1, 0.07, 0.02);
    }
  }
  for (const [x, z] of [[-0.17, 0.18], [0.02, 0.2], [0.18, 0.18], [-0.05, 0.2]]) {
    part(c, gold, x, 0.53, z, 0.035, 0.035, 0.012);
  }
  part(c, white, 0, 0.64, 0.0, 0.44, 0.24, 0.32);
  part(c, white, 0, 0.78, 0.17, 0.34, 0.08, 0.035);
  part(c, black, 0, 0.66, 0.02, 0.38, 0.1, 0.33);
  for (let i = 0; i < 4; i++) {
    c.push({ x: 0, y: 0.68 + i * 0.035, z: 0.19, sx: 0.12, sy: 0.018, sz: 0.012, color: white, rz: 0.65 });
    c.push({ x: 0, y: 0.68 + i * 0.035, z: 0.19, sx: 0.12, sy: 0.018, sz: 0.012, color: white, rz: -0.65 });
  }

  // Black fur shawl and blue sleeves.
  part(c, black, 0, 0.77, -0.08, 0.54, 0.24, 0.3);
  for (const side of [-1, 1]) {
    part(c, black, side * 0.29, 0.62, 0.0, 0.16, 0.36, 0.3);
    part(c, blackLight, side * 0.32, 0.52, 0.05, 0.13, 0.16, 0.24);
    part(c, white, side * 0.31, 0.46, 0.04, 0.15, 0.055, 0.25);
    part(c, skin, side * 0.33, 0.4, 0.1, 0.11, 0.08, 0.13);
    for (const i of [-1, 0, 1]) {
      part(c, blueMid, side * 0.25, 0.82 + i * 0.05, 0.1, 0.09, 0.13, 0.12);
    }
  }

  // Choker with a gold bell.
  part(c, skin, 0, 0.9, 0.0, 0.17, 0.12, 0.17);
  part(c, black, 0, 0.88, 0.0, 0.22, 0.045, 0.2);
  part(c, gold, 0, 0.84, 0.12, 0.08, 0.08, 0.035);
  part(c, white, 0, 0.78, 0.13, 0.14, 0.08, 0.025);
  part(c, white, -0.04, 0.72, 0.13, 0.055, 0.1, 0.02);
  part(c, white, 0.04, 0.72, 0.13, 0.055, 0.1, 0.02);

  // Head: the face plane stays open, hair only frames it.
  part(c, skin, 0, 0.94, 0.09, 0.46, 0.36, 0.34);

  // Hair cap: three stepped tiers, with a flush forehead mass above the fringe.
  part(c, blue, 0, 1.04, -0.03, 0.6, 0.18, 0.46);
  part(c, blue, 0, 1.2, -0.05, 0.56, 0.14, 0.44);
  part(c, blue, 0, 1.32, -0.07, 0.5, 0.12, 0.38);
  part(c, blue, 0, 1.24, 0.235, 0.46, 0.18, 0.05);
  for (const x of [-0.14, 0.11]) {
    part(c, x < 0 ? blueLight : blueDark, x, 1.27, 0.263, x < 0 ? 0.04 : 0.05, 0.1, 0.008);
  }
  part(c, blue, 0, 0.48, -0.26, 0.54, 0.62, 0.12);
  part(c, blue, 0, 0.34, -0.245, 0.44, 0.16, 0.1);
  part(c, blueDark, -0.16, 0.24, -0.33, 0.13, 0.12, 0.05);
  part(c, blueDark, 0.0, 0.22, -0.33, 0.12, 0.1, 0.05);
  part(c, blue, 0.17, 0.26, -0.33, 0.12, 0.11, 0.05);
  part(c, blueLight, -0.08, 0.5, -0.325, 0.035, 0.42, 0.02);
  part(c, blueLight, 0.12, 0.56, -0.325, 0.03, 0.34, 0.02);
  part(c, blueDark, 0.0, 0.44, -0.328, 0.02, 0.56, 0.012);
  part(c, 0xfff8ef, -0.17, 0.62, -0.33, 0.09, 0.4, 0.02);

  // Side sheets stay narrow so the arms read from the side; volume sits above them.
  for (const side of [-1, 1]) {
    part(c, blue, side * 0.27, 0.46, -0.12, 0.08, 0.78, 0.34);
    part(c, blueDark, side * 0.275, 0.5, -0.11, 0.05, 0.34, 0.26);
    part(c, blue, side * 0.39, 1.08, -0.06, 0.15, 0.3, 0.3);
    part(c, blue, side * 0.325, 0.8, -0.06, 0.05, 0.3, 0.16);
    part(c, blueLight, side * 0.365, 0.72, -0.02, 0.02, 0.28, 0.07);
    part(c, blue, side * 0.24, 0.6, 0.29, 0.075, 0.66, 0.03);
    part(c, blue, side * 0.265, 0.66, 0.19, 0.09, 0.34, 0.06);
  }

  // Jagged fringe: separate swept locks of different lengths, pupils kept clear.
  part(c, blue, -0.21, 1.13, 0.277, 0.14, 0.17, 0.05);
  part(c, blue, -0.075, 1.16, 0.285, 0.12, 0.14, 0.05);
  part(c, blue, 0.045, 1.14, 0.29, 0.11, 0.16, 0.05);
  part(c, blue, 0.155, 1.155, 0.285, 0.13, 0.145, 0.05);
  part(c, blue, 0.25, 1.13, 0.272, 0.08, 0.17, 0.045);
  part(c, blueDark, 0.05, 1.135, 0.305, 0.09, 0.05, 0.02);
  part(c, blueLight, -0.1, 1.16, 0.292, 0.03, 0.12, 0.02);
  part(c, blue, 0, 1.24, 0.268, 0.5, 0.1, 0.03);

  // Silver streak threaded through the right front lock, plus small gold stars.
  part(c, white, 0.235, 0.66, 0.31, 0.03, 0.54, 0.015);
  part(c, white, 0.24, 1.2, 0.215, 0.035, 0.2, 0.015);
  part(c, gold, 0.16, 1.33, 0.24, 0.045, 0.045, 0.02);
  part(c, gold, -0.22, 1.28, 0.24, 0.04, 0.04, 0.018);
  part(c, white, 0.21, 1.18, -0.33, 0.07, 0.13, 0.02);
  part(c, white, 0.3, 1.2, -0.33, 0.07, 0.15, 0.02);
  part(c, white, 0.255, 1.28, -0.335, 0.055, 0.06, 0.03);
  part(c, gold, -0.16, 1.22, -0.33, 0.05, 0.05, 0.02);

  // Chained braid resting on the left shoulder lock, tied with a white ribbon.
  for (let i = 0; i < 4; i++) {
    const bx = i % 2 === 0 ? -0.302 : -0.288;
    part(c, i % 2 === 0 ? blueMid : blueLight, bx, 1.0 - i * 0.095, 0.19, 0.085, 0.085, 0.085);
  }
  part(c, white, -0.295, 0.6, 0.205, 0.095, 0.045, 0.07);
  part(c, white, -0.295, 0.55, 0.205, 0.03, 0.07, 0.03);

  // Cat ears: four stepped tiers each, deep enough to read from behind.
  for (const side of [-1, 1]) {
    part(c, blue, side * 0.175, 1.42, 0.0, 0.22, 0.08, 0.26);
    part(c, blue, side * 0.18, 1.49, -0.005, 0.18, 0.08, 0.21);
    part(c, blue, side * 0.185, 1.56, -0.01, 0.13, 0.07, 0.16);
    part(c, blueDark, side * 0.19, 1.62, -0.015, 0.08, 0.07, 0.11);
    part(c, blueDark, side * 0.272, 1.45, 0.0, 0.05, 0.18, 0.14);
    part(c, white, side * 0.175, 1.44, 0.12, 0.09, 0.05, 0.035);
    part(c, white, side * 0.18, 1.5, 0.105, 0.055, 0.04, 0.03);
    part(c, white, side * 0.185, 1.555, 0.088, 0.025, 0.03, 0.025);
  }

  // Long fluffy tail: rooted at the centre of the lower back, curling up.
  const tail: Array<[number, number, number, number]> = [
    [0.0, 0.4, -0.24, 0.2],
    [-0.15, 0.43, -0.33, 0.18],
    [-0.31, 0.49, -0.37, 0.17],
    [-0.45, 0.57, -0.36, 0.16],
    [-0.56, 0.67, -0.32, 0.14],
    [-0.63, 0.79, -0.26, 0.12],
    [-0.66, 0.91, -0.2, 0.1]
  ];
  for (const [x, y, tz, tw] of tail) {
    part(c, blue, x, y, tz, tw, 0.13, tw);
  }
  part(c, blueDark, -0.15, 0.51, -0.32, 0.09, 0.07, 0.09);
  part(c, blueDark, -0.51, 0.64, -0.31, 0.08, 0.06, 0.08);
  part(c, blueLight, -0.63, 0.75, -0.245, 0.05, 0.1, 0.04);
  part(c, blueLight, -0.66, 1.03, -0.195, 0.09, 0.1, 0.09);
  part(c, gold, -0.7, 0.84, -0.14, 0.075, 0.075, 0.04);
  part(c, white, -0.7, 0.76, -0.14, 0.1, 0.055, 0.025);

  // Large amber eyes behind the fringe, blush, tiny fang.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.125, y: 1.075, z: 0.275, w: 0.155, h: 0.145, white: 0xfff8ec, iris: amber, pupil: 0x24140f, outline: 0x2a1b16 });
    part(c, 0xf3b6ad, side * 0.19, 0.995, 0.268, 0.07, 0.026, 0.01);
  }
  part(c, 0xd89a94, 0, 0.985, 0.282, 0.03, 0.02, 0.012);
  part(c, 0x9b4e52, 0, 0.955, 0.284, 0.08, 0.02, 0.012);
  part(c, 0xffffff, 0.048, 0.942, 0.288, 0.022, 0.03, 0.008);

  return c;
}

function buildMeowlody(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const skin = 0xffe6d8;
  const skinShade = 0xf0cbb8;
  const pink = 0xff8fae;
  const pinkLight = 0xffc0d2;
  const pinkDark = 0xd96f90;
  const black = 0x17151d;
  const blackLight = 0x292534;
  const white = 0xfff8ef;
  const silver = 0xc9c7d4;
  const blue = 0x55b8ff;

  // Black boots, white socks, black tights.
  for (const side of [-1, 1]) {
    part(c, black, side * 0.145, 0.02, 0.03, 0.18, 0.09, 0.27);
    part(c, white, side * 0.145, 0.1, 0.0, 0.16, 0.06, 0.24);
    part(c, blackLight, side * 0.145, 0.16, 0.0, 0.14, 0.14, 0.18);
    for (const z of [-0.07, 0.0, 0.07]) {
      c.push({ x: side * 0.145, y: 0.22, z: z + 0.1, sx: 0.12, sy: 0.018, sz: 0.012, color: white, rz: side * 0.55 });
    }
    part(c, black, side * 0.145, 0.25, 0.0, 0.135, 0.3, 0.15);
  }
  // Pink bag.
  part(c, pink, -0.37, 0.52, 0.18, 0.2, 0.18, 0.1);
  part(c, pinkDark, -0.37, 0.52, 0.24, 0.15, 0.12, 0.02);
  part(c, silver, -0.37, 0.64, 0.18, 0.07, 0.12, 0.03);

  // White pleated skirt with black corset dress.
  part(c, black, 0, 0.42, 0.0, 0.54, 0.09, 0.4);
  part(c, white, 0, 0.44, 0.02, 0.52, 0.1, 0.36);
  for (const side of [-1, 1]) {
    part(c, white, side * 0.24, 0.46, 0.2, 0.1, 0.2, 0.02);
  }
  part(c, black, 0, 0.52, 0.0, 0.5, 0.2, 0.36);
  part(c, blackLight, 0, 0.58, 0.03, 0.46, 0.22, 0.32);
  part(c, black, 0, 0.66, 0.01, 0.4, 0.22, 0.3);
  part(c, white, 0, 0.73, 0.0, 0.44, 0.24, 0.32);
  part(c, black, 0, 0.72, 0.02, 0.36, 0.2, 0.31);
  part(c, blackLight, 0, 0.8, 0.0, 0.3, 0.1, 0.28);
  // Silver chain across the bodice.
  for (let i = 0; i < 7; i++) {
    c.push({ x: -0.15 + i * 0.05, y: 0.56 + i * 0.035, z: 0.2, sx: 0.055, sy: 0.035, sz: 0.02, color: silver, rz: -0.35 });
  }

  // White sleeves with pink lacing and black shoulder straps.
  for (const side of [-1, 1]) {
    part(c, white, side * 0.29, 0.52, 0.0, 0.15, 0.36, 0.25);
    part(c, white, side * 0.32, 0.43, 0.08, 0.13, 0.12, 0.16);
    part(c, skin, side * 0.34, 0.38, 0.14, 0.11, 0.08, 0.13);
    part(c, black, side * 0.2, 0.67, 0.02, 0.06, 0.22, 0.24);
    for (let i = 0; i < 3; i++) {
      c.push({ x: side * 0.3, y: 0.48 + i * 0.075, z: 0.14, sx: 0.1, sy: 0.02, sz: 0.012, color: pink, rz: side * 0.6 });
      c.push({ x: side * 0.3, y: 0.48 + i * 0.075, z: 0.14, sx: 0.1, sy: 0.02, sz: 0.012, color: pink, rz: -side * 0.6 });
    }
  }

  // Neck, choker and necklace.
  part(c, skin, 0, 0.9, 0.0, 0.17, 0.12, 0.17);
  part(c, black, 0, 0.88, 0.0, 0.22, 0.045, 0.2);
  part(c, silver, 0, 0.83, 0.11, 0.04, 0.05, 0.02);

  // Head, round pink bob, side buns and a lace headband.
  part(c, skin, 0, 0.94, 0.09, 0.46, 0.36, 0.34);
  part(c, pink, 0, 1.02, -0.03, 0.56, 0.34, 0.46);
  part(c, pink, 0, 1.34, -0.05, 0.48, 0.08, 0.38);
  part(c, pink, 0, 1.24, 0.225, 0.44, 0.18, 0.05);

  // Bob: jaw-length back and sides that curl in at the bottom.
  part(c, pink, 0, 0.86, -0.27, 0.54, 0.48, 0.12);
  part(c, pinkDark, 0, 0.86, -0.34, 0.46, 0.06, 0.03);
  for (const side of [-1, 1]) {
    part(c, pink, side * 0.3, 0.88, -0.12, 0.1, 0.42, 0.34);
    part(c, pinkDark, side * 0.305, 0.88, -0.05, 0.07, 0.2, 0.25);
    part(c, pink, side * 0.255, 0.82, 0.0, 0.09, 0.1, 0.24);
  }
  part(c, pinkDark, 0, 0.9, -0.332, 0.02, 0.4, 0.012);
  part(c, pinkLight, -0.14, 0.94, -0.33, 0.04, 0.26, 0.012);
  part(c, pinkLight, 0.18, 1.0, -0.33, 0.035, 0.2, 0.012);

  // Stepped fringe, one short strand over the left eye corner.
  part(c, pink, 0, 1.245, 0.245, 0.46, 0.12, 0.04);
  part(c, pink, -0.2, 1.165, 0.278, 0.16, 0.135, 0.05);
  part(c, pink, -0.06, 1.18, 0.285, 0.13, 0.12, 0.05);
  part(c, pink, 0.07, 1.16, 0.29, 0.12, 0.14, 0.05);
  part(c, pink, 0.2, 1.17, 0.282, 0.12, 0.13, 0.05);
  part(c, pink, -0.215, 1.12, 0.27, 0.06, 0.2, 0.04);
  part(c, pinkLight, 0.02, 1.18, 0.295, 0.03, 0.12, 0.02);
  part(c, pinkDark, 0.16, 1.165, 0.3, 0.07, 0.05, 0.02);

  // White lace headband over the crown, with a small bow at the back.
  part(c, white, 0, 1.4, 0.02, 0.42, 0.035, 0.09);
  part(c, white, 0, 1.35, 0.17, 0.4, 0.055, 0.06);
  for (const side of [-1, 1]) {
    part(c, white, side * 0.225, 1.3, 0.19, 0.05, 0.1, 0.05);
    part(c, white, side * 0.13, 1.345, 0.205, 0.05, 0.028, 0.02);
  }
  part(c, white, 0.12, 1.29, -0.35, 0.08, 0.06, 0.02);
  part(c, white, 0.21, 1.31, -0.35, 0.05, 0.08, 0.02);

  // Two rounded side buns with tiny bows.
  for (const side of [-1, 1]) {
    part(c, pink, side * 0.345, 1.24, -0.02, 0.13, 0.13, 0.13);
    part(c, pink, side * 0.405, 1.25, -0.02, 0.08, 0.09, 0.09);
    part(c, pink, side * 0.345, 1.31, -0.02, 0.09, 0.08, 0.09);
    part(c, pink, side * 0.345, 1.17, -0.02, 0.09, 0.08, 0.09);
    part(c, pinkLight, side * 0.39, 1.28, 0.03, 0.07, 0.07, 0.06);
    part(c, pinkDark, side * 0.3, 1.22, -0.04, 0.07, 0.07, 0.07);
    part(c, pinkDark, side * 0.28, 1.31, 0.11, 0.06, 0.05, 0.04);
    part(c, pinkDark, side * 0.34, 1.35, 0.09, 0.05, 0.05, 0.04);
  }

  // Large blue block eyes, blush and a gentle smile.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.125, y: 1.085, z: 0.275, w: 0.155, h: 0.14, white: 0xfff8ec, iris: blue, pupil: 0x14243a, outline: 0x2a2430 });
    part(c, 0xf6b3b1, side * 0.19, 1.0, 0.268, 0.07, 0.026, 0.01);
  }
  part(c, 0xd89a94, 0, 1.0, 0.282, 0.03, 0.02, 0.012);
  part(c, 0x9b4e52, 0, 0.972, 0.284, 0.08, 0.02, 0.012);

  return c;
}

function buildMiliray(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const skin = 0xffe6d8;
  const skinShade = 0xf0cbb8;
  const white = 0xfff8ef;
  const hair = 0xf1eef4;
  const hairShade = 0xd9d5df;
  const black = 0x151318;
  const blackLight = 0x282430;
  const red = 0xb8202f;
  const redLight = 0xe1494e;
  const silver = 0xd8d5de;

  // Platform shoes, black stockings and white lace garters.
  for (const side of [-1, 1]) {
    part(c, black, side * 0.15, 0.0, 0.02, 0.21, 0.08, 0.3);
    part(c, blackLight, side * 0.15, 0.08, 0.0, 0.18, 0.08, 0.26);
    part(c, red, side * 0.15, 0.13, 0.14, 0.1, 0.03, 0.04);
    part(c, black, side * 0.145, 0.16, 0.0, 0.15, 0.36, 0.16);
    part(c, white, side * 0.145, 0.47, 0.0, 0.16, 0.055, 0.18);
    part(c, hairShade, side * 0.145, 0.43, 0.09, 0.12, 0.08, 0.02);
  }

  // Black-and-red gothic skirt and coat tails.
  part(c, black, 0, 0.42, 0.0, 0.52, 0.1, 0.4);
  part(c, blackLight, 0, 0.49, 0.0, 0.5, 0.2, 0.38);
  part(c, white, 0, 0.38, 0.01, 0.5, 0.08, 0.36);
  for (const side of [-1, 1]) {
    part(c, black, side * 0.37, 0.34, -0.02, 0.14, 0.44, 0.28);
    part(c, red, side * 0.3, 0.3, 0.0, 0.06, 0.48, 0.24);
    part(c, redLight, side * 0.31, 0.36, 0.13, 0.03, 0.16, 0.02);
    part(c, red, side * 0.37, 0.3, 0.02, 0.14, 0.04, 0.26);
    part(c, black, side * 0.3, 0.32, 0.18, 0.12, 0.16, 0.06);
  }
  part(c, white, 0, 0.6, 0.0, 0.44, 0.2, 0.32);
  part(c, black, 0, 0.72, 0.01, 0.4, 0.2, 0.32);
  part(c, red, 0, 0.66, 0.17, 0.2, 0.14, 0.04);
  part(c, white, 0, 0.78, 0.18, 0.3, 0.08, 0.035);
  part(c, black, 0, 0.82, 0.03, 0.32, 0.1, 0.3);

  // Off-shoulder puffy black sleeves with white frills.
  for (const side of [-1, 1]) {
    part(c, black, side * 0.29, 0.6, 0.0, 0.17, 0.3, 0.27);
    part(c, blackLight, side * 0.33, 0.51, 0.04, 0.14, 0.14, 0.22);
    part(c, white, side * 0.34, 0.45, 0.04, 0.13, 0.05, 0.22);
    part(c, skin, side * 0.33, 0.4, 0.09, 0.11, 0.08, 0.12);
    part(c, white, side * 0.27, 0.7, -0.02, 0.13, 0.16, 0.28);
    part(c, red, side * 0.3, 0.66, 0.15, 0.1, 0.1, 0.02);
  }
  // Cross choker.
  part(c, skin, 0, 0.9, 0.0, 0.17, 0.12, 0.17);
  part(c, black, 0, 0.88, 0.0, 0.22, 0.04, 0.2);
  part(c, silver, 0, 0.84, 0.11, 0.035, 0.12, 0.02);
  part(c, silver, 0, 0.86, 0.112, 0.08, 0.025, 0.018);

  // Long white hair: cap, blunt fringe, side locks and a braid.
  part(c, skin, 0, 0.94, 0.09, 0.46, 0.36, 0.34);
  part(c, hair, 0, 1.04, -0.04, 0.6, 0.4, 0.48);
  part(c, hair, 0, 1.42, -0.06, 0.5, 0.07, 0.38);
  part(c, hair, 0, 1.24, 0.235, 0.46, 0.18, 0.05);
  for (const x of [-0.15, -0.02, 0.12]) {
    part(c, hairShade, x, 1.26, 0.263, 0.02, 0.15, 0.01);
  }

  // Back mass down to the hips, with a jagged hem and grey strand lines.
  part(c, hair, 0, 0.42, -0.27, 0.52, 0.66, 0.12);
  part(c, hair, 0, 0.28, -0.28, 0.46, 0.16, 0.1);
  part(c, hairShade, -0.15, 0.24, -0.335, 0.12, 0.1, 0.02);
  part(c, hairShade, 0.03, 0.22, -0.335, 0.11, 0.08, 0.02);
  part(c, hair, 0.17, 0.26, -0.335, 0.1, 0.09, 0.02);
  part(c, hairShade, 0, 0.5, -0.335, 0.02, 0.5, 0.012);
  part(c, hairShade, -0.15, 0.55, -0.335, 0.035, 0.35, 0.012);
  part(c, hairShade, 0.16, 0.6, -0.335, 0.03, 0.3, 0.012);
  part(c, hairShade, 0, 0.42, -0.333, 0.48, 0.05, 0.012);

  // Narrow side sheets keep the arms visible; volume sits above them.
  for (const side of [-1, 1]) {
    part(c, hair, side * 0.28, 0.42, -0.1, 0.09, 0.84, 0.34);
    part(c, hairShade, side * 0.288, 0.42, -0.1, 0.04, 0.42, 0.26);
    part(c, hair, side * 0.38, 1.06, -0.06, 0.14, 0.3, 0.3);
    part(c, hair, side * 0.24, 0.6, 0.29, 0.08, 0.66, 0.03);
    part(c, hairShade, side * 0.245, 0.6, 0.305, 0.03, 0.4, 0.012);
  }

  // Blunt straight fringe with a grey edge and strand notches.
  part(c, hair, 0, 1.185, 0.27, 0.48, 0.15, 0.05);
  part(c, hairShade, 0, 1.183, 0.298, 0.45, 0.016, 0.01);
  for (const x of [-0.16, -0.05, 0.07, 0.17]) {
    part(c, hairShade, x, 1.195, 0.298, 0.012, 0.13, 0.008);
  }
  for (const side of [-1, 1]) {
    part(c, hair, side * 0.225, 0.72, 0.295, 0.06, 0.58, 0.03);
  }

  // Braid on the right front lock, alternating grey links.
  for (let i = 0; i < 4; i++) {
    part(c, i % 2 === 0 ? hairShade : hair, 0.255, 1.04 - i * 0.085, 0.315, 0.07, 0.075, 0.05);
  }
  part(c, hairShade, 0.255, 0.68, 0.315, 0.08, 0.035, 0.055);

  // White cat ears with pink inner fur, four stepped tiers.
  for (const side of [-1, 1]) {
    part(c, hair, side * 0.195, 1.4, 0.0, 0.2, 0.08, 0.26);
    part(c, hair, side * 0.2, 1.47, 0.0, 0.16, 0.08, 0.21);
    part(c, hair, side * 0.205, 1.54, 0.0, 0.11, 0.07, 0.16);
    part(c, hairShade, side * 0.21, 1.6, 0.0, 0.07, 0.07, 0.11);
    part(c, hairShade, side * 0.292, 1.43, 0.0, 0.04, 0.16, 0.12);
    part(c, 0xffc5d8, side * 0.195, 1.415, 0.115, 0.1, 0.05, 0.035);
    part(c, 0xffc5d8, side * 0.2, 1.48, 0.1, 0.06, 0.04, 0.03);
    part(c, 0xffc5d8, side * 0.205, 1.55, 0.08, 0.03, 0.03, 0.025);
  }

  // Small black gothic crown, sitting on the crown of the head.
  part(c, black, 0, 1.42, 0.1, 0.22, 0.055, 0.14);
  part(c, black, 0, 1.42, -0.12, 0.2, 0.05, 0.1);
  for (const x of [-0.075, 0, 0.075]) {
    part(c, black, x, 1.47, 0.1, 0.035, 0.09, 0.06);
    part(c, black, x, 1.55, 0.1, 0.022, 0.05, 0.04);
  }
  part(c, red, 0, 1.43, 0.175, 0.03, 0.03, 0.02);
  part(c, silver, 0, 1.425, 0.172, 0.18, 0.01, 0.008);

  // Red eyes behind thin black round glasses.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.125, y: 1.085, z: 0.275, w: 0.155, h: 0.14, white: 0xfff8ec, iris: 0xd93545, pupil: 0x240d12, outline: 0x2a1b16 });
    const cx = side * 0.125;
    part(c, black, cx, 1.168, 0.3, 0.175, 0.014, 0.012);
    part(c, black, cx, 0.998, 0.3, 0.17, 0.014, 0.012);
    part(c, black, cx - 0.086, 1.005, 0.3, 0.014, 0.17, 0.012);
    part(c, black, cx + 0.086, 1.005, 0.3, 0.014, 0.17, 0.012);
    part(c, black, side * 0.215, 1.135, 0.18, 0.012, 0.012, 0.24);
  }
  part(c, black, 0, 1.16, 0.3, 0.07, 0.014, 0.012);
  part(c, 0xf6b3b1, 0, 1.085, 0.296, 0.055, 0.018, 0.008);

  // White bunny plush with red eyes.
  part(c, hairShade, 0.3, 0.64, 0.2, 0.28, 0.04, 0.14);
  part(c, white, 0.3, 0.66, 0.2, 0.28, 0.18, 0.14);
  part(c, white, 0.3, 0.78, 0.18, 0.22, 0.16, 0.13);
  part(c, 0xffc5d8, 0.3, 0.68, 0.27, 0.1, 0.08, 0.02);
  for (const ex of [-0.05, 0.05]) {
    part(c, 0xd93545, 0.3 + ex, 0.79, 0.245, 0.035, 0.035, 0.015);
  }
  part(c, white, 0.22, 0.88, 0.18, 0.07, 0.13, 0.07);
  part(c, white, 0.38, 0.88, 0.18, 0.07, 0.13, 0.07);
  part(c, 0xffc5d8, 0.22, 0.88, 0.22, 0.04, 0.09, 0.03);
  part(c, 0xffc5d8, 0.38, 0.88, 0.22, 0.04, 0.09, 0.03);

  // Simple red block eyes, nose and a small smile.
  part(c, 0xd89a94, 0, 0.985, 0.286, 0.035, 0.022, 0.012);
  part(c, 0x9b4e52, 0, 0.955, 0.286, 0.075, 0.02, 0.012);
  part(c, 0xffffff, 0.02, 0.945, 0.288, 0.018, 0.022, 0.008);

  return c;
}

function buildYuchii(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const skin = 0xffe6d8;
  const skinShade = 0xf0cbb8;
  const white = 0xfff8ef;
  const teal = 0x3fa3a5;
  const tealDark = 0x267779;
  const orange = 0xf28a2e;
  const red = 0xef4c3a;
  const yellow = 0xf5c542;
  const black = 0x17110e;

  // Simple cartoon legs and white sandals.
  for (const side of [-1, 1]) {
    part(c, skin, side * 0.13, 0.08, 0.0, 0.11, 0.42, 0.12);
    part(c, white, side * 0.13, 0.02, 0.03, 0.18, 0.08, 0.25);
    part(c, teal, side * 0.13, 0.1, 0.03, 0.14, 0.035, 0.21);
    part(c, skinShade, side * 0.13, 0.1, 0.07, 0.08, 0.28, 0.02);
  }
  // White skirt with teal side panel and orange sun belt.
  part(c, white, 0, 0.4, 0.0, 0.5, 0.28, 0.36);
  part(c, teal, 0, 0.38, 0.18, 0.36, 0.09, 0.035);
  part(c, teal, 0, 0.52, 0.2, 0.3, 0.08, 0.03);
  part(c, orange, 0, 0.58, 0.02, 0.5, 0.06, 0.36);
  part(c, orange, 0, 0.5, 0.21, 0.16, 0.14, 0.05);
  part(c, yellow, 0, 0.5, 0.24, 0.1, 0.09, 0.025);
  part(c, teal, 0, 0.35, 0.02, 0.42, 0.08, 0.35);

  // White crop top with teal band and shell clasp.
  part(c, white, 0, 0.68, 0.0, 0.4, 0.16, 0.3);
  part(c, teal, 0, 0.69, 0.02, 0.44, 0.07, 0.32);
  part(c, orange, 0, 0.76, 0.18, 0.1, 0.08, 0.035);
  part(c, yellow, 0, 0.72, 0.19, 0.06, 0.05, 0.02);
  part(c, skin, 0, 0.78, 0.0, 0.18, 0.14, 0.18);
  for (const side of [-1, 1]) {
    part(c, skin, side * 0.3, 0.65, 0.05, 0.07, 0.3, 0.09);
    part(c, white, side * 0.3, 0.82, 0.04, 0.1, 0.06, 0.12);
    // Teal fairy wings attached to the shoulder blades.
    part(c, teal, side * 0.28, 0.63, -0.16, 0.14, 0.2, 0.04);
    part(c, tealDark, side * 0.33, 0.55, -0.17, 0.1, 0.12, 0.03);
    part(c, 0x86c4ee, side * 0.26, 0.79, -0.17, 0.1, 0.06, 0.025);
  }

  // Head: striped hair panels, side ponytail and a straw hat that sits high.
  part(c, skin, 0, 0.92, 0.09, 0.5, 0.36, 0.36);
  part(c, yellow, 0, 1.02, -0.04, 0.56, 0.32, 0.44);
  part(c, yellow, 0, 1.32, -0.05, 0.48, 0.04, 0.36);
  part(c, yellow, 0, 0.98, -0.25, 0.5, 0.32, 0.12);
  for (const [sx, color] of [[-0.14, red], [0.0, orange], [0.14, yellow]] as Array<[number, number]>) {
    part(c, color, sx, 1.0, -0.315, 0.06, 0.28, 0.02);
  }

  // Bold bang panels, in front of the dot eyes, with a jagged colour split.
  part(c, red, -0.17, 1.13, 0.32, 0.18, 0.19, 0.03);
  part(c, orange, -0.01, 1.14, 0.32, 0.14, 0.18, 0.03);
  part(c, yellow, 0.14, 1.13, 0.32, 0.16, 0.19, 0.03);
  part(c, red, 0.25, 1.16, 0.305, 0.06, 0.16, 0.025);
  part(c, orange, -0.28, 1.16, 0.305, 0.06, 0.16, 0.025);
  for (const side of [-1, 1]) {
    part(c, yellow, side * 0.27, 0.98, 0.3, 0.06, 0.24, 0.03);
    part(c, side < 0 ? red : orange, side * 0.27, 0.98, 0.316, 0.035, 0.2, 0.012);
    part(c, side < 0 ? orange : red, side * 0.302, 1.0, -0.02, 0.012, 0.22, 0.12);
    part(c, yellow, side * 0.29, 0.96, -0.1, 0.05, 0.26, 0.2);
  }

  // Long yellow side ponytail, segmented and tapered, with a red tie.
  part(c, red, -0.3, 1.14, 0.0, 0.1, 0.09, 0.1);
  part(c, yellow, -0.34, 1.12, -0.02, 0.14, 0.1, 0.13);
  part(c, yellow, -0.4, 1.0, -0.06, 0.13, 0.1, 0.12);
  part(c, yellow, -0.45, 0.88, -0.1, 0.12, 0.1, 0.11);
  part(c, orange, -0.49, 0.76, -0.14, 0.09, 0.09, 0.09);

  // Dot eyes, blush, happy open smile.
  for (const side of [-1, 1]) {
    part(c, black, side * 0.105, 1.08, 0.295, 0.055, 0.06, 0.02);
    part(c, 0xf6a6a6, side * 0.2, 1.03, 0.288, 0.055, 0.022, 0.012);
  }
  part(c, 0x7a2a28, 0, 0.975, 0.292, 0.12, 0.08, 0.02);
  part(c, 0xf78a8a, 0, 0.98, 0.302, 0.08, 0.035, 0.012);
  part(c, 0xffffff, 0, 1.043, 0.304, 0.09, 0.012, 0.008);

  // Wide straw farmer hat, lifted above the fringe.
  part(c, 0xf2e2a8, 0, 1.33, 0.0, 0.68, 0.05, 0.56);
  part(c, 0xd8bd74, 0, 1.325, 0.0, 0.7, 0.02, 0.58);
  part(c, 0xf2e2a8, 0, 1.38, -0.01, 0.44, 0.12, 0.4);
  part(c, 0xe8d79a, 0, 1.49, -0.01, 0.32, 0.03, 0.3);
  part(c, 0x3fa3a5, 0, 1.38, -0.005, 0.46, 0.05, 0.42);
  part(c, 0x86c4ee, -0.2, 1.41, 0.2, 0.1, 0.05, 0.03);
  part(c, 0x86c4ee, 0.2, 1.41, 0.2, 0.08, 0.05, 0.03);
  for (const [x, z] of [[-0.26, 0.16], [0.24, -0.14], [-0.14, -0.22], [0.3, 0.1]] as Array<[number, number]>) {
    part(c, 0xe2cb8b, x, 1.378, z, 0.1, 0.012, 0.08);
  }
  part(c, 0x3fa3a5, 0, 1.4, -0.22, 0.1, 0.07, 0.05);

  // Chicken companion on top of the hat.
  part(c, white, 0.06, 1.52, 0.02, 0.24, 0.16, 0.2);
  part(c, white, 0.06, 1.64, 0.08, 0.17, 0.13, 0.15);
  part(c, red, 0.06, 1.75, 0.08, 0.1, 0.05, 0.07);
  part(c, red, 0.02, 1.74, 0.1, 0.04, 0.07, 0.04);
  part(c, orange, 0.15, 1.68, 0.16, 0.06, 0.04, 0.04);
  part(c, black, 0.1, 1.7, 0.16, 0.025, 0.025, 0.015);
  part(c, white, -0.06, 1.52, -0.06, 0.08, 0.1, 0.08);
  part(c, 0xd8bd74, 0.06, 1.5, 0.02, 0.09, 0.03, 0.07);

  return c;
}

function buildAlaskanyan(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const skin = 0xffe6d8;
  const skinShade = 0xf0cbb8;
  const white = 0xfff8ef;
  const hair = 0xf1eef2;
  const hairShade = 0xd8d2dc;
  const maroon = 0x7c2430;
  const maroonLight = 0x9e2d3a;
  const grey = 0xb7b2bc;
  const black = 0x1b1720;
  const silver = 0xd8d5de;
  const red = 0xc92f42;

  // White sneakers and bare legs.
  for (const side of [-1, 1]) {
    part(c, white, side * 0.15, 0.02, 0.03, 0.19, 0.08, 0.28);
    part(c, grey, side * 0.15, 0.1, 0.0, 0.17, 0.07, 0.25);
    part(c, skin, side * 0.14, 0.12, 0.0, 0.13, 0.34, 0.14);
    part(c, white, side * 0.14, 0.22, 0.0, 0.14, 0.08, 0.15);
    part(c, maroon, side * 0.14, 0.36, 0.06, 0.14, 0.04, 0.04);
  }

  // White striped tee and maroon overall dress.
  part(c, white, 0, 0.44, 0.0, 0.48, 0.24, 0.34);
  part(c, maroon, 0, 0.4, 0.02, 0.46, 0.2, 0.34);
  part(c, maroonLight, 0, 0.4, 0.175, 0.4, 0.05, 0.02);
  part(c, maroon, 0, 0.62, 0.17, 0.28, 0.27, 0.035);
  part(c, maroonLight, 0, 0.7, 0.192, 0.22, 0.14, 0.012);
  for (const side of [-1, 1]) {
    part(c, maroon, side * 0.12, 0.87, 0.12, 0.05, 0.13, 0.035);
    part(c, maroon, side * 0.12, 0.87, -0.16, 0.05, 0.13, 0.03);
    part(c, silver, side * 0.1, 0.855, 0.195, 0.035, 0.035, 0.015);
  }
  part(c, white, 0, 0.82, 0.0, 0.42, 0.16, 0.3);
  for (const sy of [0.9]) {
    part(c, grey, 0, sy, 0.16, 0.38, 0.025, 0.02);
  }

  // White bandaged forearms.
  for (const side of [-1, 1]) {
    part(c, skin, side * 0.29, 0.62, 0.02, 0.1, 0.26, 0.12);
    part(c, white, side * 0.29, 0.55, 0.02, 0.12, 0.2, 0.14);
    for (const sy of [0.54, 0.59, 0.64]) {
      part(c, grey, side * 0.29, sy, 0.1, 0.13, 0.018, 0.02);
    }
    part(c, skin, side * 0.29, 0.48, 0.07, 0.1, 0.08, 0.12);
  }

  // Black choker with silver bell.
  part(c, skin, 0, 0.9, 0.0, 0.17, 0.12, 0.17);
  part(c, black, 0, 0.88, 0.0, 0.23, 0.05, 0.2);
  part(c, silver, 0, 0.84, 0.12, 0.07, 0.07, 0.035);

  // Head: soft white hair, red face streaks and a thin red headband.
  part(c, skin, 0, 0.94, 0.09, 0.46, 0.36, 0.34);
  part(c, hair, 0, 1.02, -0.04, 0.58, 0.36, 0.46);
  part(c, hair, 0, 1.36, -0.06, 0.48, 0.06, 0.36);
  part(c, hair, 0, 1.24, 0.235, 0.44, 0.14, 0.05);
  for (const x of [-0.14, 0.0, 0.13]) {
    part(c, hairShade, x, 1.26, 0.263, 0.018, 0.1, 0.008);
  }

  // Long back hair with a jagged hem, grey strands and one red streak.
  part(c, hair, 0, 0.44, -0.26, 0.52, 0.64, 0.12);
  part(c, hair, 0, 0.3, -0.27, 0.46, 0.16, 0.1);
  part(c, hairShade, -0.15, 0.26, -0.325, 0.12, 0.1, 0.02);
  part(c, hairShade, 0.03, 0.24, -0.325, 0.1, 0.08, 0.02);
  part(c, hair, 0.17, 0.28, -0.325, 0.1, 0.09, 0.02);
  part(c, hairShade, 0, 0.5, -0.325, 0.02, 0.5, 0.012);
  part(c, hairShade, -0.14, 0.55, -0.325, 0.03, 0.34, 0.012);
  part(c, maroonLight, 0.15, 0.5, -0.328, 0.035, 0.42, 0.012);

  // Narrow side sheets, long front locks, volume above.
  for (const side of [-1, 1]) {
    part(c, hair, side * 0.28, 0.44, -0.1, 0.09, 0.82, 0.34);
    part(c, hairShade, side * 0.288, 0.44, -0.1, 0.04, 0.4, 0.26);
    part(c, hair, side * 0.38, 1.04, -0.06, 0.14, 0.3, 0.3);
    part(c, hair, side * 0.24, 0.62, 0.29, 0.075, 0.66, 0.03);
  }
  // Thin red streaks threaded into the face-framing locks.
  part(c, maroonLight, -0.265, 0.72, 0.318, 0.035, 0.42, 0.015);
  part(c, maroonLight, 0.26, 0.88, 0.318, 0.03, 0.26, 0.015);

  // Soft bangs: uneven locks above the eyes, grey underside.
  part(c, hair, 0, 1.15, 0.27, 0.46, 0.15, 0.05);
  part(c, hairShade, 0, 1.148, 0.298, 0.43, 0.014, 0.01);
  part(c, hair, -0.2, 1.13, 0.285, 0.14, 0.17, 0.05);
  part(c, hair, -0.04, 1.16, 0.29, 0.12, 0.14, 0.05);
  part(c, hair, 0.12, 1.14, 0.29, 0.13, 0.16, 0.05);
  part(c, hair, 0.24, 1.14, 0.278, 0.08, 0.16, 0.045);
  for (const side of [-1, 1]) {
    part(c, hair, side * 0.215, 0.72, 0.298, 0.055, 0.56, 0.03);
  }

  // Thin red headband across the crown, with a small bow at the back.
  part(c, red, 0, 1.33, 0.255, 0.44, 0.045, 0.05);
  for (const side of [-1, 1]) {
    part(c, red, side * 0.295, 1.29, 0.09, 0.045, 0.045, 0.14);
  }
  part(c, red, 0, 1.29, -0.29, 0.3, 0.04, 0.03);
  part(c, red, 0.14, 1.31, -0.31, 0.08, 0.05, 0.03);
  part(c, red, 0.2, 1.29, -0.31, 0.05, 0.07, 0.03);

  // White cat ears with pink inner fur.
  for (const side of [-1, 1]) {
    part(c, hair, side * 0.185, 1.4, 0.0, 0.2, 0.08, 0.24);
    part(c, hair, side * 0.19, 1.47, 0.0, 0.16, 0.08, 0.2);
    part(c, hair, side * 0.195, 1.54, 0.0, 0.11, 0.07, 0.15);
    part(c, hairShade, side * 0.2, 1.6, 0.0, 0.07, 0.07, 0.1);
    part(c, hairShade, side * 0.278, 1.43, 0.0, 0.04, 0.16, 0.11);
    part(c, 0xffc5d8, side * 0.185, 1.415, 0.105, 0.1, 0.05, 0.035);
    part(c, 0xffc5d8, side * 0.19, 1.48, 0.09, 0.06, 0.04, 0.03);
    part(c, 0xffc5d8, side * 0.195, 1.55, 0.072, 0.03, 0.03, 0.02);
  }

  // Crimson eyes, blush, mischievous smile with fangs.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.125, y: 1.085, z: 0.275, w: 0.155, h: 0.14, white: 0xfff8ec, iris: red, pupil: 0x2a1012, outline: 0x2a1b16 });
    part(c, 0xf6b3b1, side * 0.19, 1.0, 0.268, 0.07, 0.026, 0.01);
  }
  part(c, 0xd89a94, 0, 0.985, 0.282, 0.03, 0.02, 0.012);
  part(c, 0x7a2a28, 0, 0.953, 0.284, 0.085, 0.02, 0.012);
  part(c, 0x7a2a28, 0.055, 0.968, 0.284, 0.02, 0.02, 0.012);
  part(c, 0xffffff, -0.035, 0.945, 0.288, 0.018, 0.028, 0.01);
  part(c, 0xffffff, 0.035, 0.945, 0.288, 0.018, 0.028, 0.01);

  // Big fluffy white tail, rooted at the centre of the lower back and curling up.
  const tail: Array<[number, number, number, number]> = [
    [0.0, 0.46, -0.26, 0.22],
    [0.1, 0.42, -0.34, 0.21],
    [0.21, 0.45, -0.38, 0.2],
    [0.31, 0.54, -0.36, 0.18],
    [0.38, 0.66, -0.31, 0.16],
    [0.43, 0.78, -0.25, 0.13]
  ];
  for (const [x, y, z, sw] of tail) {
    part(c, hair, x, y, z, sw, 0.16, sw);
  }
  part(c, hairShade, 0.0, 0.44, -0.3, 0.16, 0.05, 0.12);
  part(c, hairShade, 0.4, 0.58, -0.34, 0.08, 0.06, 0.08);
  part(c, hairShade, 0.1, 0.5, -0.36, 0.07, 0.06, 0.07);
  part(c, white, 0.46, 0.9, -0.21, 0.12, 0.12, 0.11);

  // White cat plush with a maroon collar.
  part(c, white, -0.3, 0.6, 0.2, 0.2, 0.15, 0.12);
  part(c, white, -0.3, 0.7, 0.18, 0.17, 0.12, 0.11);
  part(c, black, -0.33, 0.7, 0.245, 0.025, 0.025, 0.012);
  part(c, black, -0.27, 0.7, 0.245, 0.025, 0.025, 0.012);
  part(c, white, -0.37, 0.76, 0.2, 0.05, 0.08, 0.05);
  part(c, white, -0.23, 0.76, 0.2, 0.05, 0.08, 0.05);
  part(c, maroonLight, -0.3, 0.66, 0.245, 0.16, 0.025, 0.02);

  return c;
}

function buildAlysque(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const skin = 0xffe6d8;
  const skinShade = 0xf0cbb8;
  const pink = 0xef5aa1;
  const pinkLight = 0xff9dc8;
  const pinkDark = 0xb83376;
  const yellow = 0xf5c518;
  const yellowLight = 0xffdf55;
  const black = 0x17141a;
  const blackLight = 0x2a2027;
  const white = 0xfff8ef;
  const carrot = 0xf28a2e;
  const green = 0x65a83b;
  const redBow = 0xd93545;

  // Black boots, bare legs and black shorts.
  for (const side of [-1, 1]) {
    part(c, black, side * 0.15, 0.02, 0.03, 0.2, 0.1, 0.29);
    part(c, blackLight, side * 0.15, 0.12, 0.0, 0.18, 0.08, 0.25);
    part(c, skin, side * 0.14, 0.16, 0.0, 0.13, 0.24, 0.14);
    part(c, black, side * 0.14, 0.3, 0.05, 0.15, 0.06, 0.06);
  }
  part(c, black, 0, 0.38, 0.0, 0.44, 0.14, 0.3);

  // Oversized yellow hoodie.
  part(c, yellow, 0, 0.38, 0.0, 0.56, 0.42, 0.4);
  part(c, yellowLight, 0, 0.42, 0.2, 0.44, 0.3, 0.035);
  part(c, yellow, 0, 0.62, 0.0, 0.54, 0.28, 0.38);
  part(c, yellowLight, 0, 0.78, 0.0, 0.48, 0.16, 0.34);
  part(c, yellow, 0, 0.8, 0.02, 0.44, 0.12, 0.32);
  for (const side of [-1, 1]) {
    part(c, yellow, side * 0.29, 0.52, 0.02, 0.15, 0.3, 0.26);
    part(c, yellowLight, side * 0.31, 0.45, 0.05, 0.13, 0.12, 0.2);
    part(c, black, side * 0.33, 0.39, 0.05, 0.13, 0.08, 0.2);
    part(c, skin, side * 0.34, 0.35, 0.1, 0.1, 0.08, 0.12);
    part(c, black, side * 0.34, 0.35, 0.17, 0.12, 0.08, 0.03);
  }

  // Neck and hoodie collar.
  part(c, skin, 0, 0.9, 0.0, 0.16, 0.12, 0.16);
  part(c, yellow, 0, 0.9, -0.02, 0.3, 0.12, 0.24);

  // Head: pink bob inside an oversized yellow hood with black ear tips.
  part(c, skin, 0, 0.94, 0.09, 0.42, 0.34, 0.34);
  part(c, pink, 0, 1.0, -0.02, 0.5, 0.34, 0.42);
  part(c, pinkDark, 0, 0.88, -0.22, 0.46, 0.42, 0.1);
  for (const side of [-1, 1]) {
    part(c, pink, side * 0.265, 0.76, 0.14, 0.11, 0.36, 0.12);
    part(c, pinkLight, side * 0.285, 0.8, 0.21, 0.06, 0.28, 0.04);
    part(c, pink, side * 0.16, 0.84, 0.235, 0.09, 0.24, 0.05);
  }
  part(c, pink, 0, 1.16, 0.28, 0.46, 0.14, 0.05);
  part(c, pinkLight, -0.1, 1.16, 0.305, 0.1, 0.14, 0.015);
  part(c, pink, -0.2, 1.04, 0.285, 0.1, 0.24, 0.045);
  part(c, pink, 0.19, 1.05, 0.28, 0.08, 0.2, 0.04);
  part(c, pinkLight, 0.02, 1.15, 0.305, 0.04, 0.1, 0.012);
  for (const side of [-1, 1]) {
    part(c, pink, side * 0.255, 0.72, 0.285, 0.06, 0.44, 0.03);
  }

  // Hood shell: back, sides, top and a rim that frames the face.
  part(c, yellow, 0, 0.96, -0.3, 0.62, 0.44, 0.1);
  part(c, yellowLight, 0, 1.0, -0.36, 0.5, 0.3, 0.02);
  part(c, yellow, 0, 1.36, -0.06, 0.58, 0.1, 0.44);
  for (const side of [-1, 1]) {
    part(c, yellow, side * 0.3, 0.98, -0.07, 0.1, 0.4, 0.42);
    part(c, black, side * 0.305, 0.98, 0.14, 0.05, 0.36, 0.03);
    part(c, yellow, side * 0.25, 1.1, 0.17, 0.05, 0.26, 0.06);
  }
  part(c, yellow, 0, 1.34, 0.19, 0.48, 0.06, 0.06);
  part(c, black, 0, 1.345, 0.205, 0.44, 0.018, 0.02);

  // Black triangular hood ear tips.
  for (const side of [-1, 1]) {
    part(c, black, side * 0.15, 1.44, -0.04, 0.12, 0.08, 0.16);
    part(c, black, side * 0.155, 1.51, -0.04, 0.08, 0.07, 0.12);
    part(c, black, side * 0.16, 1.57, -0.04, 0.05, 0.06, 0.08);
  }

  // Black curved demon horns, in front of the hood sides.
  for (const side of [-1, 1]) {
    part(c, blackLight, side * 0.24, 1.33, 0.1, 0.09, 0.14, 0.1);
    part(c, black, side * 0.28, 1.41, 0.1, 0.075, 0.14, 0.08);
    part(c, black, side * 0.32, 1.49, 0.1, 0.06, 0.13, 0.06);
    part(c, black, side * 0.35, 1.57, 0.1, 0.04, 0.11, 0.04);
  }
  part(c, redBow, -0.19, 1.45, 0.22, 0.07, 0.05, 0.03);
  part(c, redBow, -0.25, 1.47, 0.22, 0.05, 0.07, 0.03);

  // Yellow block eyes with sharp eyeliner, smug smile and fangs.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.125, y: 1.09, z: 0.265, w: 0.15, h: 0.14, white: 0xfff8ec, iris: 0xf5c518, pupil: 0x1b1411, outline: 0x2a1b16 });
    c.push({ x: side * 0.125, y: 1.157, z: 0.288, sx: 0.18, sy: 0.022, sz: 0.012, color: black, rz: side * 0.18 });
  }
  part(c, 0xd89a94, 0, 0.985, 0.286, 0.03, 0.02, 0.012);
  part(c, 0x7a2a28, 0, 0.95, 0.286, 0.11, 0.035, 0.012);
  part(c, white, -0.04, 0.94, 0.29, 0.02, 0.035, 0.01);
  part(c, white, 0.04, 0.94, 0.29, 0.02, 0.035, 0.01);

  // Carrot accessory.
  part(c, carrot, 0.34, 0.5, 0.2, 0.09, 0.18, 0.08);
  part(c, carrot, 0.34, 0.42, 0.2, 0.06, 0.08, 0.06);
  part(c, green, 0.34, 0.61, 0.2, 0.08, 0.08, 0.04);
  part(c, green, 0.3, 0.63, 0.2, 0.04, 0.1, 0.03);
  part(c, green, 0.38, 0.63, 0.2, 0.04, 0.1, 0.03);

  return c;
}

function buildAmelia(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const skin = 0xffe6d8;
  const skinShade = 0xf0cbb8;
  const hair = 0xf1eef4;
  const hairShade = 0xdad5e0;
  const purple = 0x2c1b4f;
  const purpleLight = 0x49306e;
  const purpleDark = 0x1d1237;
  const black = 0x1a1420;
  const gold = 0xd8b36a;
  const pink = 0xd13b75;
  const lip = 0x8e1f3d;

  // Shoes and a floor-length train keep her grounded.
  for (const side of [-1, 1]) {
    part(c, purpleDark, side * 0.13, 0.0, 0.03, 0.18, 0.06, 0.24);
    part(c, black, side * 0.13, 0.06, 0.0, 0.16, 0.08, 0.2);
  }
  part(c, purpleDark, 0, 0.12, 0.0, 0.5, 0.16, 0.38);
  part(c, purple, 0, 0.18, 0.0, 0.52, 0.2, 0.38);
  part(c, gold, 0, 0.2, 0.2, 0.4, 0.025, 0.02);
  // Long dark-purple gown.
  part(c, purple, 0, 0.3, 0.0, 0.52, 0.36, 0.38);
  part(c, purpleDark, 0, 0.28, 0.02, 0.48, 0.1, 0.34);
  for (const side of [-1, 1]) {
    part(c, purple, side * 0.3, 0.38, 0.0, 0.16, 0.4, 0.26);
    part(c, purpleLight, side * 0.34, 0.28, 0.02, 0.1, 0.18, 0.2);
    part(c, gold, side * 0.32, 0.4, 0.14, 0.03, 0.12, 0.02);
    part(c, gold, side * 0.36, 0.31, 0.13, 0.03, 0.1, 0.02);
  }
  part(c, purpleLight, 0, 0.38, 0.18, 0.44, 0.16, 0.04);
  part(c, black, 0, 0.4, 0.2, 0.46, 0.04, 0.02);
  part(c, purple, 0, 0.58, 0.0, 0.44, 0.28, 0.34);
  part(c, purpleLight, 0, 0.6, 0.02, 0.48, 0.14, 0.34);
  part(c, black, 0, 0.64, 0.18, 0.34, 0.08, 0.035);
  part(c, gold, 0, 0.62, 0.19, 0.06, 0.05, 0.02);
  for (const side of [-1, 1]) {
    part(c, skin, side * 0.23, 0.76, 0.0, 0.1, 0.18, 0.14);
    part(c, purple, side * 0.26, 0.58, 0.0, 0.12, 0.26, 0.26);
    part(c, purpleLight, side * 0.27, 0.73, 0.02, 0.14, 0.08, 0.28);
    part(c, skin, side * 0.29, 0.53, 0.1, 0.08, 0.13, 0.1);
    part(c, black, side * 0.29, 0.53, 0.17, 0.08, 0.08, 0.02);
  }

  // Neck, bat-wing choker and gold jewelry.
  part(c, skin, 0, 0.9, 0.0, 0.16, 0.12, 0.16);
  part(c, black, 0, 0.87, 0.0, 0.22, 0.05, 0.19);
  for (const side of [-1, 1]) {
    part(c, black, side * 0.13, 0.88, 0.06, 0.1, 0.05, 0.1);
    part(c, black, side * 0.19, 0.86, 0.05, 0.06, 0.04, 0.08);
  }
  part(c, pink, 0, 0.85, 0.12, 0.06, 0.07, 0.03);
  part(c, gold, 0, 0.8, 0.12, 0.02, 0.08, 0.02);

  // Head: silver hair with a centre part, pointed ears, small demon horns.
  part(c, skin, 0, 0.94, 0.09, 0.44, 0.36, 0.34);
  part(c, hair, 0, 1.02, -0.03, 0.58, 0.36, 0.46);
  part(c, hair, 0, 1.36, -0.05, 0.5, 0.08, 0.38);
  part(c, hair, 0, 1.23, 0.235, 0.44, 0.16, 0.05);

  // Very long back hair with a soft wavy hem and grey strands.
  part(c, hair, 0, 0.44, -0.26, 0.52, 0.64, 0.12);
  part(c, hair, 0, 0.3, -0.27, 0.46, 0.16, 0.1);
  part(c, hairShade, -0.15, 0.26, -0.325, 0.12, 0.1, 0.02);
  part(c, hairShade, 0.03, 0.24, -0.325, 0.1, 0.08, 0.02);
  part(c, hair, 0.17, 0.28, -0.325, 0.1, 0.09, 0.02);
  part(c, hairShade, 0, 0.5, -0.325, 0.02, 0.5, 0.012);
  part(c, hairShade, -0.13, 0.55, -0.325, 0.03, 0.34, 0.012);
  part(c, hairShade, 0.14, 0.6, -0.325, 0.03, 0.3, 0.012);

  // Narrow side sheets keep the arms visible; long front locks frame the face.
  for (const side of [-1, 1]) {
    part(c, hair, side * 0.285, 0.44, -0.1, 0.09, 0.84, 0.34);
    part(c, hairShade, side * 0.293, 0.44, -0.1, 0.04, 0.4, 0.26);
    part(c, hair, side * 0.38, 1.04, -0.06, 0.14, 0.3, 0.3);
    part(c, hair, side * 0.24, 0.6, 0.295, 0.075, 0.68, 0.03);
    part(c, hairShade, side * 0.245, 0.6, 0.312, 0.03, 0.4, 0.012);
  }

  // Centre-parted fringe above the eyeliner.
  part(c, hair, -0.115, 1.19, 0.285, 0.16, 0.14, 0.05);
  part(c, hair, 0.115, 1.19, 0.285, 0.16, 0.14, 0.05);
  part(c, hair, 0, 1.28, 0.27, 0.5, 0.12, 0.04);
  part(c, hairShade, 0, 1.19, 0.312, 0.012, 0.11, 0.008);
  part(c, hairShade, -0.19, 1.2, 0.303, 0.03, 0.1, 0.01);

  // Pointed elf ears, in front of the side hair.
  for (const side of [-1, 1]) {
    part(c, skin, side * 0.255, 1.06, 0.12, 0.1, 0.08, 0.06);
    part(c, skin, side * 0.31, 1.09, 0.1, 0.08, 0.06, 0.05);
    part(c, skin, side * 0.355, 1.12, 0.08, 0.06, 0.05, 0.04);
    part(c, skinShade, side * 0.3, 1.075, 0.145, 0.05, 0.03, 0.012);
  }

  // Gold drop earrings with pink stones.
  for (const side of [-1, 1]) {
    part(c, gold, side * 0.31, 1.0, 0.16, 0.028, 0.05, 0.025);
    part(c, pink, side * 0.31, 0.95, 0.16, 0.038, 0.05, 0.02);
  }

  // Small dark curved horns above the hair.
  for (const side of [-1, 1]) {
    part(c, 0x2a2027, side * 0.14, 1.38, -0.02, 0.07, 0.1, 0.07);
    part(c, black, side * 0.17, 1.45, -0.05, 0.06, 0.09, 0.06);
    part(c, black, side * 0.2, 1.51, -0.08, 0.05, 0.08, 0.05);
  }

  // Magenta eyes, dark eyeliner, red lips and fangs.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.125, y: 1.08, z: 0.275, w: 0.145, h: 0.127, white: 0xfff8ec, iris: pink, pupil: 0x2a101b, outline: 0x2a1b24 });
    c.push({ x: side * 0.13, y: 1.17, z: 0.29, sx: 0.18, sy: 0.022, sz: 0.012, color: black, rz: side * 0.22 });
  }
  part(c, lip, 0, 0.955, 0.285, 0.11, 0.04, 0.015);
  part(c, 0xfff8ef, -0.035, 0.94, 0.29, 0.018, 0.035, 0.012);
  part(c, 0xfff8ef, 0.035, 0.94, 0.29, 0.018, 0.035, 0.012);
  part(c, skinShade, 0, 0.995, 0.285, 0.025, 0.02, 0.012);

  return c;
}

function buildNyamuras(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const skin = 0xffe6d8;
  const skinShade = 0xf0cbb8;
  const purple = 0x9b7bd4;
  const purpleLight = 0xc4a9eb;
  const purpleDark = 0x6d5aa8;
  const straw = 0xf2e2a8;
  const strawDark = 0xd8bd74;
  const yellow = 0xf2b544;
  const yellowLight = 0xffd56e;
  const denim = 0x707fc2;
  const denimDark = 0x4e5f9f;
  const white = 0xfff8ef;
  const amber = 0xc58a2e;
  const blue = 0x88c8ef;

  // Yellow floral rain boots and bare legs.
  for (const side of [-1, 1]) {
    part(c, strawDark, side * 0.14, 0.02, 0.03, 0.18, 0.06, 0.26);
    part(c, yellow, side * 0.14, 0.08, 0.01, 0.17, 0.18, 0.23);
    part(c, yellowLight, side * 0.14, 0.2, 0.03, 0.16, 0.08, 0.2);
    part(c, 0x86b96b, side * 0.1, 0.13, 0.14, 0.04, 0.04, 0.02);
    part(c, 0xd76d8a, side * 0.18, 0.16, 0.14, 0.035, 0.035, 0.02);
    part(c, skin, side * 0.14, 0.2, 0.0, 0.13, 0.2, 0.14);
    part(c, 0x8bb5e8, side * 0.1, 0.34, 0.08, 0.06, 0.02, 0.03);
  }

  // Blue denim overall shorts with white tee and flower embroidery.
  part(c, denim, 0, 0.38, 0.0, 0.46, 0.26, 0.34);
  part(c, denimDark, 0, 0.36, 0.02, 0.42, 0.08, 0.32);
  part(c, white, 0, 0.52, 0.0, 0.42, 0.2, 0.32);
  part(c, denim, 0, 0.6, 0.02, 0.36, 0.18, 0.3);
  for (const side of [-1, 1]) {
    part(c, denim, side * 0.16, 0.72, 0.0, 0.07, 0.22, 0.28);
    part(c, 0xd8d3e8, side * 0.16, 0.58, 0.16, 0.06, 0.04, 0.02);
    for (const [dx, dy, col] of [[-0.13, 0.42, 0x86b96b], [0.05, 0.44, 0xe5c14a], [0.14, 0.4, 0x7fa7d9]]) {
      part(c, col, side * 0 + dx, dy, 0.18, 0.035, 0.035, 0.012);
    }
  }
  for (const [x, y, col] of [[-0.08, 0.58, 0x86b96b], [0.05, 0.6, 0xe5c14a], [0.15, 0.56, 0xd76d8a]]) {
    part(c, col, x, y, 0.17, 0.04, 0.04, 0.012);
  }
  part(c, white, 0, 0.78, 0.0, 0.36, 0.12, 0.28);

  // Yellow plaid overshirt.
  for (const side of [-1, 1]) {
    part(c, yellow, side * 0.27, 0.48, 0.0, 0.18, 0.4, 0.3);
    part(c, strawDark, side * 0.27, 0.5, 0.16, 0.16, 0.03, 0.02);
    part(c, strawDark, side * 0.31, 0.48, 0.16, 0.03, 0.32, 0.02);
    part(c, yellowLight, side * 0.32, 0.4, 0.05, 0.12, 0.12, 0.22);
    part(c, skin, side * 0.34, 0.34, 0.1, 0.1, 0.08, 0.12);
    part(c, yellow, side * 0.2, 0.7, 0.02, 0.12, 0.24, 0.3);
  }
  part(c, yellow, 0, 0.68, -0.06, 0.5, 0.32, 0.16);
  for (const sy of [0.6, 0.7, 0.8]) {
    part(c, strawDark, 0, sy, 0.17, 0.48, 0.022, 0.02);
  }

  // Neck and white tee collar.
  part(c, skin, 0, 0.9, 0.0, 0.15, 0.12, 0.15);
  part(c, white, 0, 0.9, 0.02, 0.26, 0.1, 0.24);

  // Head: lavender bob under a lifted straw hat, with low twin tails.
  part(c, skin, 0, 0.94, 0.09, 0.44, 0.36, 0.34);
  part(c, purple, 0, 1.02, -0.04, 0.56, 0.32, 0.46);
  part(c, purple, 0, 1.3, -0.05, 0.48, 0.06, 0.36);
  part(c, purpleDark, 0, 0.9, -0.28, 0.5, 0.42, 0.12);
  for (const side of [-1, 1]) {
    part(c, purple, side * 0.285, 0.78, -0.05, 0.1, 0.48, 0.3);
    part(c, purpleLight, side * 0.29, 0.8, 0.09, 0.05, 0.3, 0.05);
    part(c, purple, side * 0.24, 0.66, 0.24, 0.08, 0.34, 0.05);
  }
  part(c, purple, 0, 1.13, 0.24, 0.46, 0.15, 0.05);
  part(c, purpleLight, -0.12, 1.14, 0.26, 0.16, 0.12, 0.03);
  part(c, purple, -0.2, 1.0, 0.25, 0.09, 0.24, 0.045);
  part(c, purple, 0.16, 1.02, 0.25, 0.1, 0.22, 0.04);
  part(c, purpleLight, 0.02, 1.14, 0.263, 0.04, 0.1, 0.02);
  // Blue star flowers in the hair.
  for (const [x, y] of [[-0.22, 1.21], [0.21, 1.19]] as Array<[number, number]>) {
    part(c, blue, x, y, 0.272, 0.05, 0.05, 0.02);
    part(c, 0x86c4ee, x, y - 0.04, 0.272, 0.05, 0.02, 0.02);
  }
  // Low twin side tails.
  for (const side of [-1, 1]) {
    part(c, purpleLight, side * 0.3, 1.0, -0.02, 0.07, 0.07, 0.07);
    part(c, purple, side * 0.32, 0.87, -0.04, 0.13, 0.1, 0.12);
    part(c, purple, side * 0.34, 0.75, -0.05, 0.12, 0.1, 0.11);
    part(c, purpleDark, side * 0.35, 0.65, -0.06, 0.1, 0.09, 0.1);
  }

  // Wide straw sun hat, lifted above the fringe.
  part(c, straw, 0, 1.3, 0.0, 0.72, 0.05, 0.6);
  part(c, strawDark, 0, 1.295, 0.0, 0.74, 0.02, 0.62);
  part(c, straw, 0, 1.34, -0.01, 0.44, 0.13, 0.4);
  part(c, straw, 0, 1.46, -0.01, 0.36, 0.03, 0.32);
  part(c, blue, 0, 1.34, -0.005, 0.46, 0.05, 0.42);
  part(c, 0x86c4ee, -0.18, 1.37, 0.19, 0.09, 0.05, 0.03);
  part(c, 0x86c4ee, 0.18, 1.37, 0.19, 0.07, 0.05, 0.03);

  // Large purple cat ears above the brim, with pink inner fur.
  for (const side of [-1, 1]) {
    part(c, purple, side * 0.25, 1.35, 0.02, 0.2, 0.09, 0.2);
    part(c, purple, side * 0.26, 1.43, 0.02, 0.16, 0.08, 0.16);
    part(c, purple, side * 0.27, 1.5, 0.02, 0.11, 0.08, 0.12);
    part(c, purpleDark, side * 0.28, 1.57, 0.02, 0.07, 0.07, 0.08);
    part(c, 0xffd6e8, side * 0.25, 1.365, 0.125, 0.1, 0.05, 0.035);
    part(c, 0xffd6e8, side * 0.26, 1.44, 0.11, 0.06, 0.04, 0.03);
    part(c, 0xffd6e8, side * 0.27, 1.51, 0.09, 0.03, 0.03, 0.02);
  }

  // Purple floral tail rooted at the lower back, curling up.
  part(c, purple, 0.0, 0.38, -0.24, 0.2, 0.12, 0.18);
  part(c, purple, 0.12, 0.36, -0.3, 0.18, 0.11, 0.16);
  part(c, purple, 0.25, 0.4, -0.32, 0.16, 0.1, 0.14);
  part(c, purpleDark, 0.36, 0.48, -0.28, 0.13, 0.09, 0.12);
  part(c, purple, 0.44, 0.58, -0.24, 0.11, 0.09, 0.1);
  part(c, 0x86b96b, 0.25, 0.42, -0.21, 0.04, 0.04, 0.02);
  part(c, 0xd76d8a, 0.37, 0.5, -0.19, 0.035, 0.035, 0.02);

  // Small blue mouse mascot.
  part(c, white, -0.38, 0.42, 0.16, 0.18, 0.14, 0.12);
  part(c, white, -0.38, 0.5, 0.14, 0.14, 0.12, 0.1);
  part(c, blue, -0.46, 0.53, 0.14, 0.09, 0.12, 0.03);
  part(c, blue, -0.3, 0.53, 0.14, 0.09, 0.12, 0.03);
  part(c, 0x1b1720, -0.34, 0.5, 0.2, 0.02, 0.025, 0.01);
  part(c, 0x1b1720, -0.42, 0.5, 0.2, 0.02, 0.025, 0.01);
  part(c, 0xd76d8a, -0.28, 0.6, 0.15, 0.05, 0.06, 0.03);

  // Amber eyes, blush and little smile.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.125, y: 1.08, z: 0.275, w: 0.145, h: 0.127, white: 0xfff8ec, iris: amber, pupil: 0x2a1c10, outline: 0x2a1b16 });
    part(c, 0xf6a6a6, side * 0.2, 0.99, 0.26, 0.055, 0.022, 0.012);
  }
  part(c, 0xd89a94, 0, 0.985, 0.286, 0.03, 0.022, 0.012);
  part(c, 0x9b4e52, 0, 0.955, 0.286, 0.075, 0.02, 0.012);

  return c;
}

function buildKnjazevdesu(_skin: SkinDef): CubeSpec[] {
  const c: CubeSpec[] = [];
  const teal = 0x56d6c4;
  const tealDark = 0x2f9f92;
  const tealLight = 0x8cead9;
  const belly = 0xd8efb6;
  const hair = 0x19b3a2;
  const hairDark = 0x0c8076;
  const white = 0xfff8ef;
  const denim = 0x86b5d7;
  const denimDark = 0x5d8db2;
  const black = 0x17151b;
  const yellow = 0xf2c24e;

  // Teal clawed feet and legs.
  for (const side of [-1, 1]) {
    part(c, teal, side * 0.14, 0.02, 0.04, 0.18, 0.1, 0.26);
    part(c, tealLight, side * 0.18, 0.04, 0.16, 0.05, 0.05, 0.05);
    part(c, teal, side * 0.14, 0.12, 0.0, 0.13, 0.3, 0.14);
    part(c, belly, side * 0.14, 0.22, 0.07, 0.08, 0.16, 0.02);
    part(c, denim, side * 0.14, 0.34, 0.0, 0.15, 0.08, 0.17);
  }
  // Denim shorts.
  part(c, denim, 0, 0.38, 0.0, 0.44, 0.16, 0.32);
  part(c, denimDark, 0, 0.36, 0.02, 0.4, 0.05, 0.3);
  part(c, 0xd8c6a4, 0, 0.47, 0.0, 0.44, 0.04, 0.32);
  part(c, teal, 0, 0.52, 0.0, 0.4, 0.08, 0.3);

  // Fishnet crop top and tie-dye graphic.
  part(c, white, 0, 0.6, 0.0, 0.42, 0.24, 0.3);
  part(c, 0xbfe8df, 0, 0.6, 0.16, 0.38, 0.2, 0.03);
  part(c, 0xf6a8c9, 0, 0.62, 0.18, 0.22, 0.12, 0.025);
  part(c, yellow, -0.08, 0.6, 0.19, 0.1, 0.08, 0.02);
  part(c, 0x86c8ef, 0.08, 0.62, 0.19, 0.1, 0.08, 0.02);
  part(c, white, 0, 0.78, 0.0, 0.34, 0.1, 0.28);
  for (const side of [-1, 1]) {
    part(c, teal, side * 0.28, 0.56, 0.0, 0.11, 0.28, 0.13);
    part(c, tealLight, side * 0.28, 0.56, 0.08, 0.08, 0.2, 0.02);
    part(c, teal, side * 0.28, 0.42, 0.04, 0.1, 0.12, 0.11);
    part(c, tealLight, side * 0.31, 0.4, 0.1, 0.05, 0.05, 0.05);
  }

  // Black controller in her hands.
  part(c, black, 0, 0.64, 0.2, 0.22, 0.09, 0.06);
  part(c, 0x3a3a44, -0.08, 0.65, 0.23, 0.04, 0.035, 0.02);
  part(c, 0x3a3a44, 0.08, 0.65, 0.23, 0.04, 0.035, 0.02);
  part(c, 0x4aa6d8, 0, 0.66, 0.24, 0.03, 0.03, 0.01);

  // Lizard head: pale muzzle, dark slit pupils, lighter skin than the hair.
  part(c, teal, 0, 0.94, 0.09, 0.44, 0.36, 0.32);
  part(c, belly, 0, 0.93, 0.25, 0.26, 0.12, 0.08);
  for (const side of [-1, 1]) {
    part(c, tealDark, side * 0.055, 1.0, 0.295, 0.022, 0.022, 0.012);
  }
  // Darker teal hair cap, fringe and long side locks.
  part(c, hair, 0, 1.0, -0.06, 0.52, 0.36, 0.44);
  part(c, hair, 0, 1.34, -0.08, 0.44, 0.06, 0.34);
  part(c, hair, 0, 1.17, 0.265, 0.44, 0.15, 0.05);
  part(c, hair, -0.18, 1.15, 0.285, 0.14, 0.16, 0.04);
  part(c, hair, 0.0, 1.16, 0.29, 0.12, 0.14, 0.04);
  part(c, hair, 0.18, 1.15, 0.28, 0.12, 0.16, 0.04);
  for (const side of [-1, 1]) {
    part(c, hair, side * 0.245, 0.7, 0.28, 0.075, 0.6, 0.03);
    part(c, hair, side * 0.27, 0.72, 0.05, 0.1, 0.58, 0.24);
  }
  // Fin-like ears in a lighter teal.
  for (const side of [-1, 1]) {
    part(c, tealLight, side * 0.245, 1.06, 0.06, 0.1, 0.07, 0.1);
    part(c, tealLight, side * 0.3, 1.1, 0.05, 0.07, 0.06, 0.07);
    part(c, tealLight, side * 0.345, 1.14, 0.04, 0.05, 0.05, 0.05);
  }
  // High ponytail with a yellow tie, hanging behind the back.
  part(c, yellow, 0.02, 1.32, -0.31, 0.14, 0.05, 0.05);
  part(c, hair, 0.02, 1.24, -0.34, 0.18, 0.14, 0.12);
  part(c, hair, 0.04, 1.12, -0.37, 0.17, 0.13, 0.12);
  part(c, hair, 0.05, 0.99, -0.38, 0.16, 0.13, 0.12);
  part(c, hairDark, 0.06, 0.86, -0.36, 0.14, 0.13, 0.11);
  // Two thin braids with yellow ties.
  for (const side of [-1, 1]) {
    part(c, hair, side * 0.18, 0.84, 0.26, 0.06, 0.32, 0.04);
    part(c, yellow, side * 0.18, 0.68, 0.262, 0.05, 0.035, 0.02);
  }

  // Black gaming headphones around the neck.
  part(c, black, -0.2, 0.84, 0.03, 0.1, 0.15, 0.12);
  part(c, black, 0.2, 0.84, 0.03, 0.1, 0.15, 0.12);
  part(c, black, 0, 0.92, 0.02, 0.26, 0.05, 0.12);
  part(c, 0x3a3a44, -0.2, 0.85, 0.1, 0.07, 0.1, 0.04);
  part(c, 0x3a3a44, 0.2, 0.85, 0.1, 0.07, 0.1, 0.04);

  // Long thick teal tail rooted at the centre of the lower back.
  part(c, teal, 0.0, 0.3, -0.22, 0.2, 0.16, 0.2);
  part(c, teal, 0.12, 0.26, -0.29, 0.18, 0.14, 0.18);
  part(c, teal, 0.26, 0.22, -0.31, 0.15, 0.12, 0.15);
  part(c, tealDark, 0.38, 0.18, -0.26, 0.12, 0.1, 0.12);
  part(c, belly, 0.1, 0.3, -0.13, 0.12, 0.08, 0.03);
  part(c, tealLight, 0.0, 0.38, -0.15, 0.05, 0.05, 0.02);

  // Yellow eyes with slit pupils and a toothy lizard grin.
  for (const side of [-1, 1]) {
    blockEye(c, { x: side * 0.125, y: 1.09, z: 0.275, w: 0.15, h: 0.14, white: 0xfff8ec, iris: yellow, pupil: 0x1b2a24, outline: 0x21352c });
    part(c, 0x14201c, side * 0.125, 1.045, 0.297, 0.022, 0.09, 0.004);
  }
  part(c, tealDark, 0, 0.955, 0.30, 0.14, 0.03, 0.012);
  part(c, white, -0.045, 0.955, 0.306, 0.02, 0.03, 0.01);
  part(c, white, 0.045, 0.955, 0.306, 0.02, 0.03, 0.01);

  return c;
}

export function buildCharacter(skinId: SkinId): THREE.Group {
  const skin = SKINS[skinId];
  let cubes: CubeSpec[];
  if (skin.style === "moryaka") cubes = buildMoryaka(skin);
  else if (skin.style === "severina") cubes = buildSeverina(skin);
  else if (skin.style === "higanbanban") cubes = buildHiganbanban(skin);
  else if (skin.style === "squimeh") cubes = buildSquimeh(skin);
  else if (skin.style === "snezha") cubes = buildSnezha(skin);
  else if (skin.style === "meowlody") cubes = buildMeowlody(skin);
  else if (skin.style === "miliray") cubes = buildMiliray(skin);
  else if (skin.style === "yuchii") cubes = buildYuchii(skin);
  else if (skin.style === "alaskanyan") cubes = buildAlaskanyan(skin);
  else if (skin.style === "alysque") cubes = buildAlysque(skin);
  else if (skin.style === "amelia") cubes = buildAmelia(skin);
  else if (skin.style === "nyamuras") cubes = buildNyamuras(skin);
  else if (skin.style === "knjazevdesu") cubes = buildKnjazevdesu(skin);
  else cubes = buildDitoshey(skin);
  if (skin.style !== "moryaka" && skin.style !== "severina" && skin.style !== "snezha" && skin.style !== "meowlody" && skin.style !== "miliray" && skin.style !== "yuchii" && skin.style !== "alaskanyan" && skin.style !== "alysque" && skin.style !== "amelia" && skin.style !== "nyamuras" && skin.style !== "knjazevdesu" && skin.style !== "higanbanban") {
    addHairDepth(cubes, skin.mane, "long");
    addRearDetails(cubes, skin.style);
    addBackOutfit(cubes, skin.style);
    addRearHairAccents(cubes, skin.style);
  }
  const group = new THREE.Group();
  group.add(createVoxelMesh(cubes));
  if (skin.style === "severina" || skin.style === "moryaka") {
    const faceLight = new THREE.PointLight(0xfff3e9, 0.9, 1.8, 2);
    faceLight.position.set(0, 0.82, 1.05);
    group.add(faceLight);
  }
  return group;
}

function shade(hex: number, amount: number): number {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const f = (v: number): number => Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  return (f(r) << 16) | (f(g) << 8) | f(b);
}








