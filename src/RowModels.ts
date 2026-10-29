import * as THREE from "three";
import { BIOMES, type BiomeDecorKind, type BiomeDef, type BiomeId } from "./biomes";
import type { CarData, CubeSpec, PropData, Row, RowType } from "./types";
import { blobShadowGeometry, createVoxelMesh, getShadowMaterial } from "./Voxel";
import { cssColor, hash2 } from "./utils";

const groundWidth = 150;

interface GrassAsset {
  material: THREE.MeshLambertMaterial;
  texture: THREE.CanvasTexture;
}

interface WaterAsset {
  material: THREE.MeshBasicMaterial;
  texture: THREE.CanvasTexture;
}

const grassAssets = new Map<BiomeId, GrassAsset>();
const waterAssets = new Map<BiomeId, WaterAsset>();
const grassGeometry = new THREE.PlaneGeometry(1, 1);
const waterGeometry = new THREE.PlaneGeometry(1, 1);

function pixelTexture(canvas: HTMLCanvasElement, repeatX: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(repeatX, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  return texture;
}

function makeGrassTexture(biome: BiomeDef): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = cssColor(biome.grass[0]);
  ctx.fillRect(0, 0, size, size);

  // Broad, low-contrast clumps instead of noisy pixel speckles: the field
  // should read as a clean low-poly lawn, with flowers and props carrying the
  // detail.
  const shades = [biome.grass[1], biome.grass[2]];
  for (let i = 0; i < 18; i++) {
    const w = 5 + Math.floor(Math.random() * 13);
    const h = 4 + Math.floor(Math.random() * 11);
    const x = Math.floor(Math.random() * (size - w));
    const y = Math.floor(Math.random() * (size - h));
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = cssColor(shades[i % shades.length]);
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalAlpha = 1;
  return pixelTexture(canvas, 8);
}

function makeWaterTexture(biome: BiomeDef): THREE.CanvasTexture {
  const w = 64;
  const h = 32;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = cssColor(biome.water);
  ctx.fillRect(0, 0, w, h);

  // Chunky pixel waves, deliberately aligned to the low-res pixel grid.
  for (let y = 2; y < h; y += 5) {
    ctx.fillStyle = cssColor(biome.waterDeep);
    ctx.fillRect(0, y, w, 2);
  }
  for (let i = 0; i < 16; i++) {
    const x = (i * 11 + (i % 3) * 4) % w;
    const y = 2 + (i * 7) % (h - 4);
    ctx.fillStyle = cssColor(i % 3 === 0 ? biome.waterLight : biome.water);
    ctx.fillRect(x, y, 5, 1);
    ctx.fillRect((x + 3) % w, y + 2, 3, 1);
  }
  // A few sparkling foam pixels.
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = cssColor(i % 2 === 0 ? biome.waterLight : biome.waterLight);
    ctx.fillRect((i * 17) % w, 2 + (i * 13) % (h - 3), 1, 1);
  }
  return pixelTexture(canvas, 20);
}

function getGrassAsset(id: BiomeId): GrassAsset {
  let asset = grassAssets.get(id);
  if (!asset) {
    const texture = makeGrassTexture(BIOMES[id]);
    asset = {
      texture,
      material: new THREE.MeshLambertMaterial({ map: texture, color: 0xffffff })
    };
    grassAssets.set(id, asset);
  }
  return asset;
}

function getWaterAsset(id: BiomeId): WaterAsset {
  let asset = waterAssets.get(id);
  if (!asset) {
    const texture = makeWaterTexture(BIOMES[id]);
    asset = {
      texture,
      // Unlit, flat pixel water: keeps the palette saturated under the
      // bright directional light used by the voxel terrain.
      material: new THREE.MeshBasicMaterial({
        map: texture,
        color: 0xffffff
      })
    };
    waterAssets.set(id, asset);
  }
  return asset;
}

export function animateWater(time: number): void {
  for (const asset of waterAssets.values()) {
    asset.texture.offset.x = (time * 0.045) % 1;
    asset.texture.offset.y = Math.sin(time * 0.3) * 0.01;
  }
}

export function buildWaterSurface(biomeId: BiomeId): THREE.Mesh {
  const mesh = new THREE.Mesh(waterGeometry, getWaterAsset(biomeId).material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.032;
  mesh.scale.set(groundWidth, 0.98, 1);
  return mesh;
}

export function buildGrassTop(biomeId: BiomeId): THREE.Mesh {
  const mesh = new THREE.Mesh(grassGeometry, getGrassAsset(biomeId).material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  mesh.scale.set(groundWidth, 0.99, 1);
  return mesh;
}

const carShadowDummy = new THREE.Object3D();

export function buildCarShadows(cars: CarData[]): THREE.InstancedMesh | null {
  if (cars.length === 0) return null;
  const mesh = new THREE.InstancedMesh(blobShadowGeometry, getShadowMaterial(), cars.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  updateCarShadows(mesh, cars);
  return mesh;
}

export function updateCarShadows(mesh: THREE.InstancedMesh | undefined, cars: CarData[]): void {
  if (!mesh) return;
  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    carShadowDummy.position.set(car.x, 0.024, 0);
    carShadowDummy.rotation.set(-Math.PI / 2, 0, 0);
    carShadowDummy.scale.set(car.len * 1.1, car.width, 1);
    carShadowDummy.updateMatrix();
    mesh.setMatrixAt(i, carShadowDummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function boundaryCurb(cubes: CubeSpec[], prevType: RowType | null, rowType: RowType, biome: BiomeDef): void {
  if (!prevType || prevType === rowType) return;
  if (rowType === "grass") {
    cubes.push({ x: 0, y: 0.025, z: -0.5, sx: groundWidth, sy: 0.04, sz: 0.11, color: biome.curb });
    if (prevType === "road") {
      cubes.push({ x: 0, y: 0.047, z: -0.49, sx: groundWidth, sy: 0.012, sz: 0.055, color: biome.roadLine });
    } else if (prevType === "water") {
      cubes.push({ x: 0, y: 0.018, z: -0.46, sx: groundWidth, sy: 0.045, sz: 0.1, color: biome.shell });
    }
  } else if (rowType === "road") {
    cubes.push({ x: 0, y: 0.022, z: -0.5, sx: groundWidth, sy: 0.04, sz: 0.1, color: biome.curb });
    cubes.push({ x: 0, y: 0.046, z: -0.5, sx: groundWidth, sy: 0.012, sz: 0.06, color: biome.roadLine });
  } else if (rowType === "water") {
    cubes.push({ x: 0, y: 0.005, z: -0.5, sx: groundWidth, sy: 0.055, sz: 0.12, color: biome.shell });
  } else {
    cubes.push({ x: 0, y: 0.02, z: -0.5, sx: groundWidth, sy: 0.035, sz: 0.1, color: biome.railBed });
  }
}

export function buildStaticRow(row: Row, prevType: RowType | null): THREE.InstancedMesh {
  const biome = BIOMES[row.biome];
  const c: CubeSpec[] = [];
  if (row.type === "grass") {
    c.push({ x: 0, y: -0.085, z: 0, sx: groundWidth, sy: 0.17, sz: 1.012, color: biome.grass[row.variant % 3] });
    // A few broad clumps and low bushes keep the foreground from becoming
    // one flat colour, even in rows already behind the player.
    for (let i = 0; i < 3; i++) {
      const h1 = hash2(row.z, i * 13 + 3, 0x91a);
      const h2 = hash2(row.z, i * 19 + 5, 0x7b3);
      c.push({
        x: (h1 - 0.5) * 30,
        y: 0.002,
        z: (h2 - 0.5) * 0.55,
        sx: 2.4 + h2 * 4.5,
        sy: 0.006,
        sz: 0.16 + h1 * 0.18,
        color: i % 2 === 0 ? biome.grassLight : biome.grassDark
      });
    }
    const bushHash = hash2(row.z, 31, 0xc4f);
    if (bushHash > 0.54) {
      const bx = (bushHash < 0.77 ? -1 : 1) * (4.2 + bushHash * 5.5);
      c.push({ x: bx, y: 0.2, z: 0.02, sx: 0.72, sy: 0.38, sz: 0.58, color: biome.leaves[3] });
      c.push({ x: bx + 0.2, y: 0.18, z: -0.08, sx: 0.42, sy: 0.27, sz: 0.45, color: biome.leavesLight[1] });
      c.push({ x: bx, y: 0.018, z: 0, sx: 0.95, sy: 0.012, sz: 0.8, color: biome.grassDark });
      if (bushHash > 0.8) {
        c.push({ x: bx + 0.15, y: 0.4, z: 0.12, sx: 0.07, sy: 0.07, sz: 0.07, color: biome.flowers[0] });
      }
    }
    boundaryCurb(c, prevType, row.type, biome);
    for (const d of row.decor) {
      buildDecor(c, d.x, d.dz, d.kind, d.scale, d.color, biome);
    }
  } else if (row.type === "road") {
    const base = Math.abs(row.z) % 2 === 0 ? biome.road : biome.roadAlt;
    c.push({ x: 0, y: -0.085, z: 0, sx: groundWidth, sy: 0.17, sz: 1.012, color: base });
    const patch = hash2(row.z, 17, 0xabc);
    if (patch > 0.52) {
      c.push({
        x: (patch - 0.75) * 28,
        y: 0.008,
        z: (patch - 0.5) * 0.35,
        sx: 2.2 + patch * 2.2,
        sy: 0.01,
        sz: 0.32,
        color: biome.roadAlt
      });
    }
    if (prevType === "road") {
      for (let x = -groundWidth / 2 + 0.6; x < groundWidth / 2; x += 2.9) {
        c.push({ x: x + 0.6, y: 0.006, z: -0.5, sx: 1.2, sy: 0.01, sz: 0.075, color: biome.roadLine });
      }
    } else {
      boundaryCurb(c, prevType, row.type, biome);
    }
    if (!prevType) {
      c.push({ x: 0, y: 0.046, z: -0.5, sx: groundWidth, sy: 0.012, sz: 0.06, color: biome.roadLine });
    }
  } else if (row.type === "water") {
    c.push({ x: 0, y: -0.11, z: 0, sx: groundWidth, sy: 0.15, sz: 1.012, color: biome.waterDeep });
    boundaryCurb(c, prevType, row.type, biome);
    if (prevType === "water") {
      c.push({ x: 0, y: -0.018, z: -0.42, sx: groundWidth, sy: 0.025, sz: 0.04, color: biome.waterLight });
    }
  } else {
    c.push({ x: 0, y: -0.085, z: 0, sx: groundWidth, sy: 0.17, sz: 1.012, color: biome.railBed });
    boundaryCurb(c, prevType, row.type, biome);
    for (let x = -groundWidth / 2; x < groundWidth / 2; x += 2.1) {
      c.push({ x, y: 0.012, z: 0, sx: 0.24, sy: 0.035, sz: 0.9, color: biome.sleeper });
    }
    for (const z of [-0.25, 0.25]) {
      c.push({ x: 0, y: 0.045, z, sx: groundWidth, sy: 0.07, sz: 0.11, color: biome.rail });
      c.push({ x: 0, y: 0.083, z, sx: groundWidth, sy: 0.016, sz: 0.06, color: biome.railLight });
    }
    for (const sign of row.signs) {
      c.push({ x: sign.x, y: 0.75, z: 0.6, sx: 0.09, sy: 1.5, sz: 0.09, color: biome.deadWood });
      c.push({ x: sign.x, y: 1.38, z: 0.6, sx: 0.4, sy: 0.4, sz: 0.06, color: biome.snow });
      c.push({ x: sign.x, y: 1.42, z: 0.56, sx: 0.28, sy: 0.28, sz: 0.03, color: biome.curb });
      c.push({ x: sign.x, y: 1.12, z: 0.56, sx: 0.12, sy: 0.12, sz: 0.06, color: 0xff4637 });
      c.push({ x: sign.x, y: 1.12, z: 0.53, sx: 0.06, sy: 0.06, sz: 0.03, color: 0xffd7b0 });
      c.push({ x: sign.x, y: 1.61, z: 0.6, sx: 0.72, sy: 0.08, sz: 0.04, color: biome.snow, rz: 0.62 });
      c.push({ x: sign.x, y: 1.61, z: 0.6, sx: 0.72, sy: 0.08, sz: 0.04, color: biome.snow, rz: -0.62 });
      c.push({ x: sign.x - 0.16, y: 1.1, z: 0.55, sx: 0.08, sy: 0.08, sz: 0.06, color: 0x791f28 });
      c.push({ x: sign.x + 0.16, y: 1.1, z: 0.55, sx: 0.08, sy: 0.08, sz: 0.06, color: 0x791f28 });
    }
  }

  return createVoxelMesh(c);
}

export function buildRailGlows(row: Row): THREE.Sprite[] {
  if (row.type !== "rail") return [];
  const material = new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: 0xff4a35,
    transparent: true,
    depthWrite: false,
    opacity: 0
  });
  const sprites: THREE.Sprite[] = [];
  for (const sign of row.signs) {
    for (const dx of [-0.16, 0.16]) {
      const sprite = new THREE.Sprite(material);
      sprite.position.set(sign.x + dx, 1.12, 0.6);
      sprite.scale.set(0.42, 0.42, 1);
      row.group.add(sprite);
      sprites.push(sprite);
    }
  }
  return sprites;
}

let glowTexture: THREE.CanvasTexture | null = null;
function makeGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,250,214,1)");
  grad.addColorStop(0.18, "rgba(255,86,86,1)");
  grad.addColorStop(0.55, "rgba(255,50,50,0.55)");
  grad.addColorStop(1, "rgba(255,30,30,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  glowTexture.magFilter = THREE.NearestFilter;
  glowTexture.minFilter = THREE.NearestFilter;
  return glowTexture;
}

export function buildPropsMesh(props: PropData[], biomeId: BiomeId): THREE.InstancedMesh | null {
  if (props.length === 0) return null;
  const biome = BIOMES[biomeId];
  const c: CubeSpec[] = [];
  for (const p of props) {
    const s = p.scale;
    const shadow = (sx: number, sz: number): void => {
      c.push({ x: p.x, y: 0.018, z: 0, sx: sx * s, sy: 0.012, sz: sz * s, color: biome.grassDark });
    };
    switch (p.kind) {
      case "tree": {
        if (biomeId === "autumn") {
          const tall = p.variant % 3 === 0;
          c.push({ x: p.x, y: 0.24 * s, z: 0, sx: 0.25 * s, sy: 0.48 * s, sz: 0.25 * s, color: biome.trunk });
          c.push({ x: p.x, y: 0.7 * s, z: 0, sx: 0.94 * s, sy: 0.62 * s, sz: 0.82 * s, color: biome.leaves[0] });
          c.push({ x: p.x + 0.04 * s, y: 1.16 * s, z: -0.02 * s, sx: 0.72 * s, sy: 0.5 * s, sz: 0.66 * s, color: biome.leaves[2] });
          if (tall) {
            c.push({ x: p.x - 0.03 * s, y: 1.52 * s, z: 0.02 * s, sx: 0.48 * s, sy: 0.36 * s, sz: 0.45 * s, color: biome.leavesLight[0] });
          }
          shadow(1.2, 1.0);
          break;
        }
        c.push({ x: p.x, y: 0.5 * s, z: 0, sx: 0.3 * s, sy: 1.0 * s, sz: 0.3 * s, color: biome.trunk });
        if (p.variant === 1) {
          c.push({ x: p.x, y: (0.9 + 0.23) * s, z: 0, sx: 1.35 * s, sy: 0.46 * s, sz: 1.2 * s, color: biome.leaves[0] });
          c.push({ x: p.x, y: (1.22 + 0.21) * s, z: 0, sx: 1.05 * s, sy: 0.42 * s, sz: 0.94 * s, color: biome.leaves[2] });
          c.push({ x: p.x, y: (1.56 + 0.2) * s, z: 0, sx: 0.75 * s, sy: 0.4 * s, sz: 0.68 * s, color: biome.leavesLight[1] });
          c.push({ x: p.x, y: (1.88 + 0.17) * s, z: 0, sx: 0.42 * s, sy: 0.33 * s, sz: 0.4 * s, color: biome.leaves[1] });
        } else {
          c.push({ x: p.x, y: (0.86 + 0.28) * s, z: 0, sx: 1.08 * s, sy: 0.56 * s, sz: 1.02 * s, color: biome.leaves[p.variant % 4] });
          c.push({ x: p.x + 0.06 * s, y: (1.3 + 0.24) * s, z: -0.08 * s, sx: 0.82 * s, sy: 0.48 * s, sz: 0.8 * s, color: biome.leaves[(p.variant + 1) % 4] });
          c.push({ x: p.x - 0.1 * s, y: (1.66 + 0.19) * s, z: 0.07 * s, sx: 0.5 * s, sy: 0.38 * s, sz: 0.5 * s, color: biome.leavesLight[p.variant % 3] });
          if (p.variant === 2) {
            c.push({ x: p.x - 0.3 * s, y: 1.31 * s, z: 0.44 * s, sx: 0.1, sy: 0.1, sz: 0.1, color: biome.flowers[0] });
            c.push({ x: p.x + 0.35 * s, y: 1.48 * s, z: 0.17 * s, sx: 0.09, sy: 0.09, sz: 0.09, color: biome.flowers[1] });
            c.push({ x: p.x + 0.06 * s, y: 1.82 * s, z: 0.34 * s, sx: 0.1, sy: 0.1, sz: 0.1, color: biome.flowers[2] });
          }
        }
        shadow(1.4, 1.2);
        break;
      }
      case "pine": {
        c.push({ x: p.x, y: 0.45 * s, z: 0, sx: 0.24 * s, sy: 0.9 * s, sz: 0.24 * s, color: biome.trunk });
        c.push({ x: p.x, y: 0.82 * s, z: 0, sx: 1.2 * s, sy: 0.32 * s, sz: 1.08 * s, color: biome.leaves[1] });
        c.push({ x: p.x, y: 1.08 * s, z: 0, sx: 0.92 * s, sy: 0.3 * s, sz: 0.82 * s, color: biome.leaves[0] });
        c.push({ x: p.x, y: 1.32 * s, z: 0, sx: 0.64 * s, sy: 0.28 * s, sz: 0.58 * s, color: biome.leavesLight[0] });
        c.push({ x: p.x, y: 1.53 * s, z: 0, sx: 0.34 * s, sy: 0.22 * s, sz: 0.32 * s, color: biome.leaves[2] });
        if (biomeId === "frost") {
          c.push({ x: p.x, y: 1.66 * s, z: 0, sx: 0.34 * s, sy: 0.04 * s, sz: 0.32 * s, color: biome.snow });
          c.push({ x: p.x, y: 1.42 * s, z: 0.12 * s, sx: 0.5 * s, sy: 0.035 * s, sz: 0.28 * s, color: biome.snow });
        }
        shadow(1.25, 1.05);
        break;
      }
      case "palm": {
        c.push({ x: p.x, y: 0.38 * s, z: 0, sx: 0.26 * s, sy: 0.76 * s, sz: 0.26 * s, color: biome.trunk });
        c.push({ x: p.x + 0.1 * s, y: 0.92 * s, z: 0, sx: 0.22 * s, sy: 0.42 * s, sz: 0.22 * s, color: biome.trunk });
        c.push({ x: p.x + 0.2 * s, y: 1.2 * s, z: 0, sx: 0.18 * s, sy: 0.26 * s, sz: 0.18 * s, color: biome.trunk });
        const leaf = biome.palmLeaf;
        c.push({ x: p.x - 0.5 * s, y: 1.36 * s, z: 0, sx: 0.95 * s, sy: 0.08 * s, sz: 0.26 * s, color: leaf, rz: 0.18 });
        c.push({ x: p.x + 0.55 * s, y: 1.34 * s, z: 0, sx: 0.95 * s, sy: 0.08 * s, sz: 0.26 * s, color: leaf, rz: -0.18 });
        c.push({ x: p.x, y: 1.38 * s, z: -0.45 * s, sx: 0.24 * s, sy: 0.08 * s, sz: 0.9 * s, color: leaf, rx: 0.18 });
        c.push({ x: p.x, y: 1.36 * s, z: 0.45 * s, sx: 0.24 * s, sy: 0.08 * s, sz: 0.9 * s, color: leaf, rx: -0.18 });
        c.push({ x: p.x, y: 1.45 * s, z: 0, sx: 0.28 * s, sy: 0.08 * s, sz: 0.28 * s, color: biome.leavesLight[0] });
        c.push({ x: p.x + 0.1 * s, y: 1.3 * s, z: 0.12 * s, sx: 0.1 * s, sy: 0.1 * s, sz: 0.1 * s, color: biome.mushroom });
        shadow(1.2, 1.0);
        break;
      }
      case "cactus": {
        c.push({ x: p.x, y: 0.58 * s, z: 0, sx: 0.38 * s, sy: 1.16 * s, sz: 0.34 * s, color: biome.cactus });
        c.push({ x: p.x - 0.32 * s, y: 0.7 * s, z: 0, sx: 0.3 * s, sy: 0.24 * s, sz: 0.24 * s, color: biome.cactus });
        c.push({ x: p.x - 0.42 * s, y: 0.95 * s, z: 0, sx: 0.22 * s, sy: 0.52 * s, sz: 0.22 * s, color: biome.cactus });
        c.push({ x: p.x + 0.28 * s, y: 0.55 * s, z: 0, sx: 0.26 * s, sy: 0.2 * s, sz: 0.22 * s, color: biome.cactus });
        c.push({ x: p.x + 0.38 * s, y: 0.76 * s, z: 0, sx: 0.2 * s, sy: 0.4 * s, sz: 0.2 * s, color: biome.cactus });
        for (let i = 0; i < 4; i++) {
          c.push({ x: p.x + 0.1 * s, y: (0.3 + i * 0.2) * s, z: -0.18 * s, sx: 0.05, sy: 0.05, sz: 0.05, color: biome.bone });
        }
        c.push({ x: p.x, y: 1.2 * s, z: 0.1 * s, sx: 0.14 * s, sy: 0.08 * s, sz: 0.14 * s, color: biome.flowers[0] });
        shadow(0.9, 0.75);
        break;
      }
      case "deadTree": {
        c.push({ x: p.x, y: 0.55 * s, z: 0, sx: 0.26 * s, sy: 1.1 * s, sz: 0.26 * s, color: biome.deadWood });
        c.push({ x: p.x - 0.3 * s, y: 0.86 * s, z: 0, sx: 0.65 * s, sy: 0.11 * s, sz: 0.11 * s, color: biome.deadWood, rz: 0.5 });
        c.push({ x: p.x + 0.28 * s, y: 1.05 * s, z: 0.05 * s, sx: 0.62 * s, sy: 0.1 * s, sz: 0.1 * s, color: biome.deadWood, rz: -0.55 });
        c.push({ x: p.x - 0.16 * s, y: 1.2 * s, z: -0.1 * s, sx: 0.42 * s, sy: 0.09 * s, sz: 0.09 * s, color: biome.deadWood, rz: 0.7 });
        if (biomeId === "lava") {
          c.push({ x: p.x, y: 1.16 * s, z: 0, sx: 0.1, sy: 0.1, sz: 0.1, color: biome.ember });
          c.push({ x: p.x + 0.2 * s, y: 1.05 * s, z: 0.08 * s, sx: 0.06, sy: 0.06, sz: 0.06, color: biome.ember });
        }
        shadow(1.0, 0.85);
        break;
      }
      case "crystal": {
        c.push({ x: p.x, y: 0.16 * s, z: 0, sx: 0.8 * s, sy: 0.32 * s, sz: 0.7 * s, color: biome.rockDark });
        c.push({ x: p.x - 0.18 * s, y: 0.7 * s, z: 0, sx: 0.26 * s, sy: 1.1 * s, sz: 0.24 * s, color: biome.crystal, rz: 0.12 });
        c.push({ x: p.x + 0.24 * s, y: 0.58 * s, z: 0.08 * s, sx: 0.2 * s, sy: 0.8 * s, sz: 0.2 * s, color: biome.leavesLight[1], rz: -0.28 });
        c.push({ x: p.x + 0.02 * s, y: 0.9 * s, z: -0.2 * s, sx: 0.18 * s, sy: 1.2 * s, sz: 0.18 * s, color: biome.crystal, rz: 0.05 });
        shadow(0.9, 0.75);
        break;
      }
      case "mushroom": {
        c.push({ x: p.x, y: 0.22 * s, z: 0, sx: 0.3 * s, sy: 0.44 * s, sz: 0.28 * s, color: biome.bone });
        c.push({ x: p.x, y: 0.35 * s, z: 0, sx: 1.05 * s, sy: 0.32 * s, sz: 0.95 * s, color: biome.mushroom });
        c.push({ x: p.x - 0.25 * s, y: 0.54 * s, z: 0.06 * s, sx: 0.18 * s, sy: 0.08 * s, sz: 0.18 * s, color: biome.snow });
        c.push({ x: p.x + 0.22 * s, y: 0.55 * s, z: -0.12 * s, sx: 0.14 * s, sy: 0.07 * s, sz: 0.14 * s, color: biome.snow });
        shadow(1.0, 0.8);
        break;
      }
      case "pumpkin": {
        c.push({ x: p.x, y: 0.26 * s, z: 0, sx: 0.9 * s, sy: 0.52 * s, sz: 0.8 * s, color: biome.pumpkin });
        c.push({ x: p.x - 0.22 * s, y: 0.27 * s, z: 0, sx: 0.16 * s, sy: 0.48 * s, sz: 0.82 * s, color: biome.ember });
        c.push({ x: p.x + 0.22 * s, y: 0.27 * s, z: 0, sx: 0.16 * s, sy: 0.48 * s, sz: 0.82 * s, color: biome.ember });
        c.push({ x: p.x, y: 0.56 * s, z: 0, sx: 0.12 * s, sy: 0.16 * s, sz: 0.12 * s, color: biome.trunk });
        c.push({ x: p.x - 0.16 * s, y: 0.33 * s, z: 0.42 * s, sx: 0.12 * s, sy: 0.1 * s, sz: 0.03, color: biome.deadWood });
        c.push({ x: p.x + 0.16 * s, y: 0.33 * s, z: 0.42 * s, sx: 0.12 * s, sy: 0.1 * s, sz: 0.03, color: biome.deadWood });
        shadow(1.0, 0.85);
        break;
      }
      case "rock": {
        c.push({ x: p.x, y: 0.26 * s, z: 0, sx: 0.82 * s, sy: 0.5 * s, sz: 0.7 * s, color: biome.rock });
        c.push({ x: p.x + 0.26 * s, y: 0.14 * s, z: -0.1 * s, sx: 0.42 * s, sy: 0.28 * s, sz: 0.46 * s, color: biome.rockDark });
        c.push({ x: p.x - 0.08 * s, y: 0.52 * s, z: -0.02 * s, sx: 0.55 * s, sy: 0.08 * s, sz: 0.45 * s, color: biome.rockLight });
        c.push({ x: p.x - 0.2 * s, y: 0.57 * s, z: 0.1 * s, sx: 0.24 * s, sy: 0.05 * s, sz: 0.2 * s, color: biome.leaves[3] });
        shadow(1.0, 0.9);
        break;
      }
      case "bush": {
        c.push({ x: p.x, y: 0.2 * s, z: 0, sx: 0.74 * s, sy: 0.38 * s, sz: 0.62 * s, color: biome.leaves[3] });
        c.push({ x: p.x + 0.22 * s, y: 0.18 * s, z: -0.08 * s, sx: 0.45 * s, sy: 0.3 * s, sz: 0.48 * s, color: biome.leavesLight[p.variant % 3] });
        c.push({ x: p.x - 0.18 * s, y: 0.34 * s, z: 0.08 * s, sx: 0.22 * s, sy: 0.18 * s, sz: 0.18 * s, color: biome.leaves[1] });
        if (p.variant % 2 === 0) {
          c.push({ x: p.x + 0.18 * s, y: 0.44 * s, z: 0.15 * s, sx: 0.07, sy: 0.07, sz: 0.07, color: biome.flowers[1] });
          c.push({ x: p.x - 0.25 * s, y: 0.34 * s, z: -0.14 * s, sx: 0.06, sy: 0.06, sz: 0.06, color: biome.flowers[0] });
        }
        shadow(0.95, 0.8);
        break;
      }
      case "stump": {
        c.push({ x: p.x, y: 0.18 * s, z: 0, sx: 0.5 * s, sy: 0.36 * s, sz: 0.5 * s, color: biome.trunk });
        c.push({ x: p.x, y: 0.38 * s, z: 0, sx: 0.44 * s, sy: 0.06 * s, sz: 0.44 * s, color: biome.rockLight });
        c.push({ x: p.x - 0.1 * s, y: 0.44 * s, z: -0.05 * s, sx: 0.13 * s, sy: 0.025 * s, sz: 0.13 * s, color: biome.rock });
        shadow(0.8, 0.7);
        break;
      }
      case "bones": {
        c.push({ x: p.x, y: 0.12 * s, z: 0, sx: 0.85 * s, sy: 0.12 * s, sz: 0.16 * s, color: biome.bone, rz: 0.12 });
        for (let i = 0; i < 3; i++) {
          c.push({ x: p.x - 0.2 * s + i * 0.2 * s, y: 0.22 * s, z: 0, sx: 0.08 * s, sy: 0.26 * s, sz: 0.08 * s, color: biome.bone });
        }
        c.push({ x: p.x + 0.32 * s, y: 0.1 * s, z: 0.08 * s, sx: 0.2 * s, sy: 0.12 * s, sz: 0.2 * s, color: biome.bone });
        shadow(0.9, 0.6);
        break;
      }
      case "snowman": {
        c.push({ x: p.x, y: 0.25 * s, z: 0, sx: 0.62 * s, sy: 0.5 * s, sz: 0.56 * s, color: biome.snow });
        c.push({ x: p.x, y: 0.65 * s, z: 0, sx: 0.44 * s, sy: 0.36 * s, sz: 0.4 * s, color: biome.snow });
        c.push({ x: p.x - 0.1 * s, y: 0.72 * s, z: 0.21 * s, sx: 0.06, sy: 0.06, sz: 0.03, color: biome.deadWood });
        c.push({ x: p.x + 0.1 * s, y: 0.72 * s, z: 0.21 * s, sx: 0.06, sy: 0.06, sz: 0.03, color: biome.deadWood });
        c.push({ x: p.x, y: 0.64 * s, z: 0.24 * s, sx: 0.08 * s, sy: 0.08 * s, sz: 0.14 * s, color: biome.pumpkin });
        c.push({ x: p.x, y: 0.84 * s, z: 0, sx: 0.38 * s, sy: 0.06 * s, sz: 0.36 * s, color: biome.deadWood });
        shadow(0.85, 0.7);
        break;
      }
      case "obelisk": {
        c.push({ x: p.x, y: 0.15 * s, z: 0, sx: 0.75 * s, sy: 0.3 * s, sz: 0.65 * s, color: biome.rockDark });
        c.push({ x: p.x, y: 0.9 * s, z: 0, sx: 0.42 * s, sy: 1.2 * s, sz: 0.4 * s, color: biome.rock });
        c.push({ x: p.x, y: 1.55 * s, z: 0, sx: 0.26 * s, sy: 0.3 * s, sz: 0.24 * s, color: biome.rockLight });
        c.push({ x: p.x, y: 0.86 * s, z: 0.22 * s, sx: 0.12 * s, sy: 0.36 * s, sz: 0.02, color: biome.crystal });
        c.push({ x: p.x, y: 1.16 * s, z: 0.22 * s, sx: 0.2 * s, sy: 0.08 * s, sz: 0.02, color: biome.crystal });
        shadow(0.9, 0.8);
        break;
      }
      case "ice":
      default: {
        c.push({ x: p.x, y: 0.16 * s, z: 0, sx: 0.7 * s, sy: 0.32 * s, sz: 0.62 * s, color: biome.rockDark });
        c.push({ x: p.x - 0.16 * s, y: 0.55 * s, z: 0, sx: 0.28 * s, sy: 0.9 * s, sz: 0.26 * s, color: biome.ice, rz: 0.14 });
        c.push({ x: p.x + 0.2 * s, y: 0.44 * s, z: 0.08 * s, sx: 0.22 * s, sy: 0.64 * s, sz: 0.22 * s, color: biome.waterLight, rz: -0.25 });
        c.push({ x: p.x, y: 0.34 * s, z: -0.16 * s, sx: 0.18 * s, sy: 0.5 * s, sz: 0.18 * s, color: biome.snow, rz: 0.06 });
        shadow(0.95, 0.8);
        break;
      }
    }
  }
  return createVoxelMesh(c);
}

function buildDecor(
  c: CubeSpec[],
  x: number,
  dz: number,
  kind: BiomeDecorKind,
  scale: number,
  color: number,
  biome: BiomeDef
): void {
  if (kind === "flower") {
    c.push({ x, y: 0.08 * scale, z: dz, sx: 0.025, sy: 0.16 * scale, sz: 0.025, color: biome.grassDark });
    c.push({ x, y: 0.17 * scale, z: dz, sx: 0.11 * scale, sy: 0.09 * scale, sz: 0.11 * scale, color });
    c.push({ x: x - 0.02, y: 0.19 * scale, z: dz - 0.018, sx: 0.035 * scale, sy: 0.035 * scale, sz: 0.035 * scale, color: biome.flowers[0] });
  } else if (kind === "tuft") {
    c.push({ x, y: 0.07 * scale, z: dz, sx: 0.055 * scale, sy: 0.14 * scale, sz: 0.05 * scale, color });
    c.push({ x: x + 0.07 * scale, y: 0.05 * scale, z: dz - 0.04, sx: 0.04 * scale, sy: 0.1 * scale, sz: 0.04 * scale, color: biome.grassLight });
    c.push({ x: x - 0.06 * scale, y: 0.04 * scale, z: dz + 0.03, sx: 0.035 * scale, sy: 0.08 * scale, sz: 0.035 * scale, color: biome.grassDark });
  } else if (kind === "pebble") {
    c.push({ x, y: 0.025 * scale, z: dz, sx: 0.12 * scale, sy: 0.045 * scale, sz: 0.09 * scale, color });
    c.push({ x: x + 0.025 * scale, y: 0.055 * scale, z: dz - 0.01, sx: 0.055 * scale, sy: 0.025 * scale, sz: 0.05 * scale, color: biome.rockLight });
  } else if (kind === "mushroom") {
    c.push({ x, y: 0.04 * scale, z: dz, sx: 0.035 * scale, sy: 0.09 * scale, sz: 0.035 * scale, color: biome.bone });
    c.push({ x, y: 0.11 * scale, z: dz, sx: 0.14 * scale, sy: 0.07 * scale, sz: 0.12 * scale, color });
    c.push({ x: x - 0.025, y: 0.15 * scale, z: dz, sx: 0.025, sy: 0.02, sz: 0.025, color: biome.snow });
  } else if (kind === "shell") {
    c.push({ x, y: 0.025 * scale, z: dz, sx: 0.16 * scale, sy: 0.045 * scale, sz: 0.12 * scale, color });
    c.push({ x, y: 0.065 * scale, z: dz, sx: 0.08 * scale, sy: 0.03 * scale, sz: 0.06 * scale, color: biome.waterLight });
    c.push({ x: x + 0.05 * scale, y: 0.06 * scale, z: dz - 0.03, sx: 0.03, sy: 0.03, sz: 0.03, color: biome.flowers[1] });
  } else if (kind === "crystal") {
    c.push({ x, y: 0.1 * scale, z: dz, sx: 0.07 * scale, sy: 0.2 * scale, sz: 0.06 * scale, color, rz: 0.2 });
    c.push({ x: x + 0.06 * scale, y: 0.06 * scale, z: dz, sx: 0.045 * scale, sy: 0.12 * scale, sz: 0.045 * scale, color: biome.crystal, rz: -0.3 });
  } else if (kind === "ember") {
    c.push({ x, y: 0.04 * scale, z: dz, sx: 0.08 * scale, sy: 0.06 * scale, sz: 0.07 * scale, color });
    c.push({ x: x - 0.04, y: 0.08 * scale, z: dz + 0.02, sx: 0.04, sy: 0.04, sz: 0.04, color: biome.ember });
  } else {
    c.push({ x, y: 0.04 * scale, z: dz, sx: 0.11 * scale, sy: 0.025 * scale, sz: 0.025 * scale, color: biome.snow });
    c.push({ x, y: 0.04 * scale, z: dz, sx: 0.025, sy: 0.025, sz: 0.11 * scale, color: biome.snow });
    c.push({ x: x + 0.05 * scale, y: 0.04 * scale, z: dz, sx: 0.02, sy: 0.02, sz: 0.02, color: biome.waterLight });
  }
}

export function updateRailGlows(row: Row, time: number): void {
  if (!row.glowLights || row.glowLights.length === 0) return;
  const train = row.train;
  if (!train) return;
  const warn = train.warned || train.active;
  const blink = Math.sin(time * 15) > -0.15 ? 1 : 0.2;
  for (const sprite of row.glowLights) {
    const material = sprite.material as THREE.SpriteMaterial;
    material.opacity = warn ? 0.8 * blink : 0;
    sprite.visible = warn;
  }
}
