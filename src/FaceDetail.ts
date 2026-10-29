import * as THREE from "three";

/* --------------------------------------------------------------------------
   Detailed 2.5D faces for the two biggest chibi characters.
   The body stays voxel-styled, while the head gets a soft face plate,
   layered eyes, lashes, glasses and sculpted fringe locks.
   -------------------------------------------------------------------------- */

const faceSphere = new THREE.SphereGeometry(1, 24, 18);
const faceBox = new THREE.BoxGeometry(1, 1, 1);
const faceTorus = new THREE.TorusGeometry(1, 0.11, 8, 24);
const faceMaterials = new Map<number, THREE.MeshStandardMaterial>();

function faceMaterial(color: number, opacity = 1): THREE.MeshStandardMaterial {
  const key = color * 1000 + Math.round(opacity * 100);
  const cached = faceMaterials.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.66,
    metalness: 0,
    transparent: opacity < 1,
    opacity
  });
  faceMaterials.set(key, material);
  return material;
}

function faceBall(
  parent: THREE.Group,
  color: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rotationZ = 0,
  opacity = 1
): void {
  const mesh = new THREE.Mesh(faceSphere, faceMaterial(color, opacity));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.rotation.z = rotationZ;
  parent.add(mesh);
}

function faceBar(
  parent: THREE.Group,
  color: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rotationZ = 0
): void {
  const mesh = new THREE.Mesh(faceBox, faceMaterial(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.rotation.z = rotationZ;
  parent.add(mesh);
}

function faceArc(
  parent: THREE.Group,
  color: number,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  thickness: number
): void {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-width / 2, 0, 0),
    new THREE.Vector3(0, height, 0),
    new THREE.Vector3(width / 2, 0, 0)
  ]);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, thickness, 6, false), faceMaterial(color));
  mesh.position.set(x, y, z);
  parent.add(mesh);
}

export interface FaceOptions {
  iris?: number;
  irisLight?: number;
  pupil?: number;
  lash?: number;
}

interface FaceConfig {
  eyeX: number;
  eyeY: number;
  z: number;
  eyeW: number;
  eyeH: number;
  irisW: number;
  irisH: number;
  mouthY: number;
  noseY: number;
  blushX: number;
  blushY: number;
  browY: number;
}

export function buildDetailedFace(
  style: "higanbanban" | "ditoshey" | "moryaka" | "severina",
  options: FaceOptions = {}
): THREE.Group {
  const g = new THREE.Group();
  const isDito = style === "ditoshey";
  const isHigan = style === "higanbanban";
  const isMoryaka = style === "moryaka";
  const isSeverina = style === "severina";
  const cfg: FaceConfig = isMoryaka
    ? { eyeX: 0.145, eyeY: 0.86, z: 0.35, eyeW: 0.105, eyeH: 0.09, irisW: 0.082, irisH: 0.075, mouthY: 0.745, noseY: 0.795, blushX: 0.24, blushY: 0.815, browY: 0.97 }
    : isSeverina
      ? { eyeX: 0.1, eyeY: 0.755, z: 0.305, eyeW: 0.095, eyeH: 0.075, irisW: 0.072, irisH: 0.062, mouthY: 0.67, noseY: 0.69, blushX: 0.18, blushY: 0.69, browY: 0.83 }
      : { eyeX: 0.105, eyeY: 0.895, z: 0.29, eyeW: 0.09, eyeH: 0.075, irisW: 0.065, irisH: 0.06, mouthY: 0.815, noseY: 0.855, blushX: 0.18, blushY: 0.842, browY: 1.005 };
  const iris = options.iris ?? (isHigan ? 0xff6a2f : isMoryaka ? 0xffa12e : isSeverina ? 0x6fd3d0 : 0x9fd36b);
  const irisLight = options.irisLight ?? (isHigan ? 0xffc05b : isMoryaka ? 0xffd27a : isSeverina ? 0xb8f5e8 : 0xd7ef9d);
  const pupil = options.pupil ?? (isHigan ? 0x2a1117 : isMoryaka ? 0x3a2017 : 0x203020);
  const lash = options.lash ?? (isHigan ? 0x211518 : isMoryaka ? 0x5b3a2e : isSeverina ? 0x3a2a4a : 0x342728);
  const brow = isHigan ? 0x193f37 : isMoryaka ? 0x5b3a2e : isSeverina ? 0x6a4e7a : 0xd98a91;
  const gold = 0xe9c46a;

  // Original voxel head forms stay untouched; these are the detailed features.
  for (const side of [-1, 1]) {
    const ex = side * cfg.eyeX;
    faceBall(g, 0xfff8ec, ex, cfg.eyeY, cfg.z, cfg.eyeW, cfg.eyeH, 0.018);
    faceBall(g, iris, ex, cfg.eyeY - 0.002, cfg.z + 0.009, cfg.irisW, cfg.irisH, 0.012, side * 0.035);
    faceBall(g, irisLight, ex, cfg.eyeY - 0.012, cfg.z + 0.015, cfg.irisW * 0.6, cfg.irisH * 0.6, 0.008);
    faceBall(g, pupil, ex, cfg.eyeY - 0.004, cfg.z + 0.019, cfg.irisW * 0.4, cfg.irisH * 0.7, 0.006);
    faceBall(g, 0xffffff, ex - 0.022, cfg.eyeY + 0.022, cfg.z + 0.024, 0.014, 0.017, 0.005);
    faceBall(g, 0xffffff, ex + 0.022, cfg.eyeY - 0.019, cfg.z + 0.023, 0.008, 0.01, 0.004);
    // A soft curved lash line, not an angry slanted wing.
    faceArc(g, lash, ex, cfg.eyeY + cfg.eyeH * 0.58, cfg.z + 0.016, cfg.eyeW * 2.05, 0.022, 0.006);
    faceArc(g, lash, ex, cfg.eyeY - cfg.eyeH * 0.62, cfg.z + 0.014, cfg.eyeW * 1.55, -0.012, 0.004);
    // Thin, gently arched brows only where the hairstyle exposes them.
    if (!isMoryaka && !isSeverina) {
      faceArc(g, brow, ex, cfg.browY, cfg.z + 0.006, 0.085, 0.016, 0.0045);
    }
    // Blush.
    faceBall(g, 0xf6a6a6, side * cfg.blushX, cfg.blushY, cfg.z, 0.05, 0.022, 0.01, 0, 0.55);
  }

  if (isDito) {
    // Thin round gold glasses.
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(faceTorus, faceMaterial(gold));
      ring.position.set(side * 0.105, 0.895, 0.315);
      ring.scale.setScalar(0.095);
      g.add(ring);
      faceBar(g, gold, side * 0.19, 0.895, 0.305, 0.06, 0.012, 0.012);
    }
    faceBar(g, gold, 0, 0.895, 0.315, 0.055, 0.012, 0.012);
    faceBar(g, gold, 0, 0.895, 0.315, 0.12, 0.012, 0.012);
  }

  // Nose and a small curved smile.
  faceBall(g, isMoryaka ? 0x9b5a5a : isSeverina ? 0xd8a0a8 : 0xe6a99f, 0, cfg.noseY, cfg.z + 0.006, 0.018, 0.013, 0.009);
  const mw = isMoryaka ? 0.032 : 0.042;
  const mouthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-mw, cfg.mouthY, cfg.z + 0.008),
    new THREE.Vector3(0, cfg.mouthY - 0.008, cfg.z + 0.012),
    new THREE.Vector3(mw, cfg.mouthY, cfg.z + 0.008)
  ]);
  const mouth = new THREE.Mesh(new THREE.TubeGeometry(mouthCurve, 10, 0.006, 6, false), faceMaterial(isMoryaka ? 0x8e4b4b : 0x9b4e52));
  g.add(mouth);

  return g;
}

