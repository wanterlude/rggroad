import * as THREE from "three";
import { animateWater } from "./RowModels";
import type { BiomeDef } from "./biomes";
import { Particles } from "./Particles";
import { createBlobShadow, createVoxelMesh } from "./Voxel";
import type { CubeSpec } from "./types";

const skyVertex = `
varying vec3 vLocalPosition;
void main() {
  vLocalPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragment = `
varying vec3 vLocalPosition;
void main() {
  float h = normalize(vLocalPosition).y;
  vec3 horizon = vec3(0.76, 0.93, 0.96);
  vec3 low = vec3(0.46, 0.83, 0.97);
  vec3 high = vec3(0.18, 0.55, 0.86);
  vec3 color = mix(horizon, low, smoothstep(-0.02, 0.16, h));
  color = mix(color, high, smoothstep(0.16, 0.78, h));
  gl_FragColor = vec4(color, 1.0);
}
`;

function makeSunTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, "rgba(255, 252, 220, 1)");
  grad.addColorStop(0.18, "rgba(255, 244, 172, 0.95)");
  grad.addColorStop(0.48, "rgba(255, 235, 126, 0.25)");
  grad.addColorStop(1, "rgba(255, 235, 126, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly isoCamera: THREE.OrthographicCamera;
  readonly worldRoot = new THREE.Group();
  readonly farGroup = new THREE.Group();
  readonly particles: Particles;
  readonly playerShadow: THREE.Mesh;
  readonly menuStage: THREE.Group;

  private readonly sky: THREE.Mesh;
  private readonly sun: THREE.Sprite;
  private readonly ground: THREE.Mesh;
  private readonly groundMaterial: THREE.MeshLambertMaterial;
  private readonly hills: THREE.Group;
  private readonly clouds: THREE.InstancedMesh;
  private readonly light: THREE.DirectionalLight;
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly target = new THREE.Object3D();
  private isoHeight = 10.5;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;

    this.scene.background = new THREE.Color(0x8edcef);
    this.scene.fog = new THREE.Fog(0xc4eedf, 34, 108);

    this.camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.1, 360);
    this.camera.position.set(0, 5.5, -8.4);
    this.camera.lookAt(0, 0.95, 0.7);

    this.isoCamera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 300);
    this.isoCamera.position.set(0, 12.5, -10.5);
    this.isoCamera.lookAt(0, 0, 4.5);
    this.updateIsoFrustum();

    this.scene.add(this.worldRoot);
    this.scene.add(this.farGroup);

    // Sky dome.
    const skyGeometry = new THREE.SphereGeometry(180, 32, 18);
    const skyMaterial = new THREE.ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    // Sun.
    const sunMaterial = new THREE.SpriteMaterial({
      map: makeSunTexture(),
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: false
    });
    this.sun = new THREE.Sprite(sunMaterial);
    this.sun.scale.set(18, 18, 1);
    this.sun.position.set(-28, 15, 68);
    this.farGroup.add(this.sun);

    // Soft low-poly clouds.
    this.clouds = this.buildClouds();
    this.farGroup.add(this.clouds);

    // Distant layered hills.
    this.hills = this.buildHills();
    this.hills.visible = false;
    this.farGroup.add(this.hills);

    // A floor that continues past the generated row strip. Its tint follows
    // the current biome.
    const groundGeometry = new THREE.PlaneGeometry(300, 300);
    this.groundMaterial = new THREE.MeshLambertMaterial({ color: 0x79cf57 });
    this.ground = new THREE.Mesh(groundGeometry, this.groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.075;
    this.ground.receiveShadow = false;
    // This plane is only a distant backdrop. Keep it out of depth testing so
    // depth precision can never paint a green wedge over valid road rows.
    this.ground.renderOrder = -20;
    this.groundMaterial.depthWrite = false;
    this.groundMaterial.depthTest = false;
    this.scene.add(this.ground);

    this.hemisphere = new THREE.HemisphereLight(0xe4f7ff, 0x567d48, 1.85);
    this.scene.add(this.hemisphere);

    this.light = new THREE.DirectionalLight(0xfff3d2, 2.2);
    this.light.position.set(8, 18, -10);
    this.light.target = this.target;
    this.scene.add(this.light);
    this.scene.add(this.target);

    this.playerShadow = createBlobShadow(0.95, 0.72, 0.022);
    this.playerShadow.visible = false;
    this.scene.add(this.playerShadow);

    this.particles = new Particles(this.scene);

    this.menuStage = this.buildMenuStage();
    this.scene.add(this.menuStage);

    this.resize();
  }

  private buildMenuStage(): THREE.Group {
    const group = new THREE.Group();

    const grass = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 0.18, 36),
      new THREE.MeshLambertMaterial({ color: 0x8fcf4f })
    );
    grass.position.y = -0.09;
    group.add(grass);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(8.3, 8.28, 0.28, 36),
      new THREE.MeshLambertMaterial({ color: 0xf0e5ca })
    );
    rim.position.y = -0.19;
    group.add(rim);

    const earth = new THREE.Mesh(
      new THREE.CylinderGeometry(7.85, 6.8, 1.4, 36),
      new THREE.MeshLambertMaterial({ color: 0x9a6a45 })
    );
    earth.position.y = -0.92;
    group.add(earth);

    const cubes: CubeSpec[] = [];

    // Road behind the character.
    cubes.push({ x: 0, y: 0.028, z: 2.4, sx: 12, sy: 0.055, sz: 2.1, color: 0x4c525b });
    for (const z of [1.36, 3.44]) {
      cubes.push({ x: 0, y: 0.058, z, sx: 12, sy: 0.012, sz: 0.07, color: 0xf7f4e9 });
    }
    for (let x = -5.2; x <= 5.2; x += 1.8) {
      cubes.push({ x, y: 0.06, z: 2.4, sx: 0.95, sy: 0.01, sz: 0.07, color: 0xf7f4e9 });
    }

    // A small river with logs behind the road.
    cubes.push({ x: 0, y: 0.02, z: 5.35, sx: 11, sy: 0.045, sz: 1.7, color: 0x50d6ef });
    for (const z of [4.52, 6.18]) {
      cubes.push({ x: 0, y: 0.045, z, sx: 11, sy: 0.02, sz: 0.09, color: 0xf7f8f2 });
    }
    for (const [x, z] of [[-3.2, 5.15], [2.6, 5.55]]) {
      cubes.push({ x, y: 0.09, z, sx: 4.2, sy: 0.16, sz: 0.36, color: 0x9a5f39 });
      cubes.push({ x: x - 1.8, y: 0.09, z, sx: 0.08, sy: 0.17, sz: 0.38, color: 0xc08a55 });
    }

    const tree = (x: number, z: number, s: number, tall = false): void => {
      cubes.push({ x, y: 0.3 * s, z, sx: 0.26 * s, sy: 0.6 * s, sz: 0.26 * s, color: 0x74492d });
      cubes.push({ x, y: 0.88 * s, z, sx: 0.95 * s, sy: 0.82 * s, sz: 0.86 * s, color: 0x8aab33 });
      cubes.push({ x: x + 0.04 * s, y: 1.34 * s, z: z - 0.02 * s, sx: 0.72 * s, sy: 0.6 * s, sz: 0.66 * s, color: 0x9fbd3d });
      if (tall) {
        cubes.push({ x, y: 1.78 * s, z, sx: 0.5 * s, sy: 0.46 * s, sz: 0.46 * s, color: 0xbdd65c });
      }
    };
    tree(-6.1, 0.4, 1.08, true);
    tree(6.2, 0.7, 0.98);
    tree(-5.6, 4.15, 0.82);
    tree(5.7, 4.3, 0.92, true);

    // A few foreground rocks and flowers so the island does not feel empty.
    for (const [x, z, s] of [[-3.8, -1.4, 0.55], [3.5, -0.8, 0.72], [-6.2, -2.3, 0.62], [6.4, -1.5, 0.5]]) {
      cubes.push({ x, y: 0.18 * s, z, sx: 0.72 * s, sy: 0.36 * s, sz: 0.7 * s, color: 0xb8a6c9 });
    }
    const flowerColors = [0xfff8e8, 0xffd84a, 0xff8b8b];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 3.4 + (i % 3) * 1.45;
      cubes.push({ x: Math.cos(angle) * radius, y: 0.06, z: Math.sin(angle) * radius, sx: 0.1, sy: 0.18, sz: 0.1, color: 0x5d9b3a });
      cubes.push({ x: Math.cos(angle) * radius, y: 0.18, z: Math.sin(angle) * radius, sx: 0.17, sy: 0.14, sz: 0.17, color: flowerColors[i % flowerColors.length] });
    }
    group.add(createVoxelMesh(cubes));

    const car = (x: number, z: number, color: number): void => {
      const cc: CubeSpec[] = [
        { x: 0, y: 0.16, z: 0, sx: 1.55, sy: 0.25, sz: 0.74, color: 0x2b3035 },
        { x: 0, y: 0.31, z: 0, sx: 1.62, sy: 0.28, sz: 0.78, color },
        { x: -0.03, y: 0.5, z: 0, sx: 0.92, sy: 0.24, sz: 0.7, color },
        { x: -0.03, y: 0.63, z: 0, sx: 0.8, sy: 0.075, sz: 0.64, color: 0xf1eee3 },
        { x: 0.23, y: 0.52, z: -0.355, sx: 0.36, sy: 0.14, sz: 0.02, color: 0x1e3541 },
        { x: 0.23, y: 0.52, z: 0.355, sx: 0.36, sy: 0.14, sz: 0.02, color: 0x1e3541 },
        { x: 0.36, y: 0.38, z: -0.39, sx: 0.05, sy: 0.11, sz: 0.02, color: 0xd94d3d },
        { x: 0.36, y: 0.38, z: 0.39, sx: 0.05, sy: 0.11, sz: 0.02, color: 0xd94d3d }
      ];
      for (const ax of [-0.55, 0.55]) {
        for (const az of [-0.34, 0.34]) {
          cc.push({ x: ax, y: 0.16, z: az, sx: 0.22, sy: 0.22, sz: 0.16, color: 0x20262b });
        }
      }
      const mesh = createVoxelMesh(cc);
      mesh.position.set(x, 0.055, z);
      group.add(mesh);
    };
    car(-3.1, 2.38, 0xf2c433);
    car(3.05, 2.5, 0x62b95b);

    return group;
  }

  private buildClouds(): THREE.InstancedMesh {
    const geometry = new THREE.SphereGeometry(1, 7, 5);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      fog: false
    });
    const count = 30;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    const clusters = [
      [-58, 26, 58], [-24, 22, 78], [18, 29, 64], [48, 24, 86], [78, 28, 50], [4, 33, 112], [52, 34, 116]
    ];
    let index = 0;
    for (let c = 0; c < clusters.length; c++) {
      const [cx, cy, cz] = clusters[c];
      for (let i = 0; i < 4 && index < count; i++) {
        const s = 3.2 + ((c * 7 + i * 13) % 9) * 0.45;
        dummy.position.set(cx + (i - 1.5) * 5.2, cy + ((i * 3) % 4) * 0.9, cz + ((i * 5) % 6));
        dummy.scale.set(s * 1.5, s * 0.55, s);
        dummy.updateMatrix();
        mesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }

  private buildHills(): THREE.Group {
    const group = new THREE.Group();
    const colors = [0x96d8b0, 0x7dcb9e, 0x65b98a];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.SphereGeometry(1, 14, 8);
      const mat = new THREE.MeshLambertMaterial({ color: colors[i], flatShading: true });
      for (let j = 0; j < 4; j++) {
        const hill = new THREE.Mesh(geo, mat);
        hill.position.set(-120 + j * 70 + i * 22, -3.2 + i * 0.6, 78 + i * 12);
        hill.scale.set(42 + j * 7, 10 + i * 2, 19 + i * 3);
        group.add(hill);
      }
    }
    return group;
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Crisp voxel rendering: use the display's native pixel ratio (capped to
    // keep high-DPI phones fast) instead of the old low-resolution buffer.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    if (height > width * 1.05) {
      this.camera.position.set(0, 7.0, -11.6);
      this.camera.fov = 50;
      this.camera.lookAt(0, 0.95, 0.7);
    } else {
      this.camera.position.set(0, 5.5, -8.4);
      this.camera.fov = 47;
      this.camera.lookAt(0, 0.95, 0.7);
    }
    this.camera.updateProjectionMatrix();
    this.updateIsoFrustum();
  }

  applyBiome(biome: BiomeDef): void {
    this.groundMaterial.color.setHex(biome.ground);
    this.light.color.setHex(biome.light);
    this.light.intensity = biome.lightIntensity;
    this.hemisphere.color.setHex(biome.hemiSky);
    this.hemisphere.groundColor.setHex(biome.hemiGround);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(biome.fog);
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.setHex(biome.fog);
    }
  }

  setOrthoHeight(height: number): void {
    if (Math.abs(this.isoHeight - height) < 0.0001) return;
    this.isoHeight = height;
    this.updateIsoFrustum();
  }

  private updateIsoFrustum(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const halfHeight = this.isoHeight * 0.5;
    const halfWidth = halfHeight * aspect;
    this.isoCamera.left = -halfWidth;
    this.isoCamera.right = halfWidth;
    this.isoCamera.top = halfHeight;
    this.isoCamera.bottom = -halfHeight;
    this.isoCamera.updateProjectionMatrix();
  }

  setEnvironmentVisible(visible: boolean): void {
    this.sky.visible = visible;
    this.farGroup.visible = visible;
    this.menuStage.visible = visible;
    this.ground.visible = !visible;
  }

  updateEnvironment(time: number, anchor: THREE.Vector3, camera: THREE.Camera = this.camera): void {
    this.sky.position.copy(camera.position);
    this.farGroup.position.set(anchor.x, 0, anchor.z);
    this.ground.position.x = anchor.x;
    this.ground.position.z = anchor.z;

    this.light.position.set(anchor.x + 9, 18, anchor.z - 11);
    this.target.position.set(anchor.x, 0, anchor.z + 4);
    this.target.updateMatrixWorld();

    this.sun.position.x = -28 + Math.sin(time * 0.02) * 2;
    this.clouds.rotation.y = Math.sin(time * 0.012) * 0.015;

    animateWater(time);
  }

  render(camera: THREE.Camera = this.camera): void {
    this.renderer.render(this.scene, camera);
  }
}
