/* ==========================================================================
   World generation, traffic, player physics and game events.
   Logic only — drawing lives in world-draw.js.
   ========================================================================== */
(function (CR) {
  "use strict";

  var HALF_SPAN = 22;
  var FULL_SPAN = HALF_SPAN * 2;
  var GEN_AHEAD = 32;
  var DRAW_AHEAD = 22;
  var DRAW_BEHIND = 10;
  var GROUND = 0.06;
  var LOG_TOP = 0.38;

  var VEHICLE_WEIGHTS = [
    { key: "car", weight: 6 },
    { key: "taxi", weight: 2.2 },
    { key: "van", weight: 2.4 },
    { key: "bus", weight: 1.2 },
    { key: "truck", weight: 1.7 }
  ];

  function weightedPick(rng, entries) {
    var total = 0;
    for (var i = 0; i < entries.length; i++) total += entries[i].weight;
    var roll = rng() * total;
    for (var j = 0; j < entries.length; j++) {
      roll -= entries[j].weight;
      if (roll <= 0) return entries[j];
    }
    return entries[entries.length - 1];
  }

  function World(seed, options) {
    this.seed = seed >>> 0 || 1;
    this.rng = CR.mulberry32(this.seed);
    this.rows = new Map();
    this.particles = [];
    this.events = [];
    this.time = 0;
    this.shake = 0;
    this.frontier = 2;
    this.back = -6;
    this.mode = options && options.menu ? "menu" : "run";
    this.maxZ = 0;
    this.runCoins = 0;
    this.player = this._createPlayer();
    this.deathTime = 0;
    this.deathCause = null;
    this.deathBubbleTimer = 0;
    this.deathSpin = 0;
    this.surfacePulse = 0;

    for (var z = -6; z <= 4; z++) {
      var row = this._makeGrassRow(z, {
        allowProps: z >= 2,
        allowCoin: false,
        startArea: z >= -1
      });
      this.rows.set(z, row);
    }
    this.frontier = 4;

    this._generateAhead(35);

    var starterRow = this.rows.get(3);
    if (starterRow && !starterRow.coin) {
      starterRow.coin = { x: 1.3, z: 3, collected: false, phase: this.rng() * CR.TAU, value: 1 };
    }
  }

  World.prototype._createPlayer = function () {
    return {
      x: 0,
      z: 0,
      fromX: 0,
      fromZ: 0,
      toX: 0,
      toZ: 0,
      hopT: 1,
      hopDuration: 0.145,
      hopping: false,
      queued: null,
      y: 0,
      surfaceY: GROUND,
      faceYaw: this.mode === "menu" ? Math.PI : 0.18,
      targetYaw: this.mode === "menu" ? Math.PI : 0.18,
      dead: false,
      deathCause: null,
      ridingLog: null,
      runCoins: 0,
      squash: 1,
      bumpT: 0,
      idlePhase: this.rng() * CR.TAU,
      blink: 0
    };
  };

  /* ------------------------------------------------------------------------
     Generation
     ------------------------------------------------------------------------ */

  World.prototype._generateAhead = function (target) {
    var guard = 0;
    while (this.frontier < target && guard++ < 500) {
      var z = this.frontier + 1;
      var type = this._chooseSegment(z);
      if (type === "road") {
        this._addRoadSegment(z);
      } else if (type === "river") {
        this._addRiverSegment(z);
      } else if (type === "rail") {
        this._addRailSegment(z);
      } else {
        this._addSafeSegment(z);
      }
    }
  };

  World.prototype._chooseSegment = function (z) {
    var r = this.rng();
    var d = CR.clamp(z / 95, 0, 1);
    if (z < 6) return "road";
    if (z < 12) {
      if (r < 0.58) return "road";
      if (r < 0.79) return "river";
      if (r < 0.9) return "rail";
      return "safe";
    }
    if (z < 20) {
      if (r < 0.5) return "road";
      if (r < 0.71) return "river";
      if (r < 0.84) return "rail";
      return "safe";
    }
    if (r < 0.43 + d * 0.04) return "road";
    if (r < 0.65 + d * 0.04) return "river";
    if (r < 0.79) return "rail";
    return "safe";
  };

  World.prototype._addSafeSegment = function (z) {
    var width = 1 + (this.rng() < 0.58 ? 1 : 0);
    for (var i = 0; i < width; i++) {
      var row = this._makeGrassRow(z + i, {
        allowProps: true,
        allowCoin: true,
        startArea: false
      });
      this.rows.set(z + i, row);
    }
    this.frontier = z + width - 1;
  };

  World.prototype._addRoadSegment = function (z) {
    var d = CR.clamp(z / 95, 0, 1);
    var width = CR.clamp(1 + Math.floor(this.rng() * (1.45 + d * 2.2)), 1, 4);
    var baseDir = this.rng() < 0.5 ? 1 : -1;
    for (var i = 0; i < width; i++) {
      var dir = i % 2 === 0 ? baseDir : -baseDir;
      var speed = CR.rr(this.rng, 1.9, 3.2) * (1 + d * 0.62);
      this.rows.set(z + i, this._makeRoadRow(z + i, dir, speed, d));
    }
    this.frontier = z + width - 1;
    this._addSpacer(z + width);
  };

  World.prototype._addRiverSegment = function (z) {
    var d = CR.clamp(z / 95, 0, 1);
    var width = CR.clamp(1 + Math.floor(this.rng() * (1.05 + d * 1.45)), 1, 3);
    var baseDir = this.rng() < 0.5 ? 1 : -1;
    for (var i = 0; i < width; i++) {
      var dir = i % 2 === 0 ? baseDir : -baseDir;
      var speed = CR.rr(this.rng, 0.85, 1.75) * (1 + d * 0.36);
      this.rows.set(z + i, this._makeWaterRow(z + i, dir, speed, d));
    }
    this.frontier = z + width - 1;
    this._addSpacer(z + width);
  };

  World.prototype._addRailSegment = function (z) {
    var d = CR.clamp(z / 95, 0, 1);
    this.rows.set(z, this._makeRailRow(z, d));
    this.frontier = z;
    this._addSpacer(z + 1);
  };

  World.prototype._addSpacer = function (z) {
    var width = this.rng() < 0.34 ? 2 : 1;
    for (var i = 0; i < width; i++) {
      this.rows.set(z + i, this._makeGrassRow(z + i, {
        allowProps: true,
        allowCoin: true,
        startArea: false
      }));
    }
    this.frontier = z + width - 1;
  };

  World.prototype._makeGrassRow = function (z, options) {
    var opts = options || {};
    var row = {
      z: z,
      type: "grass",
      variant: Math.floor(this.rng() * 4),
      props: [],
      decor: [],
      coin: null
    };

    this._addDecor(row);
    if (opts.allowProps) this._addProps(row);
    if (opts.allowCoin) this._addCoin(row, 0.4, -3.8, 3.8);
    return row;
  };

  World.prototype._addDecor = function (row) {
    var count = 3 + Math.floor(this.rng() * 4);
    for (var i = 0; i < count; i++) {
      var x = CR.rr(this.rng, -18, 18);
      var roll = this.rng();
      var kind = roll < 0.3 ? "flower" : roll < 0.86 ? "tuft" : "pebble";
      row.decor.push({
        x: x,
        dz: CR.rr(this.rng, -0.38, 0.38),
        kind: kind,
        scale: CR.rr(this.rng, 0.7, 1.35),
        color: CR.pick(this.rng, CR.PALETTE.flower)
      });
    }
  };

  World.prototype._addProps = function (row) {
    var roll = this.rng();
    var count = roll < 0.32 ? 0 : roll < 0.82 ? 1 : 2;
    var kinds = [
      { key: "tree", weight: 3.4 },
      { key: "rock", weight: 1.7 },
      { key: "bush", weight: 2.2 },
      { key: "stump", weight: 1.1 }
    ];

    for (var i = 0; i < count; i++) {
      for (var attempt = 0; attempt < 8; attempt++) {
        var x = Math.round(CR.rr(this.rng, -9.5, 9.5) * 2) / 2;
        if (row.z < 5 && Math.abs(x) < 1.7) continue;
        var tooClose = false;
        for (var p = 0; p < row.props.length; p++) {
          if (Math.abs(row.props[p].x - x) < 1.75) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        var kind = weightedPick(this.rng, kinds).key;
        var prop = {
          x: x,
          z: row.z,
          kind: kind,
          variant: Math.floor(this.rng() * 4),
          collider: true,
          radius: kind === "tree" ? 0.5 : kind === "rock" ? 0.45 : kind === "bush" ? 0.4 : 0.35,
          scale: CR.rr(this.rng, 0.88, 1.14)
        };
        row.props.push(prop);
        break;
      }
    }
  };

  World.prototype._addCoin = function (row, chance, minX, maxX) {
    if (row.coin) return;
    if (this.rng() > chance) return;

    for (var attempt = 0; attempt < 5; attempt++) {
      var x = Math.round(CR.rr(this.rng, minX, maxX) * 2) / 2;
      var blocked = false;
      var props = row.props || [];
      for (var i = 0; i < props.length; i++) {
        if (props[i].collider && Math.abs(props[i].x - x) < 1.05) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      row.coin = {
        x: x,
        z: row.z,
        collected: false,
        phase: this.rng() * CR.TAU,
        value: this.rng() < 0.07 ? 3 : 1
      };
      return;
    }
  };

  World.prototype._makeRoadRow = function (z, dir, speed, difficulty) {
    var row = {
      z: z,
      type: "road",
      dir: dir,
      speed: speed,
      cars: [],
      coin: null
    };

    var gap = CR.rr(this.rng, 4.8, 8.2) - difficulty * 1.7;
    var cursor = -HALF_SPAN + CR.rr(this.rng, -0.8, 2.3);
    var guard = 0;
    while (cursor < HALF_SPAN && guard++ < 20) {
      var typeInfo = weightedPick(this.rng, VEHICLE_WEIGHTS).key;
      var dims = CR.VEHICLE_TYPES[typeInfo];
      var len = dims.length;
      if (cursor + len > HALF_SPAN + 3) break;
      var color = typeInfo === "taxi" ? "#ffd23f" : CR.pick(this.rng, CR.PALETTE.vehicles);
      row.cars.push({
        x: cursor + len / 2,
        len: len,
        width: dims.width,
        type: typeInfo,
        color: color,
        dir: dir,
        speed: speed,
        phase: this.rng() * CR.TAU,
        cargo: CR.pick(this.rng, ["#f1e2c3", "#d9c29b", "#e9edf0", color])
      });
      cursor += len + Math.max(2.9, gap + CR.rr(this.rng, -0.7, 0.9));
    }

    if (row.cars.length === 0) {
      row.cars.push({
        x: 0,
        len: 1.55,
        width: 0.82,
        type: "car",
        color: CR.pick(this.rng, CR.PALETTE.vehicles),
        dir: dir,
        speed: speed,
        phase: this.rng() * CR.TAU,
        cargo: "#f1e2c3"
      });
    }

    this._addCoin(row, 0.28, -3.9, 3.9);
    return row;
  };

  World.prototype._makeWaterRow = function (z, dir, speed, difficulty) {
    var row = {
      z: z,
      type: "water",
      dir: dir,
      speed: speed,
      logs: [],
      coin: null
    };

    var gap = CR.rr(this.rng, 1.9, 3.2) + difficulty * 0.35;
    var cursor = -HALF_SPAN + CR.rr(this.rng, -0.7, 1.2);
    var guard = 0;
    while (cursor < HALF_SPAN && guard++ < 30) {
      var len = CR.rr(this.rng, 2.2, 3.55);
      if (cursor + len > HALF_SPAN + 3) break;
      row.logs.push({
        x: cursor + len / 2,
        len: len,
        speed: speed,
        dir: dir,
        phase: this.rng() * CR.TAU,
        variant: Math.floor(this.rng() * 3)
      });
      cursor += len + gap + CR.rr(this.rng, -0.28, 0.45);
    }
    return row;
  };

  World.prototype._makeRailRow = function (z, difficulty) {
    var dir = this.rng() < 0.5 ? 1 : -1;
    var signs = [];
    for (var x = -16; x <= 16; x += 8) {
      if (x !== 0) signs.push({ x: x, z: z + 0.62 });
    }
    return {
      z: z,
      type: "rail",
      dir: dir,
      speed: 0,
      signs: signs,
      coin: null,
      train: {
        active: false,
        warned: false,
        timer: CR.rr(this.rng, 2.2, 5.8),
        x: 0,
        dir: dir,
        speed: 25 + difficulty * 12,
        length: 9.4,
        phase: this.rng() * CR.TAU
      }
    };
  };

  World.prototype._addBackRow = function () {
    var z = this.back - 1;
    this.rows.set(z, this._makeGrassRow(z, {
      allowProps: true,
      allowCoin: false,
      startArea: false
    }));
    this.back = z;
  };

  World.prototype.ensureRowsAround = function (z) {
    this._generateAhead(z + GEN_AHEAD);

    while (this.back > z - 16) {
      this._addBackRow();
    }

    var cutoff = Math.floor(z) - 19;
    if (cutoff > this.back + 1) {
      for (var i = this.back; i < cutoff; i++) {
        this.rows.delete(i);
      }
      this.back = cutoff;
    }
  };

  /* ------------------------------------------------------------------------
     Update
     ------------------------------------------------------------------------ */

  World.prototype.update = function (dt, time) {
    dt = CR.clamp(dt || 0, 0, 0.05);
    this.time = time;
    this.ensureRowsAround(this.player.z);
    this._updateTraffic(dt);
    this._updatePlayer(dt, time);
    this._updateParticles(dt);
    this.shake = CR.damp(this.shake, 0, 5.5, dt);
    this.surfacePulse = Math.max(0, this.surfacePulse - dt * 2.2);

    if (this.mode !== "menu" && !this.player.dead) {
      this._checkCollisions();
    }
  };

  World.prototype.updateEffects = function (dt) {
    dt = CR.clamp(dt || 0, 0, 0.05);
    this._updateParticles(dt);
    this.shake = CR.damp(this.shake, 0, 5, dt);
    if (this.player.dead) this._updateDeath(dt);
  };

  World.prototype._updateTraffic = function (dt) {
    var p = this.player;
    var ref = p.x;
    var self = this;
    var nearMin = p.z - 7;
    var nearMax = p.z + 36;

    this.rows.forEach(function (row) {
      if (row.z < nearMin || row.z > nearMax) return;

      if (row.type === "road") {
        for (var i = 0; i < row.cars.length; i++) {
          var car = row.cars[i];
          car.x += car.dir * car.speed * dt;
          if (car.x - car.len * 0.5 > ref + HALF_SPAN) car.x -= FULL_SPAN;
          if (car.x + car.len * 0.5 < ref - HALF_SPAN) car.x += FULL_SPAN;
        }
      } else if (row.type === "water") {
        for (var j = 0; j < row.logs.length; j++) {
          var log = row.logs[j];
          log.x += log.dir * log.speed * dt;
          if (log.x - log.len * 0.5 > ref + HALF_SPAN) log.x -= FULL_SPAN;
          if (log.x + log.len * 0.5 < ref - HALF_SPAN) log.x += FULL_SPAN;
          if (p.ridingLog === log && !p.hopping) {
            p.x += log.dir * log.speed * dt;
          }
        }
      } else if (row.type === "rail") {
        self._updateTrain(row, dt);
      }
    });

    if (p.ridingLog && !p.dead && !p.hopping) {
      var ridingRow = this.rows.get(Math.round(p.z));
      if (!ridingRow || ridingRow.type !== "water") {
        p.ridingLog = null;
        p.surfaceY = GROUND;
      } else if (this._findLog(ridingRow, p.x) !== p.ridingLog) {
        p.ridingLog = null;
        this._die("water");
      } else {
        p.surfaceY = LOG_TOP;
      }
    }
  };

  World.prototype._updateTrain = function (row, dt) {
    var train = row.train;
    var p = this.player;

    if (!train.active) {
      train.timer -= dt;
      if (!train.warned && train.timer < 2.3) {
        train.warned = true;
        var dist = Math.abs(p.z - row.z);
        if (dist < 9) {
          this.events.push({ type: "horn", volume: CR.clamp(0.075 - dist * 0.007, 0.016, 0.075) });
        }
      }
      if (train.timer <= 0) {
        train.active = true;
        train.x = p.x - train.dir * 44;
      }
    } else {
      train.x += train.dir * train.speed * dt;
      if (train.dir > 0 && train.x > p.x + 43) {
        train.active = false;
        train.warned = false;
        train.timer = CR.rr(this.rng, 6.5, 11);
      } else if (train.dir < 0 && train.x < p.x - 43) {
        train.active = false;
        train.warned = false;
        train.timer = CR.rr(this.rng, 6.5, 11);
      }
    }
  };

  World.prototype._updatePlayer = function (dt, time) {
    var p = this.player;

    if (this.mode === "menu") {
      p.faceYaw = CR.dampAngle(p.faceYaw, Math.PI + Math.sin(time * 0.55) * 0.18, 3, dt);
      p.targetYaw = p.faceYaw;
      p.y = 0;
      p.squash = CR.damp(p.squash, 1, 10, dt);
      p.bumpT = Math.max(0, p.bumpT - dt);
      return;
    }

    if (p.dead) {
      this._updateDeath(dt);
      return;
    }

    p.bumpT = Math.max(0, p.bumpT - dt);
    p.faceYaw = CR.dampAngle(p.faceYaw, p.targetYaw, 14, dt);
    p.squash = CR.damp(p.squash, 1, 11, dt);

    if (p.hopping) {
      p.hopT += dt / p.hopDuration;
      var t = CR.clamp(p.hopT, 0, 1);
      var eased = t * t * (3 - 2 * t);
      p.x = CR.lerp(p.fromX, p.toX, eased);
      p.z = CR.lerp(p.fromZ, p.toZ, eased);
      p.y = Math.sin(t * Math.PI) * 0.56;
      if (t >= 1) this._land();
    } else {
      p.y = 0;
      if (p.ridingLog) p.surfaceY = LOG_TOP;
    }

    this._checkCoins();
  };

  World.prototype._updateDeath = function (dt) {
    var p = this.player;
    this.deathTime += dt;
    this.deathSpin += dt * 5;

    if (this.deathCause === "water") {
      p.y = -this.deathTime * 0.72;
      p.surfaceY = -0.02;
      this.deathBubbleTimer -= dt;
      if (this.deathBubbleTimer <= 0 && this.deathTime < 0.9) {
        this.deathBubbleTimer = 0.085;
        this._bubble(p.x + CR.rr(this.rng, -0.25, 0.25), p.z + CR.rr(this.rng, -0.25, 0.25), CR.rr(this.rng, 0.08, 0.2));
      }
    } else {
      p.y = Math.max(0, p.y - dt * 1.4);
      p.squash = CR.clamp(1 - this.deathTime * 3.4, 0.16, 1);
      p.faceYaw += dt * 9;
    }
  };

  World.prototype.tryMove = function (dx, dz) {
    var p = this.player;
    if (p.dead || this.mode === "menu") return false;
    if (!dx && !dz) return false;

    if (p.hopping) {
      if (p.hopT > 0.58 && !p.queued) {
        p.queued = { dx: dx, dz: dz };
      }
      return false;
    }

    var targetX = p.x + dx;
    var targetZ = p.z + dz;
    var targetRow = this.rows.get(targetZ);
    if (!targetRow) {
      this.ensureRowsAround(targetZ);
      targetRow = this.rows.get(targetZ);
    }

    if (targetRow && targetRow.type === "grass") {
      for (var i = 0; i < targetRow.props.length; i++) {
        var prop = targetRow.props[i];
        if (prop.collider && Math.abs(prop.x - targetX) < prop.radius + 0.28) {
          p.bumpT = 0.22;
          this.shake = Math.max(this.shake, 0.16);
          this.events.push({ type: "bump" });
          return false;
        }
      }
    }

    p.fromX = p.x;
    p.fromZ = p.z;
    p.toX = targetX;
    p.toZ = targetZ;
    p.hopT = 0;
    p.hopping = true;
    p.ridingLog = null;
    // A tiny cheat toward the three-quarter camera: it keeps one eye and the
    // beak readable while the chicken still travels exactly one tile at a time.
    p.targetYaw = Math.atan2(dx, dz) + 0.18;
    p.squash = 0.82;
    p.queued = null;
    this.events.push({ type: "hop" });
    return true;
  };

  World.prototype._land = function () {
    var p = this.player;
    p.hopping = false;
    p.hopT = 1;
    p.x = p.toX;
    p.z = p.toZ;
    p.y = 0;
    p.squash = 0.84;

    var row = this.rows.get(Math.round(p.z));
    if (!row) {
      row = this._makeGrassRow(Math.round(p.z), { allowProps: false, allowCoin: false, startArea: false });
      this.rows.set(row.z, row);
    }

    if (row.type === "water") {
      var log = this._findLog(row, p.x);
      if (log) {
        p.ridingLog = log;
        p.surfaceY = LOG_TOP;
        this.surfacePulse = 1;
        this._spawnRipple(p.x, row.z);
      } else {
        this._die("water");
        return;
      }
    } else {
      p.ridingLog = null;
      p.surfaceY = GROUND;
    }

    this._spawnDust(p.x, p.z, p.ridingLog ? "#d8f8ff" : "#d8e8b6", p.ridingLog ? 4 : 6);
    this.events.push({ type: "land" });

    if (p.z > this.maxZ) {
      this.maxZ = p.z;
      this.events.push({ type: "score", score: this.maxZ });
    }

    this._checkCoins();
    this.ensureRowsAround(p.z);

    if (!p.dead) this._checkCollisions();

    if (!p.dead && p.queued) {
      var queued = p.queued;
      p.queued = null;
      this.tryMove(queued.dx, queued.dz);
    }
  };

  World.prototype._findLog = function (row, x) {
    if (!row || !row.logs) return null;
    for (var i = 0; i < row.logs.length; i++) {
      var log = row.logs[i];
      if (Math.abs(x - log.x) < log.len * 0.5 - 0.12) return log;
    }
    return null;
  };

  World.prototype._checkCoins = function () {
    var p = this.player;
    if (p.dead) return;
    var z = Math.round(p.z);
    var row = this.rows.get(z);
    if (!row || !row.coin || row.coin.collected) return;
    if (Math.abs(p.x - row.coin.x) > 0.56) return;
    if (Math.abs(p.z - row.z) > 0.68) return;

    row.coin.collected = true;
    this.runCoins += row.coin.value;
    p.runCoins += row.coin.value;
    this.events.push({ type: "coin", amount: row.coin.value, total: this.runCoins });
    this._spawnCoinBurst(row.coin.x, row.z, row.coin.value);
  };

  World.prototype._checkCollisions = function () {
    var p = this.player;
    if (p.dead) return;

    var z = Math.round(p.z);
    for (var dz = -1; dz <= 1; dz++) {
      var row = this.rows.get(z + dz);
      if (!row) continue;

      if (row.type === "road") {
        for (var i = 0; i < row.cars.length; i++) {
          var car = row.cars[i];
          if (Math.abs(p.z - row.z) > 0.62) continue;
          if (Math.abs(p.x - car.x) < car.len * 0.5 + 0.26) {
            this._die("car");
            return;
          }
        }
      } else if (row.type === "rail" && row.train.active) {
        if (Math.abs(p.z - row.z) > 0.62) continue;
        if (Math.abs(p.x - row.train.x) < row.train.length * 0.5 + 0.28) {
          this._die("train");
          return;
        }
      }
    }
  };

  World.prototype._die = function (cause) {
    var p = this.player;
    if (p.dead) return;

    p.dead = true;
    p.deathCause = cause;
    p.ridingLog = null;
    this.deathCause = cause;
    this.deathTime = 0;
    this.deathSpin = 0;
    this.deathBubbleTimer = 0;
    p.hopping = false;
    p.queued = null;

    this.events.push({ type: "death", cause: cause, score: this.maxZ, coins: this.runCoins });

    if (cause === "water") {
      this.shake = Math.max(this.shake, 0.42);
      this._spawnSplash(p.x, p.z);
    } else {
      this.shake = Math.max(this.shake, cause === "train" ? 1.05 : 0.7);
      this._spawnCrash(p.x, p.z, cause);
    }
  };

  /* ------------------------------------------------------------------------
     Particles
     ------------------------------------------------------------------------ */

  World.prototype._particle = function (options) {
    this.particles.push({
      type: options.type || "dot",
      x: options.x,
      y: options.y,
      z: options.z,
      vx: options.vx || 0,
      vy: options.vy || 0,
      vz: options.vz || 0,
      gravity: options.gravity || 0,
      size: options.size || 0.06,
      color: options.color || "#fff7e2",
      text: options.text || "",
      life: options.life || 0.5,
      maxLife: options.life || 0.5,
      rot: options.rot || 0,
      spin: options.spin || 0,
      seed: options.seed || Math.random() * 10
    });
  };

  World.prototype._updateParticles = function (dt) {
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= p.gravity * dt;
    }
  };

  World.prototype._spawnDust = function (x, z, color, count) {
    for (var i = 0; i < count; i++) {
      var angle = this.rng() * CR.TAU;
      this._particle({
        x: x + Math.cos(angle) * 0.16,
        y: 0.13,
        z: z + Math.sin(angle) * 0.16,
        vx: Math.cos(angle) * CR.rr(this.rng, 0.35, 1.1),
        vy: CR.rr(this.rng, 0.25, 0.75),
        vz: Math.sin(angle) * CR.rr(this.rng, 0.35, 1.1),
        gravity: 2.5,
        size: CR.rr(this.rng, 0.035, 0.09),
        color: color,
        life: CR.rr(this.rng, 0.25, 0.45)
      });
    }
  };

  World.prototype._spawnRipple = function (x, z) {
    this._particle({
      type: "ring",
      x: x,
      y: 0.015,
      z: z,
      size: 1.15,
      color: "rgba(226,252,255,0.9)",
      life: 0.5
    });
    for (var i = 0; i < 5; i++) {
      var angle = this.rng() * CR.TAU;
      this._particle({
        x: x + Math.cos(angle) * 0.25,
        y: 0.06,
        z: z + Math.sin(angle) * 0.25,
        vx: Math.cos(angle) * 0.35,
        vy: 0.8,
        vz: Math.sin(angle) * 0.35,
        gravity: 4,
        size: 0.04,
        color: "#d8f8ff",
        life: 0.35
      });
    }
  };

  World.prototype._spawnCoinBurst = function (x, z, value) {
    this._particle({
      type: "star",
      x: x,
      y: 0.82,
      z: z,
      size: 0.5,
      color: "#fff3a6",
      life: 0.42
    });
    for (var i = 0; i < 7 + value * 2; i++) {
      var angle = this.rng() * CR.TAU;
      this._particle({
        x: x,
        y: 0.68,
        z: z,
        vx: Math.cos(angle) * CR.rr(this.rng, 0.5, 1.5),
        vy: CR.rr(this.rng, 0.8, 2.2),
        vz: Math.sin(angle) * CR.rr(this.rng, 0.5, 1.5),
        gravity: 3.2,
        size: CR.rr(this.rng, 0.035, 0.085),
        color: i % 3 === 0 ? "#fff7d0" : "#ffd23f",
        life: CR.rr(this.rng, 0.35, 0.62)
      });
    }
    this._particle({
      type: "text",
      x: x,
      y: 0.95,
      z: z,
      text: "+" + value,
      color: "#ffe66d",
      size: 0.2,
      life: 0.75
    });
  };

  World.prototype._spawnSplash = function (x, z) {
    this._particle({
      type: "ring",
      x: x,
      y: 0.02,
      z: z,
      size: 1.9,
      color: "rgba(232,252,255,0.95)",
      life: 0.65
    });
    for (var i = 0; i < 16; i++) {
      var angle = this.rng() * CR.TAU;
      this._particle({
        x: x + Math.cos(angle) * 0.2,
        y: 0.05,
        z: z + Math.sin(angle) * 0.2,
        vx: Math.cos(angle) * CR.rr(this.rng, 0.5, 2.1),
        vy: CR.rr(this.rng, 1.2, 3.1),
        vz: Math.sin(angle) * CR.rr(this.rng, 0.5, 2.1),
        gravity: 7.5,
        size: CR.rr(this.rng, 0.04, 0.12),
        color: i % 3 === 0 ? "#ffffff" : "#8be1f4",
        life: CR.rr(this.rng, 0.45, 0.85)
      });
    }
    for (var b = 0; b < 4; b++) {
      this._bubble(x + CR.rr(this.rng, -0.35, 0.35), z + CR.rr(this.rng, -0.35, 0.35), 0.1);
    }
  };

  World.prototype._bubble = function (x, z, size) {
    this._particle({
      type: "dot",
      x: x,
      y: 0.05,
      z: z,
      vx: CR.rr(this.rng, -0.12, 0.12),
      vy: CR.rr(this.rng, 0.4, 0.85),
      vz: CR.rr(this.rng, -0.12, 0.12),
      gravity: -0.2,
      size: size,
      color: "#d8f8ff",
      life: CR.rr(this.rng, 0.5, 0.9)
    });
  };

  World.prototype._spawnCrash = function (x, z, cause) {
    var skin = CR.SKINS[CR.save.data.skin] || CR.SKINS.chicken;
    var featherColors = [skin.body, skin.bodyShade, skin.comb || skin.accent, "#fff7e2"];
    for (var i = 0; i < 12; i++) {
      var angle = this.rng() * CR.TAU;
      this._particle({
        type: "feather",
        x: x,
        y: 0.5 + this.rng() * 0.45,
        z: z,
        vx: Math.cos(angle) * CR.rr(this.rng, 0.7, 2.4),
        vy: CR.rr(this.rng, 1.4, 3.1),
        vz: Math.sin(angle) * CR.rr(this.rng, 0.7, 2.4),
        gravity: 4.2,
        size: CR.rr(this.rng, 0.06, 0.14),
        color: CR.pick(this.rng, featherColors),
        life: CR.rr(this.rng, 0.65, 1.1),
        rot: this.rng() * CR.TAU,
        spin: CR.rr(this.rng, -7, 7)
      });
    }
    this._spawnDust(x, z, "#d8e8b6", 9);
    this._particle({
      type: "text",
      x: x,
      y: 0.9,
      z: z,
      text: cause === "train" ? "БАМ!" : "БУМ!",
      color: "#ff7b7b",
      size: 0.2,
      life: 0.7
    });
    for (var s = 0; s < 3; s++) {
      this._particle({
        type: "star",
        x: x + CR.rr(this.rng, -0.4, 0.4),
        y: 1.35 + s * 0.18,
        z: z + CR.rr(this.rng, -0.4, 0.4),
        size: 0.45,
        color: "#fff3a6",
        life: 0.45
      });
    }
  };

  World.prototype.getStats = function () {
    var cars = 0;
    var logs = 0;
    var props = 0;
    this.rows.forEach(function (row) {
      cars += row.cars ? row.cars.length : 0;
      logs += row.logs ? row.logs.length : 0;
      props += row.props ? row.props.length : 0;
    });
    return {
      rows: this.rows.size,
      cars: cars,
      logs: logs,
      props: props,
      particles: this.particles.length,
      frontier: this.frontier,
      back: this.back
    };
  };

  World.HALF_SPAN = HALF_SPAN;
  World.DRAW_AHEAD = DRAW_AHEAD;
  World.DRAW_BEHIND = DRAW_BEHIND;
  World.GROUND = GROUND;
  World.LOG_TOP = LOG_TOP;

  CR.World = World;
})(window.CR = window.CR || {});
