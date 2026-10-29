/* ==========================================================================
   Core helpers, palette, character definitions and save data.
   ========================================================================== */
(function (CR) {
  "use strict";

  var TAU = Math.PI * 2;
  CR.TAU = TAU;

  CR.clamp = function (value, min, max) {
    return value < min ? min : value > max ? max : value;
  };

  CR.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  CR.damp = function (a, b, lambda, dt) {
    return CR.lerp(a, b, 1 - Math.exp(-lambda * dt));
  };

  CR.easeOutCubic = function (t) {
    var p = 1 - t;
    return 1 - p * p * p;
  };

  CR.easeInCubic = function (t) {
    return t * t * t;
  };

  CR.easeOutBack = function (t) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    var p = t - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
  };

  CR.angleDelta = function (from, to) {
    var d = (to - from + Math.PI) % TAU;
    if (d < 0) d += TAU;
    return d - Math.PI;
  };

  CR.dampAngle = function (from, to, lambda, dt) {
    return from + CR.angleDelta(from, to) * (1 - Math.exp(-lambda * dt));
  };

  CR.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  CR.hash2 = function (x, y, seed) {
    var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  CR.pick = function (rng, list) {
    return list[Math.floor(rng() * list.length)];
  };

  CR.rr = function (rng, min, max) {
    return min + rng() * (max - min);
  };

  CR.chance = function (rng, probability) {
    return rng() < probability;
  };

  CR.wrap = function (value, min, max) {
    var span = max - min;
    while (value < min) value += span;
    while (value >= max) value -= span;
    return value;
  };

  CR.fmt = function (value) {
    if (value >= 100000) return "99K+";
    return String(Math.max(0, Math.round(value)));
  };

  CR.roundRectPath = function (ctx, x, y, w, h, r) {
    var radius = Math.min(r, Math.abs(w) * 0.5, Math.abs(h) * 0.5);
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
  };

  /* ------------------------------------------------------------------------
     Colour utilities
     ------------------------------------------------------------------------ */

  var shadeCache = new Map();

  function parseHex(hex) {
    var s = String(hex).replace("#", "");
    if (s.length === 3) {
      s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    }
    var n = parseInt(s, 16);
    if (!isFinite(n)) return [255, 255, 255];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  CR.shade = function (hex, amount) {
    var key = hex + "|" + amount.toFixed(2);
    var cached = shadeCache.get(key);
    if (cached) return cached;
    var rgb = parseHex(hex);
    var t = CR.clamp(amount, -1, 1);
    var r, g, b;
    if (t >= 0) {
      r = rgb[0] + (255 - rgb[0]) * t;
      g = rgb[1] + (255 - rgb[1]) * t;
      b = rgb[2] + (255 - rgb[2]) * t;
    } else {
      var k = 1 + t;
      r = rgb[0] * k;
      g = rgb[1] * k;
      b = rgb[2] * k;
    }
    var out = "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + ")";
    shadeCache.set(key, out);
    return out;
  };

  CR.rgba = function (hex, alpha) {
    var rgb = parseHex(hex);
    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + alpha + ")";
  };

  /* ------------------------------------------------------------------------
     Shared palette
     ------------------------------------------------------------------------ */

  CR.PALETTE = {
    grass: ["#7cd35b", "#73ca52", "#82d763", "#6fc54e"],
    grassDark: "#4ea43a",
    grassLight: "#a2e77b",
    curb: "#d8d3ba",
    road: "#4b535c",
    roadAlt: "#454d56",
    roadLine: "#f4ead3",
    roadLineSoft: "#d8cfb9",
    railBed: "#9a8c76",
    railBedDark: "#837763",
    railSteel: "#5e6972",
    railSteelLight: "#9ea9ad",
    sleeper: "#68543d",
    water: "#35b4dc",
    waterDeep: "#2493be",
    waterLight: "#8be1f4",
    foam: "#d8f8ff",
    log: "#a46b3b",
    logDark: "#7b4b28",
    logLight: "#c68b54",
    trunk: "#7a5130",
    leaves: ["#47a93d", "#3c9c38", "#58b847", "#2f8a35"],
    leavesLight: ["#69c956", "#59bd4a", "#7ad568"],
    rock: "#8d9698",
    rockDark: "#6e787c",
    rockLight: "#b9c1c1",
    flower: ["#ff7aa8", "#ffd23f", "#ffffff", "#b58cff", "#ff8a3d"],
    vehicles: ["#e94f4f", "#3b82d9", "#f4b62e", "#2fb9a0", "#8f6ae8", "#ef7d3e", "#f7f0e1", "#48a65d"]
  };

  CR.VEHICLE_TYPES = {
    car: { length: 1.55, width: 0.82, weight: 4 },
    taxi: { length: 1.7, width: 0.84, weight: 2 },
    van: { length: 2.05, width: 0.88, weight: 2 },
    bus: { length: 3.15, width: 0.92, weight: 1 },
    truck: { length: 2.75, width: 0.92, weight: 1.4 }
  };

  /* ------------------------------------------------------------------------
     Characters
     ------------------------------------------------------------------------ */

  CR.SKINS = {
    chicken: {
      name: "Цыпа",
      cost: 0,
      style: "chicken",
      body: "#fff7e8",
      bodyShade: "#f3ddbd",
      belly: "#fffdf8",
      wing: "#ead4b4",
      comb: "#ff5a52",
      beak: "#ffb52e",
      feet: "#ff9b21",
      eye: "#25333b",
      accent: "#ffd23f",
      badge: "Классика"
    },
    penguin: {
      name: "Пингвин",
      cost: 80,
      style: "penguin",
      body: "#293a49",
      bodyShade: "#1d2b37",
      belly: "#f8fbff",
      wing: "#22313e",
      comb: null,
      beak: "#ff9f2f",
      feet: "#ff9f2f",
      eye: "#111b24",
      accent: "#55c8e8",
      badge: "Щёголь"
    },
    frog: {
      name: "Квак",
      cost: 160,
      style: "frog",
      body: "#6acb50",
      bodyShade: "#55b23e",
      belly: "#e2f69a",
      wing: "#5aba44",
      comb: null,
      beak: "#f06a7e",
      feet: "#4fa239",
      eye: "#ffffff",
      pupil: "#1d3421",
      accent: "#ff79a8",
      badge: "Прыгун"
    },
    unicorn: {
      name: "Единорог",
      cost: 300,
      style: "unicorn",
      body: "#fff0f7",
      bodyShade: "#f0d6e4",
      belly: "#fffafd",
      wing: "#ffdfec",
      comb: "#ff76b2",
      mane: "#ff76b2",
      horn: "#ffd23f",
      beak: "#ffb52e",
      feet: "#b58cff",
      eye: "#3b294b",
      accent: "#b58cff",
      badge: "Легенда"
    }
  };

  CR.SKIN_ORDER = ["chicken", "penguin", "frog", "unicorn"];

  /* ------------------------------------------------------------------------
     Save data
     ------------------------------------------------------------------------ */

  var SAVE_KEY = "crossyRoadClone.save.v1";

  var defaults = {
    best: 0,
    coins: 0,
    skin: "chicken",
    unlocked: ["chicken"],
    muted: false,
    runs: 0
  };

  function sanitize(raw) {
    var data = Object.assign({}, defaults);
    if (!raw || typeof raw !== "object") return data;

    if (typeof raw.best === "number" && isFinite(raw.best)) {
      data.best = Math.max(0, Math.floor(raw.best));
    }
    if (typeof raw.coins === "number" && isFinite(raw.coins)) {
      data.coins = Math.max(0, Math.floor(raw.coins));
    }
    if (typeof raw.runs === "number" && isFinite(raw.runs)) {
      data.runs = Math.max(0, Math.floor(raw.runs));
    }
    if (Array.isArray(raw.unlocked)) {
      var unlocked = ["chicken"];
      raw.unlocked.forEach(function (id) {
        if (CR.SKINS[id] && unlocked.indexOf(id) === -1) unlocked.push(id);
      });
      data.unlocked = unlocked;
    }
    if (typeof raw.skin === "string" && CR.SKINS[raw.skin] && data.unlocked.indexOf(raw.skin) !== -1) {
      data.skin = raw.skin;
    }
    data.muted = raw.muted === true;
    return data;
  }

  var save = {
    data: defaults,
    write: function () {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save.data));
      } catch (error) {
        /* Private mode or file:// restrictions: game still works in memory. */
      }
    },
    update: function (patch) {
      if (!patch) return;
      Object.keys(patch).forEach(function (key) {
        save.data[key] = patch[key];
      });
      save.write();
    },
    reset: function () {
      save.data = Object.assign({}, defaults);
      save.write();
    }
  };

  try {
    var stored = localStorage.getItem(SAVE_KEY);
    if (stored) save.data = sanitize(JSON.parse(stored));
  } catch (error) {
    save.data = sanitize(null);
  }

  CR.save = save;
})(window.CR = window.CR || {});
