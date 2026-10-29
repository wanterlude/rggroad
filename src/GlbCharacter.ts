import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DITOSHEY_GLB } from "./assets/models/ditosheyGlb";

export type GlbCharacterId = "ditoshey";

const templates = new Map<GlbCharacterId, THREE.Group>();
const waiting: Partial<Record<GlbCharacterId, Array<(model: THREE.Group | null) => void>>> = {};

function decodeBase64(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function normalize(model: THREE.Group): THREE.Group {
  const wrapper = new THREE.Group();
  wrapper.add(model);
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = 1.55 / Math.max(0.001, size.y);
  model.scale.setScalar(scale);
  box.setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  return wrapper;
}

function parse(id: GlbCharacterId, base64: string): Promise<THREE.Group | null> {
  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.parse(decodeBase64(base64), "", (gltf) => {
      const model = normalize(gltf.scene);
      templates.set(id, model);
      const callbacks = waiting[id] ?? [];
      delete waiting[id];
      for (const callback of callbacks) callback(model);
      resolve(model);
    }, (error) => {
      console.error("GLB load failed", id, error);
      const callbacks = waiting[id] ?? [];
      delete waiting[id];
      for (const callback of callbacks) callback(null);
      resolve(null);
    });
  });
}

const ready: Partial<Record<GlbCharacterId, Promise<THREE.Group | null>>> = {
  ditoshey: parse("ditoshey", DITOSHEY_GLB)
};

export function cloneGlbCharacter(id: GlbCharacterId): THREE.Group | null {
  const template = templates.get(id);
  return template ? template.clone(true) : null;
}

export function waitForGlbCharacter(id: GlbCharacterId, callback: (model: THREE.Group | null) => void): void {
  const template = templates.get(id);
  if (template) {
    callback(template);
    return;
  }
  if (!waiting[id]) waiting[id] = [];
  waiting[id]!.push(callback);
  void ready[id];
}
