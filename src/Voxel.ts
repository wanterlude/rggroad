import * as THREE from "three";
import type { CubeSpec } from "./types";

export const unitBox = new THREE.BoxGeometry(1, 1, 1);
export const voxelMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

let shadowTexture: THREE.CanvasTexture | null = null;
let shadowMaterial: THREE.MeshBasicMaterial | null = null;
const shadowGeometry = new THREE.PlaneGeometry(1, 1);
export const blobShadowGeometry = shadowGeometry;
const dummy = new THREE.Object3D();
const scratchColor = new THREE.Color();

function getShadowTexture(): THREE.CanvasTexture {
  if (shadowTexture) return shadowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.03, size / 2, size / 2, size * 0.5);
  gradient.addColorStop(0, "rgba(12, 31, 24, 0.72)");
  gradient.addColorStop(0.42, "rgba(12, 31, 24, 0.38)");
  gradient.addColorStop(1, "rgba(12, 31, 24, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  shadowTexture = new THREE.CanvasTexture(canvas);
  shadowTexture.colorSpace = THREE.SRGBColorSpace;
  return shadowTexture;
}

export function getShadowMaterial(): THREE.MeshBasicMaterial {
  if (!shadowMaterial) {
    shadowMaterial = new THREE.MeshBasicMaterial({
      map: getShadowTexture(),
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      color: 0xffffff,
      side: THREE.DoubleSide
    });
  }
  return shadowMaterial;
}

export function createBlobShadow(width: number, depth: number, y = 0.012): THREE.Mesh {
  const shadow = new THREE.Mesh(shadowGeometry, getShadowMaterial());
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(width, depth, 1);
  shadow.position.y = y;
  shadow.renderOrder = 2;
  return shadow;
}

export function createVoxelMesh(cubes: CubeSpec[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(unitBox, voxelMaterial, Math.max(1, cubes.length));
  for (let i = 0; i < cubes.length; i++) {
    const c = cubes[i];
    dummy.position.set(c.x, c.y, c.z);
    dummy.rotation.set(c.rx ?? 0, c.ry ?? 0, c.rz ?? 0);
    dummy.scale.set(c.sx, c.sy, c.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    scratchColor.setHex(c.color);
    mesh.setColorAt(i, scratchColor);
  }
  mesh.count = cubes.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // Instanced cubes can span far beyond the unit-box geometry. Automatic
  // bounding-sphere culling can therefore hide whole road rows while their
  // cars remain visible. Rows are bounded by the world draw range instead.
  mesh.frustumCulled = false;
  mesh.computeBoundingSphere();
  return mesh;
}

export function addBox(
  cubes: CubeSpec[],
  color: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  ry = 0
): void {
  cubes.push({ x, y, z, sx, sy, sz, color, ry });
}
