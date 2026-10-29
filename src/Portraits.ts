import { SKINS, type SkinId } from "./config";
import { TAU, cssColor } from "./utils";
import { ART_HEAD_CROPS, GENERATED_ART } from "./assets/art";

const artImages = new Map<SkinId, HTMLImageElement>();
for (const [skin, src] of Object.entries(GENERATED_ART)) {
  if (!src) continue;
  const image = new Image();
  image.src = src;
  artImages.set(skin as SkinId, image);
}

function roundPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function roundFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
  stroke?: string
): void {
  roundPath(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function ellipseFill(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.restore();
}

function drawMoryakaPortrait(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const cx = W * 0.5;
  const headY = H * 0.5;
  const fur = "#8a563d";
  const furDark = "#663c2b";
  const furLight = "#a86f50";
  const cream = "#fff9ec";
  const purple = "#5b4b75";
  const purpleLight = "#7a6696";
  const yellow = "#ffc247";
  const orange = "#f29a33";
  const lens = "#2e2a3a";
  const green = "#74d58d";
  const ink = "rgba(70,42,31,0.45)";

  ctx.save();

  // Large fluffy side tails behind the head.
  for (const side of [-1, 1]) {
    const sx = cx + side * W * 0.31;
    ellipseFill(ctx, sx, H * 0.43, W * 0.15, H * 0.255, fur);
    ellipseFill(ctx, sx + side * W * 0.035, H * 0.35, W * 0.105, H * 0.18, furLight);
    ellipseFill(ctx, sx + side * W * 0.055, H * 0.54, W * 0.075, H * 0.105, furDark);
    // Long yellow/purple ribbon straps.
    roundFill(ctx, sx + side * W * 0.04 - W * 0.022, H * 0.33, W * 0.044, H * 0.15, W * 0.02, side < 0 ? purple : yellow, ink);
    roundFill(ctx, sx + side * W * 0.06 - W * 0.012, H * 0.39, W * 0.024, H * 0.08, W * 0.012, cream);
    ellipseFill(ctx, sx + side * W * 0.05, H * 0.585, W * 0.05, H * 0.055, furLight);
  }

  // Fluffy brown hair mass.
  ellipseFill(ctx, cx, headY - H * 0.11, W * 0.315, H * 0.17, fur);
  ellipseFill(ctx, cx - W * 0.15, headY - H * 0.19, W * 0.14, H * 0.12, furDark);
  ellipseFill(ctx, cx + W * 0.15, headY - H * 0.19, W * 0.14, H * 0.12, furDark);
  ellipseFill(ctx, cx, headY - H * 0.25, W * 0.115, H * 0.075, furLight);

  // Pointed ears with coloured insides and cream tips.
  for (const side of [-1, 1]) {
    const ex = cx + side * W * 0.245;
    const ey = H * 0.155;
    ctx.beginPath();
    ctx.moveTo(ex - W * 0.085, ey + H * 0.07);
    ctx.quadraticCurveTo(ex - W * 0.07, ey - H * 0.13, ex + side * W * 0.015, ey - H * 0.16);
    ctx.quadraticCurveTo(ex + W * 0.085, ey - H * 0.1, ex + W * 0.08, ey + H * 0.07);
    ctx.quadraticCurveTo(ex, ey + H * 0.01, ex - W * 0.085, ey + H * 0.07);
    ctx.closePath();
    ctx.fillStyle = fur;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex - W * 0.045, ey + H * 0.04);
    ctx.quadraticCurveTo(ex - W * 0.035, ey - H * 0.075, ex + side * W * 0.01, ey - H * 0.105);
    ctx.quadraticCurveTo(ex + W * 0.045, ey - H * 0.055, ex + W * 0.045, ey + H * 0.04);
    ctx.quadraticCurveTo(ex, ey + H * 0.005, ex - W * 0.045, ey + H * 0.04);
    ctx.closePath();
    ctx.fillStyle = side < 0 ? purple : yellow;
    ctx.fill();
    ellipseFill(ctx, ex + side * W * 0.012, ey - H * 0.125, W * 0.024, H * 0.018, cream);
  }

  // Wide cream face with a rounded chin.
  roundFill(ctx, cx - W * 0.2, headY - H * 0.105, W * 0.4, H * 0.35, W * 0.15, cream, ink);

  // Brown bangs frame the face; the white blaze runs down the forehead.
  ellipseFill(ctx, cx - W * 0.19, headY - H * 0.075, W * 0.105, H * 0.145, fur);
  ellipseFill(ctx, cx + W * 0.19, headY - H * 0.075, W * 0.105, H * 0.145, fur);
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.045, headY - H * 0.17);
  ctx.quadraticCurveTo(cx - W * 0.07, headY - H * 0.03, cx - W * 0.02, headY + H * 0.045);
  ctx.quadraticCurveTo(cx + W * 0.02, headY - H * 0.015, cx + W * 0.055, headY - H * 0.17);
  ctx.closePath();
  ctx.fillStyle = cream;
  ctx.fill();

  // Goggles across the forehead: dark lenses, gold rims and a green charge light.
  roundFill(ctx, cx - W * 0.315, headY - H * 0.205, W * 0.63, H * 0.055, W * 0.025, purple, ink);
  for (const side of [-1, 1]) {
    const gx = cx + side * W * 0.135;
    const gy = headY - H * 0.235;
    roundFill(ctx, gx - W * 0.12, gy - H * 0.055, W * 0.24, H * 0.115, W * 0.035, lens, ink);
    roundFill(ctx, gx - W * 0.105, gy - H * 0.043, W * 0.21, H * 0.03, W * 0.018, yellow);
    roundFill(ctx, gx - W * 0.105, gy + H * 0.035, W * 0.21, H * 0.012, W * 0.006, purpleLight);
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.beginPath();
    ctx.moveTo(gx - W * 0.075, gy - H * 0.03);
    ctx.lineTo(gx - W * 0.035, gy - H * 0.03);
    ctx.lineTo(gx - W * 0.06, gy + H * 0.02);
    ctx.lineTo(gx - W * 0.09, gy + H * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  roundFill(ctx, cx - W * 0.035, headY - H * 0.215, W * 0.07, H * 0.075, W * 0.02, yellow, ink);
  ctx.fillStyle = green;
  ctx.fillRect(cx + W * 0.09, headY - H * 0.16, W * 0.04, H * 0.016);
  ctx.fillStyle = "#d9d4ca";
  ctx.fillRect(cx + W * 0.055, headY - H * 0.135, W * 0.05, H * 0.008);

  // Amber eyes with thin warm-brown outlines.
  for (const side of [-1, 1]) {
    const ex = cx + side * W * 0.105;
    const ey = headY + H * 0.055;
    ellipseFill(ctx, ex, ey, W * 0.061, H * 0.07, "#8a5a44");
    ellipseFill(ctx, ex, ey, W * 0.055, H * 0.063, "#fffdf8");
    ellipseFill(ctx, ex + side * W * 0.006, ey + H * 0.004, W * 0.043, H * 0.052, orange);
    ellipseFill(ctx, ex + side * W * 0.006, ey + H * 0.006, W * 0.024, H * 0.038, "#3a2017");
    ellipseFill(ctx, ex - W * 0.014, ey - H * 0.018, W * 0.015, H * 0.022, "#ffffff");
    ellipseFill(ctx, ex + W * 0.02, ey + H * 0.027, W * 0.008, H * 0.012, "#ffe5ae");
    ctx.strokeStyle = "#5f3e2c";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(ex, ey, W * 0.062, 3.58, 5.62);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex + side * W * 0.045, ey - H * 0.055);
    ctx.lineTo(ex + side * W * 0.062, ey - H * 0.075);
    ctx.stroke();
  }

  // Muzzle, smile, blush and freckles.
  ellipseFill(ctx, cx, headY + H * 0.195, W * 0.16, H * 0.068, "#fffdf7");
  ellipseFill(ctx, cx, headY + H * 0.155, W * 0.031, H * 0.021, "#5b3426");
  ctx.strokeStyle = "#5b3426";
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.arc(cx, headY + H * 0.173, W * 0.042, 0.24, Math.PI - 0.24);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ellipseFill(ctx, cx + side * W * 0.18, headY + H * 0.13, W * 0.042, H * 0.023, "rgba(244,154,105,0.42)");
    for (const [dx, dy] of [[0.14, 0.17], [0.18, 0.2], [0.22, 0.185]]) {
      ellipseFill(ctx, cx + side * W * dx, headY + H * dy, W * 0.006, H * 0.006, orange);
    }
  }

  // Forehead tuft.
  ellipseFill(ctx, cx - W * 0.02, headY - H * 0.29, W * 0.055, H * 0.09, fur);
  ellipseFill(ctx, cx + W * 0.035, headY - H * 0.35, W * 0.04, H * 0.065, furDark);
  sparkle(ctx, cx - W * 0.25, headY - H * 0.31, W * 0.012, "#ffe7a2");
  ctx.restore();
}


function drawSeverinaPortrait(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const cx = W * 0.5;
  const purple = "#7c6bb8";
  const purpleDark = "#5b4b91";
  const purpleLight = "#9b8bd0";
  const fin = "#3f7776";
  const finLight = "#6ba29b";
  const skin = "#ffe0d3";
  const hair = "#d8c1e4";
  const hairDark = "#bea2d1";
  const cream = "#f6ead7";
  const teal = "#4fc4c7";
  const tealDark = "#173b40";
  const gold = "#d9a640";
  const ink = "rgba(45,36,55,0.45)";

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * W * 0.34, H * 0.54);
    ctx.rotate(side * 0.24);
    roundFill(ctx, -W * 0.08, -H * 0.18, W * 0.16, H * 0.34, 9, fin, ink);
    roundFill(ctx, -W * 0.04, -H * 0.1, W * 0.1, H * 0.2, 6, finLight);
    ctx.restore();
  }

  roundFill(ctx, cx - W * 0.36, H * 0.14, W * 0.72, H * 0.7, W * 0.25, purple, ink);
  roundFill(ctx, cx - W * 0.32, H * 0.18, W * 0.64, H * 0.26, W * 0.18, purpleLight);

  ctx.strokeStyle = purpleDark;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.02, H * 0.18);
  ctx.quadraticCurveTo(cx + W * 0.12, H * 0.02, cx + W * 0.24, H * 0.12);
  ctx.stroke();
  ellipseFill(ctx, cx + W * 0.26, H * 0.13, W * 0.07, H * 0.065, gold);
  ellipseFill(ctx, cx + W * 0.26, H * 0.12, W * 0.045, H * 0.04, "#ffe9a8");
  ellipseFill(ctx, cx + W * 0.245, H * 0.11, W * 0.016, H * 0.016, "#fff8df");

  for (const side of [-1, 1]) {
    ellipseFill(ctx, cx + side * W * 0.235, H * 0.29, W * 0.075, H * 0.07, "#f9f4e9");
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx + side * W * 0.235, H * 0.29, W * 0.075, H * 0.07, 0, 0, TAU);
    ctx.stroke();
    ellipseFill(ctx, cx + side * W * 0.235, H * 0.29, W * 0.032, H * 0.038, "#252833");
    ellipseFill(ctx, cx + side * W * 0.222, H * 0.275, W * 0.012, H * 0.014, "#ffffff");
  }

  roundFill(ctx, cx - W * 0.25, H * 0.41, W * 0.5, H * 0.38, W * 0.2, skin, ink);
  roundFill(ctx, cx - W * 0.27, H * 0.42, W * 0.54, H * 0.06, W * 0.02, purpleLight);
  roundFill(ctx, cx - W * 0.28, H * 0.72, W * 0.56, H * 0.07, W * 0.02, purpleLight);

  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const y = H * (0.47 + i * 0.078);
      ctx.beginPath();
      ctx.moveTo(cx + side * W * 0.23, y);
      ctx.lineTo(cx + side * W * 0.17, y + H * 0.032);
      ctx.lineTo(cx + side * W * 0.23, y + H * 0.064);
      ctx.closePath();
      ctx.fillStyle = cream;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * W * 0.065, H * 0.41);
    ctx.lineTo(cx + (i + 0.5) * W * 0.065, H * 0.47);
    ctx.lineTo(cx + (i + 1) * W * 0.065, H * 0.41);
    ctx.closePath();
    ctx.fillStyle = cream;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ellipseFill(ctx, cx, H * 0.44, W * 0.24, H * 0.12, hair);
  ellipseFill(ctx, cx - W * 0.16, H * 0.54, W * 0.08, H * 0.15, hair);
  ellipseFill(ctx, cx + W * 0.16, H * 0.54, W * 0.08, H * 0.15, hair);
  roundFill(ctx, cx - W * 0.22, H * 0.44, W * 0.035, H * 0.22, W * 0.017, hairDark);
  roundFill(ctx, cx + W * 0.2, H * 0.44, W * 0.035, H * 0.22, W * 0.017, hairDark);

  for (const side of [-1, 1]) {
    const ex = cx + side * W * 0.085;
    const ey = H * 0.59;
    ellipseFill(ctx, ex, ey, W * 0.06, H * 0.052, "#fffbf6");
    ellipseFill(ctx, ex, ey + H * 0.005, W * 0.045, H * 0.045, teal);
    ellipseFill(ctx, ex, ey + H * 0.008, W * 0.023, H * 0.032, tealDark);
    ellipseFill(ctx, ex - W * 0.014, ey - H * 0.015, W * 0.012, H * 0.014, "#ffffff");
    roundFill(ctx, ex - W * 0.065, ey - H * 0.052, W * 0.13, H * 0.028, W * 0.012, hairDark);
    ctx.strokeStyle = hairDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex + side * W * 0.05, ey - H * 0.045);
    ctx.lineTo(ex + side * W * 0.065, ey - H * 0.065);
    ctx.stroke();
  }

  ellipseFill(ctx, cx, H * 0.68, W * 0.018, H * 0.012, "#9a5a62");
  ellipseFill(ctx, cx - W * 0.15, H * 0.65, W * 0.04, H * 0.022, "rgba(240,162,141,0.55)");
  ellipseFill(ctx, cx + W * 0.15, H * 0.65, W * 0.04, H * 0.022, "rgba(240,162,141,0.55)");
  ellipseFill(ctx, cx + W * 0.24, H * 0.44, W * 0.052, H * 0.05, gold);
  ellipseFill(ctx, cx + W * 0.24, H * 0.46, W * 0.02, H * 0.012, "#8b5e1a");
  sparkle(ctx, cx + W * 0.22, H * 0.42, W * 0.012, "#fff1b0");
}

function drawHiganbanbanPortrait(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const cx = W * 0.5;
  const headY = H * 0.5;
  const green = "#1f6b5a";
  const greenLight = "#2e8f73";
  const greenDark = "#124d43";
  const red = "#d8343f";
  const redLight = "#ef4e4e";
  const redDark = "#8f1f2e";
  const skin = "#ffe8dc";
  const black = "#181d1f";
  const cream = "#fff9ec";
  const orange = "#ff5a2e";
  const orangeLight = "#ff9a3d";
  const gold = "#e9c46a";
  const ink = "rgba(32,26,28,0.38)";

  ctx.save();

  ellipseFill(ctx, cx, headY - H * 0.11, W * 0.335, H * 0.205, greenDark);
  ellipseFill(ctx, cx - W * 0.24, headY + H * 0.02, W * 0.135, H * 0.23, green);
  ellipseFill(ctx, cx + W * 0.24, headY + H * 0.02, W * 0.135, H * 0.23, green);
  ellipseFill(ctx, cx - W * 0.3, headY + H * 0.18, W * 0.075, H * 0.13, greenDark);
  ellipseFill(ctx, cx + W * 0.3, headY + H * 0.18, W * 0.075, H * 0.13, greenDark);
  roundFill(ctx, cx - W * 0.205, headY - H * 0.075, W * 0.41, H * 0.345, W * 0.17, skin, ink);
  ellipseFill(ctx, cx, headY - H * 0.18, W * 0.31, H * 0.105, green);
  ellipseFill(ctx, cx - W * 0.22, headY - H * 0.02, W * 0.095, H * 0.19, green);
  ellipseFill(ctx, cx + W * 0.22, headY - H * 0.02, W * 0.095, H * 0.19, green);
  ellipseFill(ctx, cx - W * 0.12, headY - H * 0.13, W * 0.12, H * 0.07, greenLight);
  ellipseFill(ctx, cx + W * 0.1, headY - H * 0.145, W * 0.12, H * 0.065, green);
  ellipseFill(ctx, cx - W * 0.27, headY + H * 0.12, W * 0.07, H * 0.16, greenDark);
  ellipseFill(ctx, cx + W * 0.27, headY + H * 0.12, W * 0.07, H * 0.16, greenDark);

  ctx.beginPath();
  ctx.moveTo(cx - W * 0.19, headY - H * 0.16);
  ctx.quadraticCurveTo(cx - W * 0.1, headY - H * 0.04, cx - W * 0.16, headY + H * 0.13);
  ctx.quadraticCurveTo(cx - W * 0.22, headY + H * 0.02, cx - W * 0.25, headY - H * 0.11);
  ctx.closePath();
  ctx.fillStyle = red;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.12, headY - H * 0.15);
  ctx.quadraticCurveTo(cx - W * 0.06, headY - H * 0.05, cx - W * 0.09, headY + H * 0.07);
  ctx.quadraticCurveTo(cx - W * 0.11, headY - H * 0.02, cx - W * 0.17, headY - H * 0.13);
  ctx.closePath();
  ctx.fillStyle = redLight;
  ctx.fill();

  ctx.strokeStyle = greenDark;
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.02, H * 0.21);
  ctx.bezierCurveTo(cx - W * 0.18, H * 0.08, cx - W * 0.23, H * 0.06, cx - W * 0.16, H * 0.035);
  ctx.stroke();
  ctx.strokeStyle = greenLight;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.02, H * 0.21);
  ctx.bezierCurveTo(cx - W * 0.18, H * 0.08, cx - W * 0.23, H * 0.06, cx - W * 0.16, H * 0.035);
  ctx.stroke();
  ctx.fillStyle = cream;
  ctx.beginPath();
  ctx.ellipse(cx - W * 0.17, H * 0.035, W * 0.018, H * 0.018, 0, 0, Math.PI * 2);
  ctx.fill();

  for (const side of [-1, 1]) {
    const ex = cx + side * W * 0.095;
    const ey = headY + H * 0.035;
    ellipseFill(ctx, ex, ey, W * 0.073, H * 0.08, "#2a1518");
    ellipseFill(ctx, ex, ey, W * 0.064, H * 0.07, cream);
    ellipseFill(ctx, ex + side * W * 0.006, ey + H * 0.005, W * 0.052, H * 0.06, orange);
    ellipseFill(ctx, ex + side * W * 0.004, ey - H * 0.002, W * 0.034, H * 0.043, orangeLight);
    ellipseFill(ctx, ex + side * W * 0.004, ey + H * 0.008, W * 0.021, H * 0.037, "#30151a");
    ellipseFill(ctx, ex - W * 0.017, ey - H * 0.022, W * 0.015, H * 0.02, "#ffffff");
    ellipseFill(ctx, ex + W * 0.022, ey + H * 0.03, W * 0.008, H * 0.011, "#ffe3a7");
    roundFill(ctx, ex - W * 0.078, ey - H * 0.07, W * 0.156, H * 0.032, W * 0.014, greenDark);
    ctx.strokeStyle = "#241516";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(ex + side * W * 0.055, ey - H * 0.055);
    ctx.lineTo(ex + side * W * 0.076, ey - H * 0.078);
    ctx.stroke();
  }

  ellipseFill(ctx, cx, headY + H * 0.14, W * 0.025, H * 0.018, "#c9867b");
  ctx.strokeStyle = "#8f4c4c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.035, headY + H * 0.16);
  ctx.quadraticCurveTo(cx, headY + H * 0.185, cx + W * 0.035, headY + H * 0.16);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ellipseFill(ctx, cx + side * W * 0.15, headY + H * 0.13, W * 0.038, H * 0.021, "rgba(240,145,135,0.38)");
  }

  const fx = cx + W * 0.22;
  const fy = H * 0.39;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 - 0.18;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-W * 0.006, H * 0.012);
    ctx.quadraticCurveTo(-W * 0.045, -H * 0.06, -W * 0.015, -H * 0.16);
    ctx.quadraticCurveTo(W * 0.008, -H * 0.08, W * 0.006, H * 0.012);
    ctx.closePath();
    ctx.fillStyle = i % 3 === 0 ? redLight : red;
    ctx.fill();
    ctx.strokeStyle = redDark;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = redLight;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-W * 0.015, -H * 0.16);
    ctx.quadraticCurveTo(W * 0.025, -H * 0.19, W * 0.055, -H * 0.175);
    ctx.stroke();
    ellipseFill(ctx, W * 0.055, -H * 0.175, W * 0.008, H * 0.009, cream);
    ctx.restore();
  }
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.2;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(angle);
    ctx.strokeStyle = redLight;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.01);
    ctx.quadraticCurveTo(W * 0.025, -H * 0.07, W * 0.012, -H * 0.11);
    ctx.stroke();
    ellipseFill(ctx, W * 0.012, -H * 0.11, W * 0.008, H * 0.009, cream);
    ctx.restore();
  }
  ellipseFill(ctx, fx, fy, W * 0.04, H * 0.04, redDark);
  ellipseFill(ctx, fx, fy, W * 0.027, H * 0.027, gold);
  ellipseFill(ctx, fx - W * 0.008, fy - H * 0.008, W * 0.012, H * 0.012, cream);
  ctx.strokeStyle = greenDark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fx - W * 0.02, fy + H * 0.02);
  ctx.quadraticCurveTo(fx - W * 0.055, H * 0.48, fx - W * 0.005, H * 0.49);
  ctx.stroke();
  ellipseFill(ctx, fx - W * 0.06, H * 0.445, W * 0.04, H * 0.02, green);

  roundFill(ctx, cx - W * 0.16, headY + H * 0.255, W * 0.32, H * 0.055, W * 0.02, black, ink);
  roundFill(ctx, cx - W * 0.025, headY + H * 0.265, W * 0.05, H * 0.08, W * 0.015, redDark);
  ctx.fillStyle = red;
  ctx.fillRect(cx - W * 0.013, headY + H * 0.27, W * 0.026, H * 0.06);
  ctx.fillRect(cx - W * 0.04, headY + H * 0.29, W * 0.08, H * 0.02);

  ctx.strokeStyle = black;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.235, headY + H * 0.17);
  ctx.lineTo(cx - W * 0.235, headY + H * 0.255);
  ctx.moveTo(cx - W * 0.26, headY + H * 0.2);
  ctx.lineTo(cx - W * 0.21, headY + H * 0.2);
  ctx.stroke();

  ctx.restore();
}

function drawDitosheyPortrait(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const cx = W * 0.5;
  const headY = H * 0.51;
  const pink = "#f3a7a7";
  const pinkLight = "#f9c3bb";
  const pinkDark = "#d98a91";
  const lavender = "#b9afd9";
  const lavenderDark = "#9587bb";
  const blue = "#9fb8df";
  const cream = "#fff8ee";
  const skin = "#ffe9dd";
  const onesie = "#cdbce6";
  const gold = "#e9c46a";
  const heart = "#e84f5b";
  const ink = "rgba(58,38,58,0.38)";

  ctx.save();

  ellipseFill(ctx, cx, headY - H * 0.1, W * 0.34, H * 0.22, pinkDark);
  ellipseFill(ctx, cx - W * 0.25, headY + H * 0.02, W * 0.14, H * 0.24, pink);
  ellipseFill(ctx, cx + W * 0.25, headY + H * 0.02, W * 0.14, H * 0.24, pink);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      ellipseFill(ctx, cx + side * W * 0.3, H * (0.58 + i * 0.08), W * 0.04, H * 0.045, i % 2 === 0 ? lavender : pinkLight);
    }
  }

  for (const side of [-1, 1]) {
    for (const [exf, eyf, scale] of [[0.21, 0.25, 1.0], [0.37, 0.3, 0.72]]) {
      const ex = cx + side * W * exf;
      const ey = H * eyf;
      ctx.beginPath();
      ctx.moveTo(ex - W * 0.075 * scale, ey + H * 0.1 * scale);
      ctx.quadraticCurveTo(ex - W * 0.07 * scale, ey - H * 0.14 * scale, ex + side * W * 0.005, ey - H * 0.2 * scale);
      ctx.quadraticCurveTo(ex + W * 0.075 * scale, ey - H * 0.12 * scale, ex + W * 0.075 * scale, ey + H * 0.1 * scale);
      ctx.quadraticCurveTo(ex, ey + H * 0.01, ex - W * 0.075 * scale, ey + H * 0.1 * scale);
      ctx.closePath();
      ctx.fillStyle = pink;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex - W * 0.04 * scale, ey + H * 0.06 * scale);
      ctx.quadraticCurveTo(ex - W * 0.03 * scale, ey - H * 0.1 * scale, ex + side * W * 0.005, ey - H * 0.15 * scale);
      ctx.quadraticCurveTo(ex + W * 0.04 * scale, ey - H * 0.08 * scale, ex + W * 0.04 * scale, ey + H * 0.06 * scale);
      ctx.closePath();
      ctx.fillStyle = scale > 0.8 ? lavender : pinkLight;
      ctx.fill();
      ellipseFill(ctx, ex + side * W * 0.008, ey - H * 0.19 * scale, W * 0.032, H * 0.032, cream);
    }
  }

  roundFill(ctx, cx - W * 0.19, headY - H * 0.055, W * 0.38, H * 0.34, W * 0.16, skin, ink);
  ellipseFill(ctx, cx, headY - H * 0.16, W * 0.32, H * 0.11, pink);
  ellipseFill(ctx, cx - W * 0.23, headY - H * 0.01, W * 0.1, H * 0.2, pink);
  ellipseFill(ctx, cx + W * 0.23, headY - H * 0.01, W * 0.1, H * 0.2, pink);
  ellipseFill(ctx, cx - W * 0.12, headY - H * 0.15, W * 0.13, H * 0.07, pinkLight);
  ellipseFill(ctx, cx + W * 0.1, headY - H * 0.15, W * 0.13, H * 0.07, lavender);
  ellipseFill(ctx, cx - W * 0.26, headY + H * 0.12, W * 0.07, H * 0.18, pinkDark);
  ellipseFill(ctx, cx + W * 0.26, headY + H * 0.12, W * 0.07, H * 0.18, pinkDark);
  ellipseFill(ctx, cx - W * 0.18, headY + H * 0.03, W * 0.055, H * 0.16, blue);
  ellipseFill(ctx, cx + W * 0.17, headY + H * 0.04, W * 0.055, H * 0.15, lavender);

  for (const side of [-1, 1]) {
    const ex = cx + side * W * 0.095;
    const ey = headY + H * 0.04;
    ellipseFill(ctx, ex, ey, W * 0.072, H * 0.078, "#2a2320");
    ellipseFill(ctx, ex, ey, W * 0.063, H * 0.068, cream);
    ellipseFill(ctx, ex + side * W * 0.005, ey + H * 0.005, W * 0.05, H * 0.058, "#9fd36b");
    ellipseFill(ctx, ex + side * W * 0.005, ey + H * 0.008, W * 0.021, H * 0.037, "#1e2a1e");
    ellipseFill(ctx, ex - W * 0.016, ey - H * 0.02, W * 0.014, H * 0.019, "#ffffff");
    ellipseFill(ctx, ex + W * 0.021, ey + H * 0.028, W * 0.008, H * 0.011, "#d7ef9d");
    roundFill(ctx, ex - W * 0.078, ey - H * 0.07, W * 0.156, H * 0.03, W * 0.013, pinkDark);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(ex, ey + H * 0.005, W * 0.085, H * 0.088, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "#b89648";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(ex, ey + H * 0.005, W * 0.075, H * 0.078, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.02, headY + H * 0.04);
  ctx.lineTo(cx + W * 0.02, headY + H * 0.04);
  ctx.stroke();

  ellipseFill(ctx, cx, headY + H * 0.145, W * 0.022, H * 0.017, "#c9867b");
  ctx.strokeStyle = "#9b5a5a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.035, headY + H * 0.165);
  ctx.quadraticCurveTo(cx, headY + H * 0.195, cx + W * 0.035, headY + H * 0.165);
  ctx.stroke();
  for (const side of [-1, 1]) {
    ellipseFill(ctx, cx + side * W * 0.16, headY + H * 0.12, W * 0.04, H * 0.022, "rgba(244,154,165,0.4)");
    for (const [dx, dy] of [[0.13, 0.16], [0.17, 0.18], [0.21, 0.16]]) {
      ellipseFill(ctx, cx + side * W * dx, headY + H * dy, W * 0.006, H * 0.006, "#e0a09a");
    }
  }

  roundFill(ctx, cx - W * 0.27, headY + H * 0.22, W * 0.54, H * 0.19, W * 0.07, onesie, ink);
  roundFill(ctx, cx - W * 0.21, headY + H * 0.23, W * 0.42, H * 0.17, W * 0.06, "#e1d4f2");
  ctx.strokeStyle = "#fffdf7";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, headY + H * 0.26);
  ctx.lineTo(cx, headY + H * 0.34);
  for (let i = 0; i < 3; i++) {
    ctx.moveTo(cx - W * 0.05, headY + H * 0.275 + i * H * 0.022);
    ctx.quadraticCurveTo(cx, headY + H * 0.29 + i * H * 0.022, cx + W * 0.05, headY + H * 0.275 + i * H * 0.022);
  }
  ctx.stroke();
  ellipseFill(ctx, cx, headY + H * 0.28, W * 0.035, H * 0.028, heart);
  ctx.strokeStyle = lavenderDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.2, headY + H * 0.32);
  ctx.quadraticCurveTo(cx - W * 0.28, headY + H * 0.25, cx - W * 0.31, headY + H * 0.3);
  ctx.stroke();

  ctx.restore();
}

function drawVexPortrait(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const cx = W * 0.5;
  const ink = "rgba(20, 40, 45, 0.32)";
  const metal = "#53d7c7";
  const dark = "#2c8d84";
  const light = "#9af4e8";
  const glow = "#a7ff5f";
  const joint = "#2a3038";
  const visor = "#101820";

  ellipseFill(ctx, cx, H * 0.85, W * 0.24, H * 0.05, "rgba(20, 40, 45, 0.2)");

  // Shoulders and torso.
  roundFill(ctx, cx - 48, H * 0.58, 20, H * 0.13, 8, dark, ink);
  roundFill(ctx, cx + 28, H * 0.58, 20, H * 0.13, 8, dark, ink);
  roundFill(ctx, cx - 38, H * 0.57, 76, H * 0.24, 14, metal, ink);
  roundFill(ctx, cx - 28, H * 0.6, 56, H * 0.16, 8, dark, ink);
  roundFill(ctx, cx - 12, H * 0.62, 24, H * 0.07, 4, visor);
  ellipseFill(ctx, cx, H * 0.655, 6, 6, glow);

  // Head, side panels and visor.
  roundFill(ctx, cx - 44, H * 0.22, 88, H * 0.32, 18, metal, ink);
  roundFill(ctx, cx - 36, H * 0.25, 72, H * 0.06, 4, light);
  roundFill(ctx, cx - 52, H * 0.27, 12, H * 0.18, 5, joint, ink);
  roundFill(ctx, cx + 40, H * 0.27, 12, H * 0.18, 5, joint, ink);
  roundFill(ctx, cx - 32, H * 0.33, 64, H * 0.13, 8, visor, ink);
  ellipseFill(ctx, cx - 14, H * 0.395, 7, 7, glow);
  ellipseFill(ctx, cx + 14, H * 0.395, 7, 7, glow);
  ellipseFill(ctx, cx - 14, H * 0.395, 3, 3, "#eaffd5");
  ellipseFill(ctx, cx + 14, H * 0.395, 3, 3, "#eaffd5");

  // Antenna.
  ctx.strokeStyle = joint;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, H * 0.22);
  ctx.lineTo(cx, H * 0.12);
  ctx.stroke();
  ellipseFill(ctx, cx, H * 0.105, 7, 7, glow);
  ellipseFill(ctx, cx - 2, H * 0.1, 2, 2, "#f2ffdf");

  // Metallic highlight.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 28, H * 0.27);
  ctx.lineTo(cx - 10, H * 0.25);
  ctx.stroke();
}

function drawBaoPortrait(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const cx = W * 0.5;
  const ink = "rgba(36, 33, 31, 0.3)";
  const white = "#fff3e0";
  const black = "#24211f";
  const belly = "#ffe9cc";
  const pink = "#ff8fa8";
  const eye = "#e8d8bc";
  const pupil = "#1b1714";
  const bamboo = "#7fbf5a";

  ellipseFill(ctx, cx, H * 0.85, W * 0.24, H * 0.05, "rgba(36, 33, 31, 0.18)");

  // Bamboo stalk behind the panda.
  roundFill(ctx, cx - 74, H * 0.16, 10, H * 0.56, 5, bamboo, ink);
  ellipseFill(ctx, cx - 52, H * 0.24, 18, 6, "#8ed06a");
  ellipseFill(ctx, cx - 86, H * 0.34, 16, 6, "#8ed06a");
  ellipseFill(ctx, cx - 54, H * 0.43, 14, 5, "#8ed06a");

  // Body and arms.
  roundFill(ctx, cx - 36, H * 0.57, 72, H * 0.25, 22, white, ink);
  ellipseFill(ctx, cx, H * 0.66, 20, 24, belly);
  roundFill(ctx, cx - 52, H * 0.58, 20, H * 0.13, 8, black, ink);
  roundFill(ctx, cx + 32, H * 0.58, 20, H * 0.13, 8, black, ink);

  // Head and ears.
  roundFill(ctx, cx - 46, H * 0.18, 92, H * 0.38, 26, white, ink);
  ellipseFill(ctx, cx - 32, H * 0.16, 16, 16, black);
  ellipseFill(ctx, cx + 32, H * 0.16, 16, 16, black);

  // Tilted black eye patches.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 18, H * 0.315);
    ctx.rotate(side * 0.26);
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 18, 0, 0, TAU);
    ctx.fillStyle = black;
    ctx.fill();
    ctx.restore();
  }
  ellipseFill(ctx, cx - 16, H * 0.33, 5.5, 5.5, eye);
  ellipseFill(ctx, cx + 16, H * 0.33, 5.5, 5.5, eye);
  ellipseFill(ctx, cx - 16, H * 0.33, 2.6, 2.6, pupil);
  ellipseFill(ctx, cx + 16, H * 0.33, 2.6, 2.6, pupil);

  // Muzzle and nose.
  ellipseFill(ctx, cx, H * 0.43, 16, 12, belly);
  ellipseFill(ctx, cx, H * 0.405, 5.5, 4, black);
  ellipseFill(ctx, cx - 30, H * 0.4, 5, 3, pink);
  ellipseFill(ctx, cx + 30, H * 0.4, 5, 3, pink);
}

function paintPortrait(canvasEl: HTMLCanvasElement, key: SkinId): void {
  const ctx = canvasEl.getContext("2d");
  if (!ctx) return;
  const W = canvasEl.width;
  const H = canvasEl.height;
  const skin = SKINS[key];
  const cx = W * 0.5;
  const ink = "rgba(32,49,58,0.28)";
  const body = cssColor(skin.body);
  const bodyShade = cssColor(skin.bodyShade);
  const belly = cssColor(skin.belly);
  const wing = cssColor(skin.wing);
  const feet = cssColor(skin.feet);
  const eye = cssColor(skin.eye);
  const pupil = cssColor(skin.pupil);
  const beak = cssColor(skin.beak);
  const comb = cssColor(skin.comb);
  const mane = cssColor(skin.mane);
  const horn = cssColor(skin.horn);
  const accent = cssColor(skin.accent);
  ctx.clearRect(0, 0, W, H);
  if (skin.style === "ditoshey") {
    drawDitosheyPortrait(ctx, W, H);
    return;
  }
  if (skin.style === "higanbanban") {
    drawHiganbanbanPortrait(ctx, W, H);
    return;
  }
  if (skin.style === "severina") {
    drawSeverinaPortrait(ctx, W, H);
    return;
  }
  if (skin.style === "moryaka") {
    drawMoryakaPortrait(ctx, W, H);
    return;
  }
  if (skin.style === "vex") {
    drawVexPortrait(ctx, W, H);
    return;
  }
  if (skin.style === "bao") {
    drawBaoPortrait(ctx, W, H);
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#20313a";
  ctx.beginPath();
  ctx.ellipse(cx, H * 0.85, W * 0.26, H * 0.055, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  roundFill(ctx, cx - 28, H * 0.77, 22, 13, 6, feet, ink);
  roundFill(ctx, cx + 6, H * 0.77, 22, 13, 6, feet, ink);
  roundFill(ctx, cx - 47, H * 0.48, 18, 34, 9, wing, ink);
  roundFill(ctx, cx + 29, H * 0.48, 18, 34, 9, wing, ink);

  if (skin.style === "frog") {
    roundFill(ctx, cx - 40, H * 0.43, 80, 53, 24, body, ink);
    ellipseFill(ctx, cx, H * 0.64, 27, 24, belly);
  } else if (skin.style === "penguin") {
    roundFill(ctx, cx - 36, H * 0.39, 72, 58, 24, body, ink);
    ellipseFill(ctx, cx, H * 0.63, 22, 28, belly);
  } else {
    roundFill(ctx, cx - 36, H * 0.41, 72, 56, 23, body, ink);
    ellipseFill(ctx, cx, H * 0.64, 21, 25, belly);
  }

  const headTop = H * 0.18;
  const headH = H * 0.35;
  if (skin.style === "frog") {
    roundFill(ctx, cx - 37, headTop + 8, 74, H * 0.3, 24, body, ink);
    ellipseFill(ctx, cx - 22, headTop + 5, 17, 16, "#f8fff1");
    ellipseFill(ctx, cx + 22, headTop + 5, 17, 16, "#f8fff1");
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx - 22, headTop + 5, 17, 16, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 22, headTop + 5, 17, 16, 0, 0, TAU);
    ctx.stroke();
    ellipseFill(ctx, cx - 22, headTop + 7, 7, 9, pupil);
    ellipseFill(ctx, cx + 22, headTop + 7, 7, 9, pupil);
    ellipseFill(ctx, cx - 24, headTop + 3, 2.5, 3, "#ffffff");
    ellipseFill(ctx, cx + 20, headTop + 3, 2.5, 3, "#ffffff");
    ctx.strokeStyle = "rgba(45,75,43,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, H * 0.43, 15, 0.22, Math.PI - 0.22);
    ctx.stroke();
    ellipseFill(ctx, cx - 27, H * 0.47, 4, 2.5, "rgba(255,121,168,0.45)");
    ellipseFill(ctx, cx + 27, H * 0.47, 4, 2.5, "rgba(255,121,168,0.45)");
    ellipseFill(ctx, cx - 25, H * 0.69, 4, 4, bodyShade);
    ellipseFill(ctx, cx + 26, H * 0.62, 3.4, 3.4, bodyShade);
    return;
  }

  roundFill(ctx, cx - 32, headTop, 64, headH + 10, 22, body, ink);

  if (skin.style === "unicorn") {
    ellipseFill(ctx, cx - 33, headTop + 8, 17, 23, mane);
    ellipseFill(ctx, cx - 35, headTop + 33, 13, 20, mane);
    roundFill(ctx, cx - 25, headTop - 15, 50, 20, 10, mane, ink);
    ctx.beginPath();
    ctx.moveTo(cx - 26, headTop + 2);
    ctx.lineTo(cx - 34, headTop - 18);
    ctx.lineTo(cx - 13, headTop - 7);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 7, headTop - 6);
    ctx.lineTo(cx, headTop - 45);
    ctx.lineTo(cx + 8, headTop - 6);
    ctx.closePath();
    ctx.fillStyle = horn;
    ctx.fill();
    ctx.strokeStyle = "rgba(32,49,58,0.22)";
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, headTop - 36);
    ctx.lineTo(cx + 2, headTop - 17);
    ctx.stroke();
    ellipseFill(ctx, cx, headTop + 34, 25, 19, belly);
    ellipseFill(ctx, cx - 12, headTop + 35, 2.2, 3, "rgba(155,95,120,0.55)");
    ellipseFill(ctx, cx + 12, headTop + 35, 2.2, 3, "rgba(155,95,120,0.55)");
    ellipseFill(ctx, cx - 16, headTop + 17, 6.2, 8, eye);
    ellipseFill(ctx, cx + 16, headTop + 17, 6.2, 8, eye);
    ellipseFill(ctx, cx - 14, headTop + 14, 2, 2.6, "#ffffff");
    ellipseFill(ctx, cx + 18, headTop + 14, 2, 2.6, "#ffffff");
    ellipseFill(ctx, cx - 26, headTop + 29, 7, 4, "rgba(255,121,168,0.3)");
    ellipseFill(ctx, cx + 26, headTop + 29, 7, 4, "rgba(255,121,168,0.3)");
    sparkle(ctx, cx + 47, headTop + 5, 6, "#ffd23f");
    sparkle(ctx, cx - 51, H * 0.37, 4, "#ff79a8");
    return;
  }

  if (skin.style === "penguin") {
    ctx.beginPath();
    ctx.ellipse(cx, headTop + 25, 26, 25, 0, 0, TAU);
    ctx.fillStyle = belly;
    ctx.fill();
    roundFill(ctx, cx - 31, headTop + 44, 62, 10, 5, accent, ink);
    roundFill(ctx, cx + 17, headTop + 48, 11, 24, 5, accent, ink);
    ellipseFill(ctx, cx - 13, headTop + 20, 5.8, 7.5, eye);
    ellipseFill(ctx, cx + 13, headTop + 20, 5.8, 7.5, eye);
    ellipseFill(ctx, cx - 11, headTop + 17, 1.8, 2.4, "#ffffff");
    ellipseFill(ctx, cx + 15, headTop + 17, 1.8, 2.4, "#ffffff");
    ctx.beginPath();
    ctx.moveTo(cx - 9, headTop + 30);
    ctx.lineTo(cx, headTop + 41);
    ctx.lineTo(cx + 9, headTop + 30);
    ctx.closePath();
    ctx.fillStyle = beak;
    ctx.fill();
    ctx.strokeStyle = "rgba(154,92,15,0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.27)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx - 8, headTop + 8, 20, Math.PI * 1.05, Math.PI * 1.42);
    ctx.stroke();
    return;
  }

  // Chicken.
  roundFill(ctx, cx - 22, headTop - 12, 13, 22, 6, comb, ink);
  roundFill(ctx, cx - 6, headTop - 20, 13, 28, 6, comb, ink);
  roundFill(ctx, cx + 10, headTop - 10, 12, 20, 6, comb, ink);
  ellipseFill(ctx, cx - 27, headTop + 29, 7, 4.4, "rgba(255,117,117,0.22)");
  ellipseFill(ctx, cx + 27, headTop + 29, 7, 4.4, "rgba(255,117,117,0.22)");
  ellipseFill(ctx, cx - 14, headTop + 19, 6, 7.8, eye);
  ellipseFill(ctx, cx + 14, headTop + 19, 6, 7.8, eye);
  ellipseFill(ctx, cx - 12, headTop + 16, 1.9, 2.5, "#ffffff");
  ellipseFill(ctx, cx + 16, headTop + 16, 1.9, 2.5, "#ffffff");
  ctx.beginPath();
  ctx.moveTo(cx - 10, headTop + 30);
  ctx.lineTo(cx, headTop + 43);
  ctx.lineTo(cx + 10, headTop + 30);
  ctx.closePath();
  ctx.fillStyle = beak;
  ctx.fill();
  ctx.strokeStyle = "rgba(161,94,14,0.42)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx - 10, headTop + 9, 19, Math.PI * 1.04, Math.PI * 1.4);
  ctx.stroke();
}

export function drawPortrait(canvasEl: HTMLCanvasElement, key: SkinId): void {
  const W = canvasEl.width;
  const H = canvasEl.height;
  const art = GENERATED_ART[key] ? artImages.get(key) : undefined;
  if (art) {
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const drawArt = (): void => {
      if (!art.complete || !art.naturalWidth) return;
      const nw = art.naturalWidth;
      const nh = art.naturalHeight;
      const crop = ART_HEAD_CROPS[key];
      const srcW = nw * crop.w;
      const srcH = Math.min(nh, srcW * (H / W));
      const sx = nw * crop.x;
      const sy = nh * crop.y;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(art, sx, sy, srcW, srcH, 0, 0, W, H);
    };
    paintPortrait(canvasEl, key);
    if (art.complete) drawArt();
    else art.addEventListener("load", drawArt, { once: true });
    return;
  }
  paintPortrait(canvasEl, key);
}








