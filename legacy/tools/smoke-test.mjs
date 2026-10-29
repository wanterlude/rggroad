import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
process.on("uncaughtException", (error) => {
  errors.push(error);
  console.error("UNCAUGHT:", error);
});
process.on("unhandledRejection", (error) => {
  errors.push(error);
  console.error("UNHANDLED:", error);
});

/* --------------------------------------------------------------------------
   Tiny DOM / canvas stubs, just enough to execute the real game code.
   -------------------------------------------------------------------------- */

const gradient = { addColorStop() {} };
let currentCanvas = null;

function makeContext(canvas) {
  const state = {
    canvas,
    globalAlpha: 1,
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineJoin: "miter",
    lineCap: "butt",
    font: "10px sans-serif",
    textAlign: "left",
    textBaseline: "alphabetic"
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => gradient;
      }
      if (prop === "measureText") return () => ({ width: 32 });
      if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

class ClassList {
  constructor() { this.items = new Set(); }
  add(...names) { names.forEach((n) => this.items.add(n)); }
  remove(...names) { names.forEach((n) => this.items.delete(n)); }
  toggle(name, force) {
    if (force === true) this.items.add(name);
    else if (force === false) this.items.delete(name);
    else if (this.items.has(name)) this.items.delete(name);
    else this.items.add(name);
    return this.items.has(name);
  }
  contains(name) { return this.items.has(name); }
}

class Element {
  constructor(tag = "div", id = "") {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this.classList = new ClassList();
    this.textContent = "";
    this._innerHTML = "";
    this.offsetWidth = 100;
    this.width = 300;
    this.height = 150;
    this.clientWidth = 1280;
    this.clientHeight = 800;
    this.value = "";
    this.disabled = false;
    this._ctx = null;
    if (this.tagName === "CANVAS") {
      this._ctx = makeContext(this);
    }
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(value) {
    this._innerHTML = String(value);
    if (value === "") this.children = [];
  }
  getContext(type) { return this._ctx; }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    this.children = this.children.filter((c) => c !== child);
  }
  addEventListener(type, fn) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  }
  removeEventListener(type, fn) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((f) => f !== fn);
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  removeAttribute(name) { delete this.attributes[name]; }
  focus() { globalThis.document.activeElement = this; }
  blur() { if (globalThis.document.activeElement === this) globalThis.document.activeElement = null; }
  click() { this.trigger("click"); }
  trigger(type, event) {
    const list = this.listeners[type] || [];
    for (const fn of list) {
      fn(event || {
        type,
        target: this,
        currentTarget: this,
        preventDefault() {},
        stopPropagation() {},
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        clientX: 0,
        clientY: 0
      });
    }
  }
  querySelector() { return null; }
  getBoundingClientRect() { return { x: 0, y: 0, width: 1280, height: 800, top: 0, left: 0 }; }
}

const ids = [
  "game", "hud", "menu", "pauseScreen", "gameoverScreen", "scoreValue", "bestValue",
  "coinValue", "newBestBadge", "tutorial", "menuBest", "menuCoins", "skinRail",
  "playBtn", "menuSoundBtn", "menuSoundLabel", "pauseBtn", "resumeBtn",
  "pauseRestartBtn", "pauseMenuBtn", "pauseSoundBtn", "pauseSoundLabel", "retryBtn",
  "overMenuBtn", "overTitle", "overMessage", "finalScore", "finalBest", "runCoins",
  "newBestRibbon", "toast", "flash"
];
const elements = new Map();
for (const id of ids) {
  const tag = id === "game" ? "canvas" : "div";
  elements.set(id, new Element(tag, id));
}

const bestInline = new Element("span");
const scorePill = new Element("div");
const coinPill = new Element("div");

globalThis.document = {
  documentElement: { clientWidth: 1280, clientHeight: 800 },
  activeElement: null,
  _listeners: {},
  getElementById(id) { return elements.get(id) || null; },
  querySelector(selector) {
    if (selector === ".best-inline") return bestInline;
    if (selector === ".score-pill") return scorePill;
    if (selector === ".coin-pill") return coinPill;
    return null;
  },
  createElement(tag) { return new Element(tag); },
  addEventListener(type, fn) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(fn);
  },
  trigger(type, event) {
    for (const fn of this._listeners[type] || []) fn(event || { type, preventDefault() {} });
  }
};

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};

globalThis.window = globalThis;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 800;
globalThis.devicePixelRatio = 1;
globalThis.location = { search: "" };
globalThis.scrollTo = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.addEventListener = function (type, fn) {
  if (!globalThis._windowListeners) globalThis._windowListeners = {};
  if (!globalThis._windowListeners[type]) globalThis._windowListeners[type] = [];
  globalThis._windowListeners[type].push(fn);
};

let rafCallback = null;
globalThis.requestAnimationFrame = (fn) => {
  rafCallback = fn;
  return 1;
};

let now = performance.now();
let frameCount = 0;
function frame(ms = 16) {
  now += ms;
  frameCount++;
  const cb = rafCallback;
  rafCallback = null;
  if (!cb) throw new Error("No requestAnimationFrame callback queued");
  cb(now);
  if (!rafCallback) throw new Error("Game loop did not schedule the next frame");
}

function stepFrames(count, ms = 16) {
  for (let i = 0; i < count; i++) frame(ms);
}

function assert(condition, message) {
  if (!condition) throw new Error("ASSERT: " + message);
}

/* --------------------------------------------------------------------------
   Load the real scripts.
   -------------------------------------------------------------------------- */

const scripts = ["utils.js", "audio.js", "renderer.js", "world.js", "world-draw.js", "game.js"];
for (const script of scripts) {
  const file = path.join(root, "js", script);
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
}
assert(globalThis.__CR_READY__ === true, "game booted");
assert(globalThis.CRGame, "debug API present");
assert(globalThis.CRGame.state === "menu", "boots into menu");

// Let the menu scene breathe.
stepFrames(20);
assert(globalThis.CRGame.state === "menu", "still in menu after frames");
assert(document.getElementById("skinRail").children.length === 4, "four character cards");

// Start a run.
globalThis.CRGame.start();
assert(globalThis.CRGame.state === "playing", "run starts");
stepFrames(5);

// Pause / resume.
globalThis.CRGame.pause();
assert(globalThis.CRGame.state === "paused", "pauses");
stepFrames(3);
globalThis.CRGame.resume();
assert(globalThis.CRGame.state === "playing", "resumes");

// Play a number of hops. We may die; that is fine and must be handled cleanly.
let deathSeen = false;
for (let i = 0; i < 30; i++) {
  if (globalThis.CRGame.state !== "playing") {
    deathSeen = true;
    break;
  }
  globalThis.CRGame.move(0, 1);
  stepFrames(12);
}
stepFrames(80);
const stateAfterRun = globalThis.CRGame.state;
assert(stateAfterRun === "gameover" || stateAfterRun === "playing" || stateAfterRun === "dying",
  "run ends or continues in a valid state, got " + stateAfterRun);

// Force the result screen if still alive (not strictly needed).
if (globalThis.CRGame.state === "playing") {
  globalThis.CRGame.world._die("car");
  stepFrames(80);
}
assert(globalThis.CRGame.state === "gameover", "game over screen reached");

// Retry button works.
globalThis.CRGame.start();
assert(globalThis.CRGame.state === "playing", "retry starts a new run");

// Back to menu.
globalThis.CRGame.menu();
assert(globalThis.CRGame.state === "menu", "returns to menu");

// Shop: give coins, unlock two characters, check wallet and selection.
globalThis.CR.save.data.coins = 500;
globalThis.CR.save.write();
globalThis.CRGame.menu();
const rail = document.getElementById("skinRail");
const cards = rail.children;
assert(cards.length === 4, "cards rendered after menu refresh");

function cardFor(skin) {
  return cards.find((c) => c.dataset.skin === skin);
}

const penguinCard = cardFor("penguin");
assert(penguinCard, "penguin card present");
const coinsBefore = globalThis.CR.save.data.coins;
penguinCard.trigger("click");
assert(globalThis.CR.save.data.unlocked.includes("penguin"), "penguin unlocked");
assert(globalThis.CR.save.data.skin === "penguin", "penguin selected");
assert(globalThis.CR.save.data.coins === coinsBefore - 80, "penguin cost deducted");

// Cards were rerendered, so find the new unicorn card.
const unicornCard = document.getElementById("skinRail").children.find((c) => c.dataset.skin === "unicorn");
assert(unicornCard, "unicorn card present after rerender");
unicornCard.trigger("click");
assert(globalThis.CR.save.data.unlocked.includes("unicorn"), "unicorn unlocked");
assert(globalThis.CR.save.data.skin === "unicorn", "unicorn selected");

// Check water, train and grass generation over a long world.
const testWorld = new globalThis.CR.World(123456, { menu: false });
testWorld.ensureRowsAround(320);
let types = { grass: 0, road: 0, water: 0, rail: 0 };
for (const row of testWorld.rows.values()) {
  types[row.type] = (types[row.type] || 0) + 1;
  if (row.type === "water") assert(row.logs.length > 0, "water row has logs");
  if (row.type === "road") assert(row.cars.length > 0, "road row has cars");
  if (row.type === "rail") assert(row.train && row.signs.length > 0, "rail row has train and signs");
}
assert(types.road > 0 && types.water > 0 && types.rail > 0, "all hazard types generated");

// Player physics: jump forward, verify landing and score.
const physicsWorld = new globalThis.CR.World(999, { menu: false });
physicsWorld.tryMove(0, 1);
for (let i = 0; i < 20; i++) physicsWorld._updatePlayer(0.016, i * 0.016);
assert(physicsWorld.player.z === 1, "player lands one row forward");
assert(physicsWorld.maxZ === 1, "score increments on forward landing");

// Log riding, support loss and collisions.
const hazardWorld = new globalThis.CR.World(424242, { menu: false });
hazardWorld.ensureRowsAround(220);
let waterRow = null;
let roadRow = null;
let railRow = null;
for (const row of hazardWorld.rows.values()) {
  if (!waterRow && row.type === "water" && row.logs.length) waterRow = row;
  if (!roadRow && row.type === "road" && row.cars.length) roadRow = row;
  if (!railRow && row.type === "rail") railRow = row;
}
assert(waterRow && roadRow && railRow, "hazard rows found for mechanics test");

const log = waterRow.logs[0];
hazardWorld.player.z = waterRow.z;
hazardWorld.player.x = log.x;
hazardWorld.player.ridingLog = log;
hazardWorld.player.surfaceY = globalThis.CR.World.LOG_TOP;
const logX = hazardWorld.player.x;
hazardWorld._updateTraffic(0.1);
assert(!hazardWorld.player.dead, "player can ride a log");
assert(Math.abs(hazardWorld.player.x - logX) > 0.001, "log carries the player");

hazardWorld.player.x = log.x + log.len / 2 + 2;
hazardWorld._updateTraffic(0.016);
assert(hazardWorld.player.dead, "player drowns when stepping off a log");
assert(hazardWorld.deathCause === "water", "drowning sets water cause");

const carWorld = new globalThis.CR.World(5150, { menu: false });
carWorld.ensureRowsAround(160);
let testRoad = null;
for (const row of carWorld.rows.values()) if (!testRoad && row.type === "road" && row.cars.length) testRoad = row;
assert(testRoad, "road row for car collision test");
carWorld.player.z = testRoad.z;
carWorld.player.x = testRoad.cars[0].x;
carWorld.player.dead = false;
carWorld._checkCollisions();
assert(carWorld.player.dead && carWorld.deathCause === "car", "car collision kills the player");

const trainWorld = new globalThis.CR.World(8080, { menu: false });
trainWorld.ensureRowsAround(200);
let testRail = null;
for (const row of trainWorld.rows.values()) if (!testRail && row.type === "rail") testRail = row;
assert(testRail, "rail row for train collision test");
trainWorld.player.z = testRail.z;
trainWorld.player.x = 0;
trainWorld.player.dead = false;
testRail.train.active = true;
testRail.train.x = 0;
testRail.train.dir = 1;
trainWorld._checkCollisions();
assert(trainWorld.player.dead && trainWorld.deathCause === "train", "train collision kills the player");

// Resize path.
globalThis.innerWidth = 390;
globalThis.innerHeight = 844;
globalThis.devicePixelRatio = 2;
globalThis.CRGame.renderer.resize();
assert(globalThis.CRGame.renderer.w === 390, "renderer resized to mobile width");
stepFrames(3);

console.log(JSON.stringify({
  ok: true,
  frames: frameCount,
  state: globalThis.CRGame.state,
  deathSeen,
  types,
  save: globalThis.CR.save.data,
  renderer: { w: globalThis.CRGame.renderer.w, h: globalThis.CRGame.renderer.h, f: globalThis.CRGame.renderer.f },
  generated: { rows: testWorld.rows.size, stats: testWorld.getStats() }
}, null, 2));

if (errors.length) {
  process.exitCode = 1;
}
process.exit(errors.length ? 1 : 0);
