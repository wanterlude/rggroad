/* ==========================================================================
   Canvas 2D pseudo-3D renderer.
   A small painter's-algorithm voxel renderer with a perspective camera,
   soft sky, parallax hills, fog and particle helpers.
   ========================================================================== */
(function (CR) {
  "use strict";

  var TAU = CR.TAU;
  var LIGHT = { x: 0.45, y: 0.8, z: -0.4 };
  var LIGHT_LEN = Math.sqrt(LIGHT.x * LIGHT.x + LIGHT.y * LIGHT.y + LIGHT.z * LIGHT.z);
  LIGHT.x /= LIGHT_LEN;
  LIGHT.y /= LIGHT_LEN;
  LIGHT.z /= LIGHT_LEN;

  var CORNER_X = [-1, 1, 1, -1, -1, 1, 1, -1];
  var CORNER_Z = [-1, -1, 1, 1, -1, -1, 1, 1];
  var VX = new Float64Array(8);
  var VY = new Float64Array(8);

  var FACE_DEFS = [
    { cx: 0, cy: 0.5, cz: 1, idx: [3, 7, 6, 2] },
    { cx: 0, cy: 0.5, cz: -1, idx: [1, 5, 4, 0] },
    { cx: 1, cy: 0.5, cz: 0, idx: [2, 6, 5, 1] },
    { cx: -1, cy: 0.5, cz: 0, idx: [0, 4, 7, 3] },
    { cx: 0, cy: 1, cz: 0, idx: [4, 5, 6, 7] }
  ];

  var LOCAL_NORMALS = [
    [0, 0, 1],
    [0, 0, -1],
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0]
  ];

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.f = 700;
    this.horizonY = 160;
    this.camera = { x: 0, y: 6, z: -12, tx: 0, ty: 1, tz: 2, shakeX: 0, shakeY: 0 };
    this.basis = {
      fx: 0, fy: 0, fz: 1,
      rx: 1, ry: 0, rz: 0,
      ux: 0, uy: 1, uz: 0,
      f: 700, w: 1, h: 1
    };
    this.clouds = [];
    this.birds = [];
    this.skyGradient = null;
    this.sunGradient = null;
    this.hazeGradient = null;
    this.vignette = null;
    this.reducedMotion = false;
    try {
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (error) {
      this.reducedMotion = false;
    }
    this.resize();
    this._seedAtmosphere();
  }

  Renderer.prototype.resize = function () {
    var w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    var h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    var dprCap = h < 500 ? 1.25 : 1.5;
    var dpr = Math.min(window.devicePixelRatio || 1, dprCap);

    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";

    var ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;

    var maxF = Math.min(1180, Math.max(680, h * 1.8));
    this.f = CR.clamp(Math.max(w * 2.35, h * 1.0), 640, maxF);

    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#45bce9");
    sky.addColorStop(0.28, "#73d1ed");
    sky.addColorStop(0.58, "#a8e5ee");
    sky.addColorStop(1, "#e4f7df");
    this.skyGradient = sky;

    var sunX = w * 0.8;
    var sunY = h * 0.105;
    var sunR = Math.max(52, Math.min(w, h) * 0.09);
    var sun = ctx.createRadialGradient(sunX, sunY, sunR * 0.08, sunX, sunY, sunR * 2.2);
    sun.addColorStop(0, "rgba(255, 250, 210, 0.95)");
    sun.addColorStop(0.13, "rgba(255, 244, 174, 0.92)");
    sun.addColorStop(0.33, "rgba(255, 235, 133, 0.26)");
    sun.addColorStop(1, "rgba(255, 235, 133, 0)");
    this.sunGradient = sun;

    var haze = ctx.createLinearGradient(0, Math.max(0, this.horizonY - h * 0.05), 0, this.horizonY + h * 0.3);
    haze.addColorStop(0, "rgba(199, 241, 244, 0.52)");
    haze.addColorStop(0.32, "rgba(207, 243, 240, 0.24)");
    haze.addColorStop(1, "rgba(214, 247, 237, 0)");
    this.hazeGradient = haze;

    var vignette = ctx.createRadialGradient(w * 0.5, h * 0.44, Math.min(w, h) * 0.28, w * 0.5, h * 0.48, Math.max(w, h) * 0.76);
    vignette.addColorStop(0, "rgba(10, 38, 43, 0)");
    vignette.addColorStop(0.7, "rgba(10, 38, 43, 0.035)");
    vignette.addColorStop(1, "rgba(10, 38, 43, 0.2)");
    this.vignette = vignette;

    var ground = ctx.createLinearGradient(0, h * 0.27, 0, h);
    ground.addColorStop(0, "rgba(124, 211, 91, 0)");
    ground.addColorStop(0.18, "rgba(124, 211, 91, 0.55)");
    ground.addColorStop(0.42, "rgba(118, 206, 85, 0.96)");
    ground.addColorStop(1, "rgba(104, 194, 75, 1)");
    this.groundBackdrop = ground;
  };

  Renderer.prototype._seedAtmosphere = function () {
    var rng = CR.mulberry32(918273);
    this.clouds = [];
    for (var i = 0; i < 6; i++) {
      this.clouds.push({
        x: CR.rr(rng, -0.1, 1.05),
        y: CR.rr(rng, 0.045, 0.19),
        scale: CR.rr(rng, 0.55, 1.45),
        speed: CR.rr(rng, 0.0018, 0.006),
        alpha: CR.rr(rng, 0.35, 0.7),
        layer: i % 2
      });
    }
    this.birds = [];
    for (var b = 0; b < 3; b++) {
      this.birds.push({
        x: CR.rr(rng, 0.1, 0.9),
        y: CR.rr(rng, 0.11, 0.2),
        speed: CR.rr(rng, 0.004, 0.009),
        phase: CR.rr(rng, 0, TAU),
        scale: CR.rr(rng, 0.7, 1.2)
      });
    }
  };

  Renderer.prototype.beginFrame = function () {
    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalAlpha = 1;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  };

  Renderer.prototype.setCamera = function (camera) {
    this.camera = camera;
    var dx = camera.tx - camera.x;
    var dy = camera.ty - camera.y;
    var dz = camera.tz - camera.z;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    var fx = dx / len;
    var fy = dy / len;
    var fz = dz / len;

    var rx = fz;
    var ry = 0;
    var rz = -fx;
    var rlen = Math.sqrt(rx * rx + rz * rz) || 1;
    rx /= rlen;
    rz /= rlen;

    var ux = fy * rz - fz * ry;
    var uy = fz * rx - fx * rz;
    var uz = fx * ry - fy * rx;
    var ulen = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    ux /= ulen;
    uy /= ulen;
    uz /= ulen;

    this.basis.fx = fx;
    this.basis.fy = fy;
    this.basis.fz = fz;
    this.basis.rx = rx;
    this.basis.ry = ry;
    this.basis.rz = rz;
    this.basis.ux = ux;
    this.basis.uy = uy;
    this.basis.uz = uz;
    this.basis.f = this.f;
    this.basis.w = this.w;
    this.basis.h = this.h;

    var horizonPoint = this.project(camera.x, camera.y, camera.z + 700);
    this.horizonY = CR.clamp(horizonPoint ? horizonPoint.y : this.h * 0.22, this.h * 0.08, this.h * 0.4);
    this._refreshHaze();
  };

  Renderer.prototype._refreshHaze = function () {
    var ctx = this.ctx;
    var y0 = this.horizonY - this.h * 0.03;
    var y1 = this.horizonY + this.h * 0.34;
    var haze = ctx.createLinearGradient(0, y0, 0, y1);
    haze.addColorStop(0, "rgba(206, 242, 242, 0.46)");
    haze.addColorStop(0.28, "rgba(210, 245, 239, 0.19)");
    haze.addColorStop(1, "rgba(218, 248, 234, 0)");
    this.hazeGradient = haze;
  };

  Renderer.prototype.project = function (x, y, z) {
    var b = this.basis;
    var dx = x - this.camera.x;
    var dy = y - this.camera.y;
    var dz = z - this.camera.z;
    var depth = dx * b.fx + dy * b.fy + dz * b.fz;
    if (depth < 0.12) return null;
    var xc = dx * b.rx + dy * b.ry + dz * b.rz;
    var yc = dx * b.ux + dy * b.uy + dz * b.uz;
    var inv = this.f / depth;
    return {
      x: this.w * 0.5 + xc * inv,
      y: this.h * 0.5 - yc * inv,
      depth: depth,
      scale: inv
    };
  };

  Renderer.prototype.depth = function (x, y, z) {
    var b = this.basis;
    return (x - this.camera.x) * b.fx + (y - this.camera.y) * b.fy + (z - this.camera.z) * b.fz;
  };

  /* ------------------------------------------------------------------------
     Sky
     ------------------------------------------------------------------------ */

  Renderer.prototype.drawSky = function (time) {
    var ctx = this.ctx;
    var w = this.w;
    var h = this.h;

    ctx.fillStyle = this.skyGradient;
    ctx.fillRect(0, 0, w, h);

    var sunX = w * 0.8;
    var sunY = h * 0.105;
    var sunR = Math.max(52, Math.min(w, h) * 0.09);
    ctx.fillStyle = this.sunGradient;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 2.2, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 249, 200, 0.92)";
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 0.42, 0, TAU);
    ctx.fill();

    if (!this.reducedMotion) {
      this._drawClouds(time);
      this._drawBirds(time);
    }

    this._drawHills(time);

    // A soft meadow fill behind the near rows. It catches the tiny area below
    // the camera where ground rows cannot reach, instead of revealing hills.
    if (this.groundBackdrop) {
      ctx.fillStyle = this.groundBackdrop;
      ctx.fillRect(0, h * 0.27, w, h * 0.73);
    }

    var hazeY = this.horizonY;
    var horizonHaze = ctx.createLinearGradient(0, hazeY - h * 0.08, 0, hazeY + h * 0.08);
    horizonHaze.addColorStop(0, "rgba(225, 250, 249, 0)");
    horizonHaze.addColorStop(0.55, "rgba(225, 250, 249, 0.44)");
    horizonHaze.addColorStop(1, "rgba(225, 250, 249, 0)");
    ctx.fillStyle = horizonHaze;
    ctx.fillRect(0, hazeY - h * 0.08, w, h * 0.16);
  };

  Renderer.prototype._drawClouds = function (time) {
    var ctx = this.ctx;
    var w = this.w;

    for (var i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i];
      var travel = (c.x + time * c.speed + this.camera.x * 0.0011) % 1.18;
      if (travel < -0.06) travel += 1.18;
      var x = (travel - 0.09) * w;
      var y = c.y * this.h;
      var s = c.scale * CR.clamp(Math.min(this.w, this.h) / 700, 0.72, 1.8);
      var alpha = c.alpha * (0.75 + 0.25 * Math.sin(time * 0.2 + i));
      if (x < -160 * s || x > w + 160 * s) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(s, s);

      ctx.fillStyle = "rgba(53, 140, 168, 0.08)";
      ctx.beginPath();
      ctx.ellipse(4, 13, 84, 14, 0, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
      ctx.beginPath();
      ctx.ellipse(-46, 4, 37, 19, 0, 0, TAU);
      ctx.ellipse(-15, -7, 38, 28, 0, 0, TAU);
      ctx.ellipse(23, 1, 33, 22, 0, 0, TAU);
      ctx.ellipse(53, 9, 30, 16, 0, 0, TAU);
      ctx.rect(-49, 4, 101, 17);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
      ctx.beginPath();
      ctx.ellipse(-35, 15, 46, 8, 0, 0, TAU);
      ctx.ellipse(40, 17, 38, 7, 0, 0, TAU);
      ctx.fill();

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  Renderer.prototype._drawBirds = function (time) {
    var ctx = this.ctx;
    var w = this.w;
    ctx.save();
    ctx.strokeStyle = "rgba(38, 78, 84, 0.36)";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    for (var i = 0; i < this.birds.length; i++) {
      var b = this.birds[i];
      var x = ((b.x + time * b.speed) % 1.2) * w - w * 0.1;
      var y = b.y * this.h + Math.sin(time * 0.7 + b.phase) * 5;
      var flap = Math.sin(time * 5 + b.phase) * 3;
      var s = b.scale;
      ctx.beginPath();
      ctx.moveTo(x - 5 * s, y + flap);
      ctx.quadraticCurveTo(x - 2 * s, y - 2 * s, x, y);
      ctx.quadraticCurveTo(x + 2 * s, y - 2 * s, x + 5 * s, y + flap);
      ctx.stroke();
    }
    ctx.restore();
  };

  Renderer.prototype._drawHills = function (time) {
    var ctx = this.ctx;
    var w = this.w;
    var h = this.h;
    var horizon = this.horizonY;
    var cam = this.camera;

    var layers = [
      { base: horizon + h * 0.012, amp: h * 0.038, color: "rgba(137, 205, 186, 0.58)", speed: 0.0009, phase: 0.8 },
      { base: horizon + h * 0.045, amp: h * 0.05, color: "rgba(104, 188, 151, 0.72)", speed: 0.0016, phase: 2.8 },
      { base: horizon + h * 0.083, amp: h * 0.055, color: "rgba(77, 164, 118, 0.82)", speed: 0.0024, phase: 4.9 }
    ];

    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var phase = layer.phase + cam.x * layer.speed + cam.z * layer.speed * 0.36;
      ctx.beginPath();
      ctx.moveTo(-20, h + 20);
      ctx.lineTo(-20, layer.base);
      var step = 22;
      for (var x = -20; x <= w + 20; x += step) {
        var wave =
          Math.sin(x * 0.0052 + phase) * 0.55 +
          Math.sin(x * 0.011 + phase * 1.7) * 0.28 +
          Math.sin(x * 0.022 + phase * 0.6) * 0.12;
        var y = layer.base - layer.amp * (0.48 + wave * 0.62);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 20, h + 20);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();

      if (i === 2) {
        this._drawHillTrees(layer, phase);
      }
    }

    ctx.globalAlpha = 1;
  };

  Renderer.prototype._drawHillTrees = function (layer, phase) {
    var ctx = this.ctx;
    var w = this.w;
    ctx.fillStyle = "rgba(49, 126, 89, 0.5)";
    for (var i = 0; i < 9; i++) {
      var x = ((i * 0.127 + 0.03) * w + Math.sin(i * 8.1) * 38 + phase * 12) % (w + 100) - 50;
      var wave =
        Math.sin(x * 0.0052 + phase) * 0.55 +
        Math.sin(x * 0.011 + phase * 1.7) * 0.28 +
        Math.sin(x * 0.022 + phase * 0.6) * 0.12;
      var base = layer.base - layer.amp * (0.48 + wave * 0.62) + 2;
      var size = 5 + ((i * 13) % 7);
      ctx.beginPath();
      ctx.moveTo(x, base - size * 1.7);
      ctx.lineTo(x - size * 0.55, base);
      ctx.lineTo(x + size * 0.55, base);
      ctx.closePath();
      ctx.fill();
    }
  };

  /* ------------------------------------------------------------------------
     World frame
     ------------------------------------------------------------------------ */

  Renderer.prototype.beginWorld = function (shakeX, shakeY) {
    var ctx = this.ctx;
    ctx.save();
    if (shakeX || shakeY) {
      ctx.translate(shakeX || 0, shakeY || 0);
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  };

  Renderer.prototype.endWorld = function () {
    this.ctx.restore();
  };

  Renderer.prototype.drawHaze = function () {
    var ctx = this.ctx;
    if (this.hazeGradient) {
      ctx.fillStyle = this.hazeGradient;
      ctx.fillRect(0, this.horizonY - this.h * 0.03, this.w, this.h * 0.38);
    }
  };

  Renderer.prototype.drawVignette = function () {
    var ctx = this.ctx;
    if (this.vignette) {
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  };

  /* ------------------------------------------------------------------------
     Cubes
     ------------------------------------------------------------------------ */

  Renderer.prototype.cube = function (x, baseY, z, sx, sy, sz, color, options) {
    var ctx = this.ctx;
    var opts = options || {};
    var yaw = opts.yaw || 0;
    var cos = Math.cos(yaw);
    var sin = Math.sin(yaw);
    var hx = sx * 0.5;
    var hz = sz * 0.5;
    var topY = baseY + sy;

    var b = this.basis;
    var cam = this.camera;
    var f = this.f;
    var halfW = this.w * 0.5;
    var halfH = this.h * 0.5;
    var minX = Infinity;
    var maxX = -Infinity;
    var minY = Infinity;
    var maxY = -Infinity;

    for (var i = 0; i < 8; i++) {
      var lx = CORNER_X[i] * hx;
      var lz = CORNER_Z[i] * hz;
      var wx = x + lx * cos + lz * sin;
      var wz = z - lx * sin + lz * cos;
      var dx = wx - cam.x;
      var dy = (i < 4 ? baseY : topY) - cam.y;
      var dz = wz - cam.z;
      var depth = dx * b.fx + dy * b.fy + dz * b.fz;
      if (depth < 0.12) return;
      var inv = f / depth;
      var px = halfW + (dx * b.rx + dy * b.ry + dz * b.rz) * inv;
      var py = halfH - (dx * b.ux + dy * b.uy + dz * b.uz) * inv;
      VX[i] = px;
      VY[i] = py;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    var margin = 70;
    if (maxX < -margin || minX > this.w + margin || maxY < -margin || minY > this.h + margin) {
      return;
    }
    if (maxX - minX < 0.9 && maxY - minY < 0.9) return;

    var alpha = opts.alpha == null ? 1 : opts.alpha;
    if (alpha <= 0.004) return;
    var outline = !(maxX - minX < 5 && maxY - minY < 5) && opts.outline !== false;

    var previousAlpha = ctx.globalAlpha;
    if (alpha !== 1) ctx.globalAlpha = alpha;

    var toneShift = opts.tone || 0;
    for (var faceIndex = 0; faceIndex < 5; faceIndex++) {
      var face = FACE_DEFS[faceIndex];
      var localNormal = LOCAL_NORMALS[faceIndex];
      var nx = localNormal[0] * cos + localNormal[2] * sin;
      var ny = localNormal[1];
      var nz = -localNormal[0] * sin + localNormal[2] * cos;

      var faceCx = face.cx * hx;
      var faceCz = face.cz * hz;
      var wx2 = x + faceCx * cos + faceCz * sin;
      var wz2 = z - faceCx * sin + faceCz * cos;
      var wy2 = baseY + face.cy * sy;

      if (nx * (cam.x - wx2) + ny * (cam.y - wy2) + nz * (cam.z - wz2) <= 0) continue;

      var light = Math.max(0, nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z);
      var tone = 0.46 + light * 0.36 + Math.max(0, ny) * 0.16 + toneShift;
      var fill = CR.shade(color, tone - 0.72);

      var a = face.idx[0];
      var bb = face.idx[1];
      var c = face.idx[2];
      var d = face.idx[3];
      ctx.beginPath();
      ctx.moveTo(VX[a], VY[a]);
      ctx.lineTo(VX[bb], VY[bb]);
      ctx.lineTo(VX[c], VY[c]);
      ctx.lineTo(VX[d], VY[d]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (outline) {
        ctx.strokeStyle = fill;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }

    if (alpha !== 1) ctx.globalAlpha = previousAlpha;
  };

  Renderer.prototype.flatQuad = function (x, y, z, sx, sz, color, alpha) {
    var ctx = this.ctx;
    var halfX = sx * 0.5;
    var halfZ = sz * 0.5;
    var pts = [
      [x - halfX, z - halfZ],
      [x + halfX, z - halfZ],
      [x + halfX, z + halfZ],
      [x - halfX, z + halfZ]
    ];
    var projected = [];
    for (var i = 0; i < 4; i++) {
      var p = this.project(pts[i][0], y, pts[i][1]);
      if (!p) return;
      projected.push(p);
    }
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(projected[0].x, projected[0].y);
    for (var j = 1; j < 4; j++) ctx.lineTo(projected[j].x, projected[j].y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  Renderer.prototype.shadow = function (x, z, rx, rz, alpha, y) {
    var ctx = this.ctx;
    var points = 8;
    var cy = y == null ? 0.075 : y;
    var first = null;
    ctx.beginPath();
    for (var i = 0; i < points; i++) {
      var angle = (i / points) * TAU;
      var p = this.project(x + Math.cos(angle) * rx, cy, z + Math.sin(angle) * rz);
      if (!p) return;
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
        first = p;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.closePath();
    ctx.globalAlpha = alpha == null ? 0.22 : alpha;
    ctx.fillStyle = "#16352d";
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  Renderer.prototype.line = function (x1, y1, z1, x2, y2, z2, color, width) {
    var a = this.project(x1, y1, z1);
    var b = this.project(x2, y2, z2);
    if (!a || !b) return;
    var ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  /* ------------------------------------------------------------------------
     Particles
     ------------------------------------------------------------------------ */

  Renderer.prototype.drawParticles = function (particles, time) {
    if (!particles || particles.length === 0) return;
    var ctx = this.ctx;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var progress = p.life / p.maxLife;
      if (progress <= 0) continue;
      var proj = this.project(p.x, p.y, p.z);
      if (!proj) continue;
      var alpha = CR.clamp(progress, 0, 1);
      var scale = proj.scale;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === "text") {
        var rise = (1 - progress) * 38;
        var size = CR.clamp(16 + scale * 0.22, 13, 26);
        ctx.font = "900 " + size + "px 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(32,49,58,0.65)";
        ctx.strokeText(p.text, proj.x, proj.y - 20 - rise);
        ctx.fillStyle = p.color || "#fff7e2";
        ctx.fillText(p.text, proj.x, proj.y - 20 - rise);
      } else if (p.type === "star") {
        var starSize = Math.max(2, p.size * scale);
        var pulse = 0.65 + 0.35 * Math.sin(time * 9 + p.seed);
        ctx.strokeStyle = p.color || "#fff6b0";
        ctx.lineWidth = Math.max(1, 1.5 * pulse);
        ctx.beginPath();
        ctx.moveTo(proj.x - starSize, proj.y);
        ctx.lineTo(proj.x + starSize, proj.y);
        ctx.moveTo(proj.x, proj.y - starSize);
        ctx.lineTo(proj.x, proj.y + starSize);
        ctx.stroke();
      } else if (p.type === "ring") {
        var radius = Math.max(1, (1 - progress) * p.size * scale);
        ctx.strokeStyle = p.color || "rgba(255,255,255,0.9)";
        ctx.lineWidth = Math.max(1, 2 * progress);
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, radius, 0, TAU);
        ctx.stroke();
      } else if (p.type === "feather") {
        var fs = Math.max(2, p.size * scale);
        ctx.translate(proj.x, proj.y);
        ctx.rotate((p.rot || 0) + time * (p.spin || 4));
        ctx.fillStyle = p.color || "#fff7e2";
        CR.roundRectPath(ctx, -fs * 0.55, -fs * 0.23, fs * 1.1, fs * 0.46, fs * 0.2);
        ctx.fill();
      } else {
        var dotSize = Math.max(1, p.size * scale);
        ctx.fillStyle = p.color || "#fff7e2";
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, dotSize, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  /* ------------------------------------------------------------------------
     Debug
     ------------------------------------------------------------------------ */

  Renderer.prototype.drawDebug = function (lines) {
    var ctx = this.ctx;
    ctx.save();
    ctx.font = "11px Consolas, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    var y = 100;
    for (var i = 0; i < lines.length; i++) {
      var text = lines[i];
      ctx.fillStyle = "rgba(10,30,32,0.55)";
      var w = ctx.measureText(text).width + 10;
      ctx.fillRect(8, y - 2, w, 16);
      ctx.fillStyle = "#d6ffe8";
      ctx.fillText(text, 13, y);
      y += 17;
    }
    ctx.restore();
  };

  CR.Renderer = Renderer;
})(window.CR = window.CR || {});
