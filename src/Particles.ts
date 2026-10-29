import * as THREE from "three";
import { unitBox, voxelMaterial } from "./Voxel";
import type { CubeSpec } from "./types";

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  rot: number;
  spin: number;
}

const capacity = 220;
const dummy = new THREE.Object3D();
const color = new THREE.Color();

export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private particles: Particle[] = [];

  constructor(parent: THREE.Object3D) {
    this.mesh = new THREE.InstancedMesh(unitBox, voxelMaterial, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.count = capacity;
    parent.add(this.mesh);
    for (let i = 0; i < capacity; i++) {
      this.particles.push({
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        gravity: 0,
        life: 0,
        maxLife: 1,
        size: 0.05,
        color: 0xffffff,
        rot: 0,
        spin: 0
      });
    }
    this.updateMatrices();
  }

  spawn(options: {
    x: number;
    y: number;
    z: number;
    vx?: number;
    vy?: number;
    vz?: number;
    gravity?: number;
    life?: number;
    size?: number;
    color: number;
    spin?: number;
  }): void {
    const p = this.particles.find((item) => !item.active);
    if (!p) return;
    p.active = true;
    p.x = options.x;
    p.y = options.y;
    p.z = options.z;
    p.vx = options.vx ?? 0;
    p.vy = options.vy ?? 0;
    p.vz = options.vz ?? 0;
    p.gravity = options.gravity ?? 0;
    p.life = options.life ?? 0.5;
    p.maxLife = p.life;
    p.size = options.size ?? 0.06;
    p.color = options.color;
    p.rot = Math.random() * Math.PI * 2;
    p.spin = options.spin ?? 0;
  }

  burstDust(x: number, z: number, count = 6, colorHex = 0xd8e8b6): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn({
        x: x + Math.cos(a) * 0.15,
        y: 0.1,
        z: z + Math.sin(a) * 0.15,
        vx: Math.cos(a) * (0.4 + Math.random()),
        vy: 0.7 + Math.random() * 0.8,
        vz: Math.sin(a) * (0.4 + Math.random()),
        gravity: 3.5,
        life: 0.3 + Math.random() * 0.25,
        size: 0.035 + Math.random() * 0.06,
        color: colorHex,
        spin: 6
      });
    }
  }

  burstSplash(x: number, z: number): void {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn({
        x: x + Math.cos(a) * 0.2,
        y: 0.06,
        z: z + Math.sin(a) * 0.2,
        vx: Math.cos(a) * (0.7 + Math.random() * 1.5),
        vy: 1.4 + Math.random() * 2.1,
        vz: Math.sin(a) * (0.7 + Math.random() * 1.5),
        gravity: 8,
        life: 0.45 + Math.random() * 0.45,
        size: 0.04 + Math.random() * 0.09,
        color: i % 3 === 0 ? 0xffffff : 0x8be1f4,
        spin: 5
      });
    }
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 0.5,
        y: -0.02,
        z: z + (Math.random() - 0.5) * 0.5,
        size: 0.05,
        color: 0xd8f8ff,
        vy: 0.4,
        gravity: -0.2,
        life: 0.6
      });
    }
  }

  burstCoin(x: number, z: number, value: number): void {
    for (let i = 0; i < 9 + value * 3; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn({
        x,
        y: 0.75,
        z,
        vx: Math.cos(a) * (0.5 + Math.random() * 1.2),
        vy: 0.8 + Math.random() * 1.8,
        vz: Math.sin(a) * (0.5 + Math.random() * 1.2),
        gravity: 3.5,
        life: 0.45 + Math.random() * 0.35,
        size: 0.035 + Math.random() * 0.055,
        color: i % 2 === 0 ? 0xfff3a6 : 0xffd23f,
        spin: 8
      });
    }
  }

  burstFeathers(x: number, z: number, colors: number[]): void {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn({
        x,
        y: 0.55 + Math.random() * 0.5,
        z,
        vx: Math.cos(a) * (0.7 + Math.random() * 1.7),
        vy: 1.4 + Math.random() * 2,
        vz: Math.sin(a) * (0.7 + Math.random() * 1.7),
        gravity: 4.2,
        life: 0.65 + Math.random() * 0.45,
        size: 0.06 + Math.random() * 0.07,
        color: colors[i % colors.length],
        spin: 9
      });
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.spin * dt;
    }
    this.updateMatrices();
  }

  clear(): void {
    for (const p of this.particles) p.active = false;
    this.updateMatrices();
  }

  private updateMatrices(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        dummy.position.set(0, -100, 0);
        dummy.scale.set(0.0001, 0.0001, 0.0001);
      } else {
        const t = clamp01(p.life / p.maxLife);
        const scale = p.size * (0.4 + t * 0.9);
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rot, p.rot * 0.7, p.rot * 0.3);
        dummy.scale.set(scale, scale, scale);
      }
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      if (p.active) {
        color.setHex(p.color);
        this.mesh.setColorAt(i, color);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
