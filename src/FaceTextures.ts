import * as THREE from "three";

type FaceStyle = "higanbanban" | "ditoshey" | "moryaka" | "severina";

export interface FaceOptions {
  iris?: number;
  irisLight?: number;
  pupil?: number;
  lash?: number;
}

interface FaceConfig {
  width: number;
  height: number;
  y: number;
  z: number;
  baseZ: number;
  eyeY: number;
  eyeSpread: number;
  eyeW: number;
  eyeH: number;
  iris: number;
  irisLight: number;
  pupil: number;
  lash: number;
  brow: number;
  hasBrow: boolean;
  browY: number;
  sleepy: boolean;
  glasses: boolean;
  mouthY: number;
  mouthW: number;
  blushY: number;
  blushSpread: number;
  freckles: boolean;
}

const SKIN = "#ffe9de";
const CREAM = "#fff8ec";

function fillEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function strokeEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  width: number
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function colorHex(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cfg: FaceConfig,
  side: number
): void {
  const ew = cfg.eyeW;
  const eh = cfg.eyeH;

  // Dark eye socket and cream sclera.
  fillEllipse(ctx, x, y, ew * 0.56, eh * 0.56, colorHex(cfg.lash));
  fillEllipse(ctx, x, y, ew * 0.48, eh * 0.48, CREAM);

  // Iris, inner glow, pupil and catchlights.
  fillEllipse(ctx, x, y + 1, ew * 0.36, eh * 0.38, colorHex(cfg.iris));
  fillEllipse(ctx, x - ew * 0.06, y - eh * 0.08, ew * 0.25, eh * 0.25, colorHex(cfg.irisLight));
  fillEllipse(ctx, x, y + eh * 0.08, ew * 0.16, eh * 0.26, colorHex(cfg.pupil));
  fillEllipse(ctx, x - ew * 0.16, y - eh * 0.18, ew * 0.07, eh * 0.1, "#ffffff");
  fillEllipse(ctx, x + ew * 0.17, y + eh * 0.2, ew * 0.035, eh * 0.055, "#ffffff");

  // Sleepy eyelids cover the upper third of the sclera.
  if (cfg.sleepy) {
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.ellipse(x, y - eh * 0.3, ew * 0.52, eh * 0.28, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  // Clean upper lash curve and a thin lower lid.
  ctx.strokeStyle = colorHex(cfg.lash);
  ctx.lineWidth = Math.max(4, ew * 0.09);
  ctx.beginPath();
  ctx.ellipse(x, y, ew * 0.49, eh * 0.5, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();

  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(2, ew * 0.045);
  ctx.beginPath();
  ctx.ellipse(x, y, ew * 0.38, eh * 0.42, 0, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // A subtle wing only at the outer corner.
  ctx.strokeStyle = colorHex(cfg.lash);
  ctx.lineWidth = Math.max(3, ew * 0.055);
  ctx.beginPath();
  ctx.moveTo(x + side * ew * 0.46, y - eh * 0.22);
  ctx.lineTo(x + side * ew * 0.62, y - eh * 0.3);
  ctx.stroke();
}

function drawFace(style: FaceStyle, ctx: CanvasRenderingContext2D, cfg: FaceConfig): void {
  const isDito = style === "ditoshey";
  const isHigan = style === "higanbanban";
  const isMoryaka = style === "moryaka";
  const eyeLeft = 256 - cfg.eyeSpread;
  const eyeRight = 256 + cfg.eyeSpread;

  // Soft blush behind the eye line.
  ctx.globalAlpha = 0.42;
  fillEllipse(ctx, 256 - cfg.blushSpread, cfg.blushY, 42, 17, "#f6a6a6");
  fillEllipse(ctx, 256 + cfg.blushSpread, cfg.blushY, 42, 17, "#f6a6a6");
  ctx.globalAlpha = 1;

  drawEye(ctx, eyeLeft, cfg.eyeY, cfg, -1);
  drawEye(ctx, eyeRight, cfg.eyeY, cfg, 1);

  if (cfg.hasBrow) {
    ctx.strokeStyle = colorHex(cfg.brow);
    ctx.lineWidth = 5;
    for (const x of [eyeLeft, eyeRight]) {
      ctx.beginPath();
      ctx.arc(x, cfg.browY, 55, Math.PI * 1.14, Math.PI * 1.86);
      ctx.stroke();
    }
  }

  if (cfg.glasses) {
    const gold = "#e9c46a";
    ctx.strokeStyle = gold;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(eyeLeft, cfg.eyeY, cfg.eyeW * 0.65, 0, Math.PI * 2);
    ctx.arc(eyeRight, cfg.eyeY, cfg.eyeW * 0.65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeLeft + cfg.eyeW * 0.65, cfg.eyeY);
    ctx.lineTo(eyeRight - cfg.eyeW * 0.65, cfg.eyeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeRight + cfg.eyeW * 0.65, cfg.eyeY);
    ctx.lineTo(410, cfg.eyeY - 8);
    ctx.stroke();
  }

  // Nose and a tiny curved smile.
  fillEllipse(ctx, 256, cfg.eyeY + cfg.eyeH * 0.9, 7, 5, isMoryaka ? "#9b5a5a" : "#e5a79e");
  ctx.strokeStyle = isMoryaka ? "#8e4b4b" : "#9b4e52";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(256, cfg.mouthY, cfg.mouthW, Math.PI * 0.16, Math.PI * 0.84);
  ctx.stroke();

  if (isMoryaka) {
    // Freckles and the small dark beauty mark from the reference.
    ctx.fillStyle = "#b97a63";
    for (const [x, y] of [[220, 306], [232, 318], [278, 306], [290, 316]]) {
      fillEllipse(ctx, x, y, 3, 3, "#b97a63");
    }
    fillEllipse(ctx, 208, 286, 3, 3, "#b97a63");
  }

  if (isHigan || isDito) {
    // Small hairline shadow makes the face feel set into the head.
    ctx.globalAlpha = 0.08;
    fillEllipse(ctx, 256, 76, 160, 38, "#2a1518");
    ctx.globalAlpha = 1;
  }
}

export function buildFaceDecal(
  style: FaceStyle,
  options: FaceOptions = {}
): THREE.Group {
  const isMoryaka = style === "moryaka";
  const isSeverina = style === "severina";
  const isHigan = style === "higanbanban";
  const isDito = style === "ditoshey";
  const cfg: FaceConfig = {
    width: isMoryaka ? 0.42 : isSeverina ? 0.4 : 0.4,
    height: isMoryaka ? 0.34 : isSeverina ? 0.34 : 0.35,
    y: isMoryaka ? 0.82 : isSeverina ? 0.76 : 0.88,
    z: isMoryaka ? 0.355 : isSeverina ? 0.307 : 0.303,
    baseZ: isMoryaka ? 0.338 : isSeverina ? 0.282 : 0.278,
    eyeY: isMoryaka ? 215 : isSeverina ? 252 : 225,
    eyeSpread: isMoryaka ? 100 : isSeverina ? 88 : 100,
    eyeW: isMoryaka ? 130 : isSeverina ? 110 : 120,
    eyeH: isMoryaka ? 120 : isSeverina ? 95 : 115,
    iris: options.iris ?? (isHigan ? 0xff6a2f : isMoryaka ? 0xffa12e : isSeverina ? 0x6fd3d0 : 0x9fd36b),
    irisLight: options.irisLight ?? (isHigan ? 0xffc05b : isMoryaka ? 0xffd27a : isSeverina ? 0xb8f5e8 : 0xd7ef9d),
    pupil: options.pupil ?? (isHigan ? 0x2a1117 : isMoryaka ? 0x3a2017 : 0x203020),
    lash: options.lash ?? (isHigan ? 0x211518 : isMoryaka ? 0x5b3a2e : isSeverina ? 0x3a2a4a : 0x342728),
    brow: isHigan ? 0x193f37 : isMoryaka ? 0x5b3a2e : isSeverina ? 0x6a4e7a : 0xd98a91,
    hasBrow: false,
    browY: isMoryaka ? 145 : isSeverina ? 180 : 155,
    sleepy: isSeverina,
    glasses: isDito,
    mouthY: isMoryaka ? 365 : 350,
    mouthW: isMoryaka ? 42 : isSeverina ? 36 : 46,
    blushY: isMoryaka ? 315 : isSeverina ? 315 : 320,
    blushSpread: isMoryaka ? 150 : 135,
    freckles: isMoryaka
  };

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  drawFace(style, ctx, cfg);
  (window as unknown as { __faceTexture?: string }).__faceTexture = canvas.toDataURL("image/png");

  // A soft skin patch sits behind the fringe, under the eye decal.
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = 256;
  baseCanvas.height = 256;
  const baseCtx = baseCanvas.getContext("2d");
  if (!baseCtx) throw new Error("2D canvas is not available");
  baseCtx.fillStyle = isMoryaka ? "#fff8ec" : isSeverina ? "#f5e8f2" : "#ffe9de";
  baseCtx.beginPath();
  baseCtx.ellipse(128, 128, 122, 120, 0, 0, Math.PI * 2);
  baseCtx.fill();
  const baseTexture = new THREE.CanvasTexture(baseCanvas);
  baseTexture.colorSpace = THREE.SRGBColorSpace;
  baseTexture.minFilter = THREE.LinearFilter;
  const baseMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(cfg.width * 0.98, cfg.height * 0.94),
    new THREE.MeshBasicMaterial({ map: baseTexture, transparent: true, alphaTest: 0.01 })
  );
  baseMesh.position.set(0, cfg.y, cfg.baseZ);
  baseMesh.renderOrder = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.01,
    depthWrite: false,
    side: THREE.FrontSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.width, cfg.height), material);
  mesh.position.set(0, cfg.y, cfg.z);
  mesh.renderOrder = 2;
  const group = new THREE.Group();
  group.add(baseMesh);
  group.add(mesh);
  return group;
}




