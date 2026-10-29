/* ==========================================================================
   World rendering: ground, props, traffic, train, character and pickups.
   ========================================================================== */
(function (CR) {
  "use strict";

  var World = CR.World;
  if (!World) return;

  var C = CR.PALETTE;
  var GROUND = World.GROUND;
  var LOG_TOP = World.LOG_TOP;
  var TAU = CR.TAU;

  /* ------------------------------------------------------------------------
     Main scene pass
     ------------------------------------------------------------------------ */

  World.prototype.render = function (renderer, time) {
    var p = this.player;
    var centerX = p.x + 2.2;
    var zMin = Math.floor(p.z) - World.DRAW_BEHIND;
    var zMax = Math.floor(p.z) + World.DRAW_AHEAD;
    var rows = [];
    var z;
    var row;

    for (z = zMax; z >= zMin; z--) {
      row = this.rows.get(z);
      if (row) rows.push(row);
    }

    var playerRow = Math.round(p.z);
    var playerDrawn = false;
    var hidePlayer = p.dead && this.deathCause === "water" && this.deathTime > 0.62;

    for (var r = 0; r < rows.length; r++) {
      row = rows[r];
      this._drawGround(renderer, row, time, centerX);

      var items = [];
      var addItem = function (kind, obj, x, y, zPos) {
        if (Math.abs(x - centerX) > 29) return;
        var depth = renderer.depth(x, y, zPos);
        if (depth < 0.2) return;
        items.push({ depth: depth, kind: kind, obj: obj, row: row });
      };

      if (row.type === "grass") {
        for (var pr = 0; pr < row.props.length; pr++) {
          var prop = row.props[pr];
          // Tall trees in rows already behind the player sit between the
          // camera and the hero. Cull them so the chicken never disappears
          // behind a foreground canopy.
          if (prop.kind === "tree" && row.z < p.z - 0.05) continue;
          addItem("prop", prop, prop.x, 0.8, prop.z);
        }
      }

      if (row.coin && !row.coin.collected) {
        addItem("coin", row.coin, row.coin.x, 0.78, row.z);
      }

      if (row.type === "road") {
        for (var ci = 0; ci < row.cars.length; ci++) {
          var car = row.cars[ci];
          addItem("car", car, car.x, 0.48, row.z);
        }
      } else if (row.type === "water") {
        for (var li = 0; li < row.logs.length; li++) {
          var log = row.logs[li];
          addItem("log", log, log.x, 0.2, row.z);
        }
      } else if (row.type === "rail") {
        if (row.train.active) {
          addItem("train", row.train, row.train.x, 0.6, row.z);
        }
        for (var si = 0; si < row.signs.length; si++) {
          var sign = row.signs[si];
          addItem("sign", sign, sign.x, 1.25, sign.z);
        }
      }

      if (!playerDrawn && row.z === playerRow && !hidePlayer) {
        addItem("player", p, p.x, p.surfaceY + 0.65, p.z);
        playerDrawn = true;
      }

      items.sort(function (a, b) {
        return b.depth - a.depth;
      });

      for (var it = 0; it < items.length; it++) {
        var item = items[it];
        if (item.kind === "prop") {
          this._drawProp(renderer, item.obj, time);
        } else if (item.kind === "car") {
          this._drawCar(renderer, item.obj, item.row, time);
        } else if (item.kind === "log") {
          this._drawLog(renderer, item.obj, item.row, time);
        } else if (item.kind === "coin") {
          this._drawCoin(renderer, item.obj, item.row, time);
        } else if (item.kind === "train") {
          this._drawTrain(renderer, item.obj, item.row, time);
        } else if (item.kind === "sign") {
          this._drawSign(renderer, item.obj, item.row, time);
        } else if (item.kind === "player") {
          this._drawPlayer(renderer, time);
        }
      }
    }

    if (!playerDrawn && !hidePlayer) {
      this._drawPlayer(renderer, time);
    }

    renderer.drawParticles(this.particles, time);
  };

  /* ------------------------------------------------------------------------
     Ground
     ------------------------------------------------------------------------ */

  World.prototype._drawGround = function (renderer, row, time, centerX) {
    if (row.type === "grass") {
      this._drawGrass(renderer, row, time, centerX);
    } else if (row.type === "road") {
      this._drawRoad(renderer, row, time, centerX);
    } else if (row.type === "water") {
      this._drawWater(renderer, row, time, centerX);
    } else if (row.type === "rail") {
      this._drawRail(renderer, row, time, centerX);
    }
  };

  World.prototype._drawGrass = function (renderer, row, time, centerX) {
    renderer.cube(centerX, GROUND - 0.032, row.z, 58, 0.032, 1.015, C.grass[row.variant]);
    renderer.flatQuad(centerX, GROUND + 0.004, row.z, 58, 1.0, "#ffffff", row.variant % 2 ? 0.038 : 0.06);
    renderer.flatQuad(centerX, GROUND + 0.005, row.z + 0.47, 58, 0.035, "#d7f5ac", 0.18);
    renderer.flatQuad(centerX, GROUND + 0.005, row.z - 0.47, 58, 0.03, "#356f2c", 0.06);

    if (row.variant === 1) {
      renderer.flatQuad(centerX, GROUND + 0.006, row.z - 0.23, 58, 0.33, "#ffffff", 0.05);
    }

    var showDecor = Math.abs(row.z - this.player.z) <= 13;
    for (var i = 0; i < row.decor.length && showDecor; i++) {
      var d = row.decor[i];
      if (Math.abs(d.x - centerX) > 22) continue;
      var z = row.z + d.dz;
      if (d.kind === "flower") {
        renderer.cube(d.x, GROUND, z, 0.024, 0.15 * d.scale, 0.024, "#3f8f3d");
        renderer.cube(d.x, GROUND + 0.14 * d.scale, z, 0.105 * d.scale, 0.09 * d.scale, 0.105 * d.scale, d.color);
        renderer.cube(d.x - 0.019 * d.scale, GROUND + 0.15 * d.scale, z - 0.018, 0.035 * d.scale, 0.035 * d.scale, 0.035 * d.scale, "#ffdf83");
      } else if (d.kind === "pebble") {
        renderer.cube(d.x, GROUND, z, 0.11 * d.scale, 0.045 * d.scale, 0.09 * d.scale, "#9aa49d");
        renderer.cube(d.x + 0.025 * d.scale, GROUND + 0.04 * d.scale, z - 0.01, 0.055 * d.scale, 0.025 * d.scale, 0.05 * d.scale, "#c1c8bf");
      } else {
        renderer.cube(d.x, GROUND, z, 0.055 * d.scale, 0.14 * d.scale, 0.05 * d.scale, "#4a9c3b");
        renderer.cube(d.x + 0.07 * d.scale, GROUND, z - 0.04, 0.04 * d.scale, 0.095 * d.scale, 0.04 * d.scale, "#60b44d");
      }
    }

    this._drawRoadEdges(renderer, row, centerX, false);
  };

  World.prototype._drawRoad = function (renderer, row, time, centerX) {
    var roadColor = Math.abs(row.z) % 2 === 0 ? C.road : C.roadAlt;
    renderer.cube(centerX, GROUND - 0.032, row.z, 58, 0.032, 1.015, roadColor);

    var h1 = CR.hash2(row.z, 17, this.seed);
    if (h1 > 0.53) {
      var px = centerX + (h1 - 0.75) * 34;
      renderer.flatQuad(px, GROUND + 0.004, row.z + (h1 - 0.5) * 0.35, 2.2 + h1 * 2.2, 0.32, "#343b43", 0.4);
    }

    var above = this.rows.get(row.z + 1);
    var below = this.rows.get(row.z - 1);

    if (below && below.type === "road") {
      this._drawDashes(renderer, centerX, GROUND + 0.013, row.z - 0.5, C.roadLine, 0.96);
    } else {
      renderer.cube(centerX, GROUND - 0.02, row.z - 0.5, 58, 0.05, 0.14, C.curb);
      renderer.flatQuad(centerX, GROUND + 0.015, row.z - 0.5, 58, 0.11, C.roadLine, 0.9);
    }

    if (!above || above.type !== "road") {
      renderer.cube(centerX, GROUND - 0.02, row.z + 0.5, 58, 0.05, 0.14, C.curb);
      renderer.flatQuad(centerX, GROUND + 0.015, row.z + 0.5, 58, 0.11, C.roadLine, 0.9);
    }

    this._drawRoadEdges(renderer, row, centerX, false);
  };

  World.prototype._drawDashes = function (renderer, centerX, y, z, color, alpha) {
    var start = Math.floor((centerX - 29) / 2.9) * 2.9;
    for (var x = start; x < centerX + 29; x += 2.9) {
      renderer.flatQuad(x + 0.6, y, z, 1.25, 0.11, color, alpha);
    }
  };

  World.prototype._drawWater = function (renderer, row, time, centerX) {
    renderer.cube(centerX, -0.12, row.z, 58, 0.08, 1.015, C.waterDeep);
    renderer.flatQuad(centerX, -0.038, row.z, 58, 0.96, C.water, 0.86);
    renderer.flatQuad(centerX, -0.034, row.z - 0.42, 58, 0.12, C.waterLight, 0.26);
    renderer.flatQuad(centerX, -0.034, row.z + 0.42, 58, 0.12, C.waterLight, 0.26);

    var below = this.rows.get(row.z - 1);
    var above = this.rows.get(row.z + 1);
    if (!below || below.type !== "water") {
      renderer.cube(centerX, GROUND - 0.12, row.z - 0.5, 58, 0.19, 0.14, "#c8b67d");
      renderer.flatQuad(centerX, GROUND + 0.012, row.z - 0.5, 58, 0.12, "#f1dfab", 0.6);
      renderer.flatQuad(centerX, -0.02, row.z - 0.4, 58, 0.14, "#1d7e9f", 0.26);
    }
    if (!above || above.type !== "water") {
      renderer.cube(centerX, GROUND - 0.12, row.z + 0.5, 58, 0.19, 0.14, "#c8b67d");
      renderer.flatQuad(centerX, GROUND + 0.012, row.z + 0.5, 58, 0.12, "#f1dfab", 0.6);
      renderer.flatQuad(centerX, -0.02, row.z + 0.4, 58, 0.14, "#1d7e9f", 0.26);
    }

    for (var i = 0; i < 5; i++) {
      var phase = time * 0.9 + row.z * 1.31 + i * 1.7;
      var x = centerX + Math.sin(phase) * 20 + (i - 1.5) * 6.2;
      x = CR.wrap(x, centerX - 28, centerX + 28);
      var w = 1.2 + (i % 2) * 1.25;
      var zz = row.z - 0.3 + (i % 4) * 0.17;
      renderer.flatQuad(x, -0.029, zz, w, 0.052, C.foam, 0.3 + (i % 2) * 0.08);
      renderer.flatQuad(x - 0.32, -0.026, zz + 0.055, 0.48, 0.038, "#ffffff", 0.22);
    }

    if (this.surfacePulse > 0) {
      renderer.flatQuad(this.player.x, -0.026, row.z, this.surfacePulse * 3.2, 0.055, "#ffffff", this.surfacePulse * 0.12);
    }
  };

  World.prototype._drawRail = function (renderer, row, time, centerX) {
    renderer.cube(centerX, GROUND - 0.032, row.z, 58, 0.032, 1.015, C.railBed);

    var below = this.rows.get(row.z - 1);
    var above = this.rows.get(row.z + 1);
    if (!below || below.type !== "rail") {
      renderer.flatQuad(centerX, GROUND + 0.006, row.z - 0.46, 58, 0.09, "#736652", 0.4);
    }
    if (!above || above.type !== "rail") {
      renderer.flatQuad(centerX, GROUND + 0.006, row.z + 0.46, 58, 0.09, "#736652", 0.4);
    }

    var start = Math.floor((centerX - 29) / 2.1) * 2.1;
    for (var x = start; x < centerX + 29; x += 2.1) {
      renderer.flatQuad(x, GROUND + 0.011, row.z, 0.24, 0.9, C.sleeper, 0.92);
    }

    renderer.cube(centerX, GROUND + 0.02, row.z - 0.25, 58, 0.085, 0.11, C.railSteel);
    renderer.cube(centerX, GROUND + 0.02, row.z + 0.25, 58, 0.085, 0.11, C.railSteel);
    renderer.cube(centerX, GROUND + 0.102, row.z - 0.25, 58, 0.018, 0.06, C.railSteelLight);
    renderer.cube(centerX, GROUND + 0.102, row.z + 0.25, 58, 0.018, 0.06, C.railSteelLight);

    this._drawRoadEdges(renderer, row, centerX, true);
  };

  World.prototype._drawRoadEdges = function (renderer, row, centerX, gravel) {
    var below = this.rows.get(row.z - 1);
    var above = this.rows.get(row.z + 1);
    if (!below || below.type !== row.type) {
      if (gravel) {
        renderer.cube(centerX, GROUND - 0.03, row.z - 0.5, 58, 0.04, 0.12, "#7f705b");
      }
    }
    if (!above || above.type !== row.type) {
      if (gravel) {
        renderer.cube(centerX, GROUND - 0.03, row.z + 0.5, 58, 0.04, 0.12, "#7f705b");
      }
    }
  };

  /* ------------------------------------------------------------------------
     Props
     ------------------------------------------------------------------------ */

  World.prototype._drawProp = function (renderer, prop, time) {
    var s = prop.scale || 1;
    var leaves = C.leaves;
    var leafLight = C.leavesLight[prop.variant % C.leavesLight.length];
    var showShadow = Math.abs(prop.z - this.player.z) < 14;

    if (prop.kind === "tree") {
      if (showShadow) renderer.shadow(prop.x, prop.z, 0.7 * s, 0.58 * s, 0.2);

      if (prop.variant === 1) {
        renderer.cube(prop.x, GROUND, prop.z, 0.26 * s, 0.95 * s, 0.26 * s, C.trunk);
        renderer.cube(prop.x, GROUND + 0.72 * s, prop.z, 1.32 * s, 0.46 * s, 1.18 * s, leaves[0]);
        renderer.cube(prop.x, GROUND + 1.05 * s, prop.z, 1.05 * s, 0.42 * s, 0.94 * s, leaves[2]);
        renderer.cube(prop.x, GROUND + 1.37 * s, prop.z, 0.74 * s, 0.4 * s, 0.68 * s, leafLight);
        renderer.cube(prop.x, GROUND + 1.67 * s, prop.z, 0.42 * s, 0.33 * s, 0.4 * s, leaves[1]);
      } else {
        renderer.cube(prop.x, GROUND, prop.z, 0.3 * s, 0.92 * s, 0.3 * s, C.trunk);
        renderer.cube(prop.x, GROUND + 0.66 * s, prop.z, 1.08 * s, 0.56 * s, 1.02 * s, leaves[prop.variant % leaves.length]);
        renderer.cube(prop.x + 0.06 * s, GROUND + 1.09 * s, prop.z - 0.08 * s, 0.82 * s, 0.48 * s, 0.8 * s, leaves[(prop.variant + 1) % leaves.length]);
        renderer.cube(prop.x - 0.1 * s, GROUND + 1.45 * s, prop.z + 0.07 * s, 0.5 * s, 0.38 * s, 0.5 * s, leafLight);

        if (prop.variant === 2) {
          renderer.cube(prop.x - 0.3 * s, GROUND + 1.05 * s, prop.z + 0.42 * s, 0.1, 0.1, 0.1, "#ff6b5d");
          renderer.cube(prop.x + 0.36 * s, GROUND + 1.22 * s, prop.z + 0.17 * s, 0.09, 0.09, 0.09, "#ffb02e");
          renderer.cube(prop.x + 0.05 * s, GROUND + 1.53 * s, prop.z + 0.36 * s, 0.1, 0.1, 0.1, "#ff6b5d");
        }
      }
    } else if (prop.kind === "rock") {
      if (showShadow) renderer.shadow(prop.x, prop.z, 0.55 * s, 0.48 * s, 0.18);
      renderer.cube(prop.x, GROUND, prop.z, 0.82 * s, 0.46 * s, 0.7 * s, C.rock);
      renderer.cube(prop.x + 0.28 * s, GROUND, prop.z - 0.1 * s, 0.42 * s, 0.28 * s, 0.46 * s, C.rockDark);
      renderer.cube(prop.x - 0.08 * s, GROUND + 0.44 * s, prop.z - 0.02 * s, 0.55 * s, 0.08 * s, 0.45 * s, C.rockLight);
      renderer.cube(prop.x - 0.2 * s, GROUND + 0.5 * s, prop.z + 0.1 * s, 0.24 * s, 0.05 * s, 0.2 * s, "#79b25b");
    } else if (prop.kind === "bush") {
      if (showShadow) renderer.shadow(prop.x, prop.z, 0.52 * s, 0.44 * s, 0.16);
      renderer.cube(prop.x, GROUND, prop.z, 0.74 * s, 0.37 * s, 0.62 * s, leaves[3]);
      renderer.cube(prop.x + 0.22 * s, GROUND, prop.z - 0.08 * s, 0.45 * s, 0.3 * s, 0.48 * s, leafLight);
      renderer.cube(prop.x - 0.2 * s, GROUND + 0.23 * s, prop.z + 0.08 * s, 0.2, 0.16, 0.18, "#58b847");
      if (prop.variant % 2 === 0) {
        renderer.cube(prop.x + 0.18 * s, GROUND + 0.42 * s, prop.z + 0.15 * s, 0.07, 0.07, 0.07, "#ff5c75");
        renderer.cube(prop.x - 0.25 * s, GROUND + 0.32 * s, prop.z - 0.14 * s, 0.06, 0.06, 0.06, "#ffd23f");
      }
    } else if (prop.kind === "stump") {
      if (showShadow) renderer.shadow(prop.x, prop.z, 0.42 * s, 0.36 * s, 0.16);
      renderer.cube(prop.x, GROUND, prop.z, 0.5 * s, 0.38 * s, 0.5 * s, C.trunk);
      renderer.cube(prop.x, GROUND + 0.36 * s, prop.z, 0.44 * s, 0.06 * s, 0.44 * s, "#c3935a");
      renderer.cube(prop.x - 0.1 * s, GROUND + 0.42 * s, prop.z - 0.05 * s, 0.13 * s, 0.025 * s, 0.13 * s, "#e0b779");
    }
  };

  /* ------------------------------------------------------------------------
     Vehicles
     ------------------------------------------------------------------------ */

  World.prototype._drawCar = function (renderer, car, row, time) {
    var z = row.z;
    var base = GROUND;
    var s = car.dir;
    var len = car.len;
    var width = car.width;
    var color = car.color;
    var dark = CR.shade(color, -0.22);
    var roof = CR.shade(color, 0.16);
    var glass = "#233845";
    var glassLight = "#3d6172";
    var wheel = "#222b30";
    var front = car.x + s * (len * 0.5 - 0.06);
    var rear = car.x - s * (len * 0.5 - 0.06);
    var nearZ = z - width * 0.36;
    var nearFace = z - width * 0.48;
    var i;

    // Far traffic only needs a readable silhouette; this is where most of the
    // render budget is saved without emptying the horizon.
    if (row.z > this.player.z + 16) {
      var tall = car.type === "bus" ? 0.68 : car.type === "van" || car.type === "truck" ? 0.42 : 0.26;
      renderer.cube(car.x, base + 0.13, z, len * 0.92, tall, width * 0.88, color);
      renderer.cube(car.x - s * len * 0.04, base + 0.13 + tall, z, len * 0.52, 0.22, width * 0.72, roof);
      renderer.cube(car.x - s * len * 0.04, base + 0.24 + tall, nearFace, len * 0.42, 0.08, 0.025, glass);
      renderer.cube(car.x, base + 0.03, z, len * 0.86, 0.1, width * 0.8, "#2b343a");
      return;
    }

    if (Math.abs(row.z - this.player.z) < 11) {
      renderer.shadow(car.x, z, len * 0.58, width * 0.48, 0.19);
    }

    // Dark sill and the two camera-facing wheels keep the silhouette grounded
    // while cutting the old eight-cube wheel assembly.
    renderer.cube(car.x, base + 0.045, z, len * 0.86, 0.11, width * 0.82, "#2b343a");
    var axles = car.type === "truck" || car.type === "bus"
      ? [-len * 0.32, len * 0.03, len * 0.32]
      : [-len * 0.31, len * 0.31];
    for (i = 0; i < axles.length; i++) {
      renderer.cube(car.x + axles[i], base + 0.005, nearZ, 0.23, 0.23, 0.18, wheel);
    }

    if (car.type === "truck") {
      var cabLen = len * 0.3;
      var cargoLen = len * 0.56;
      var cabX = car.x + s * (len * 0.31);
      renderer.cube(car.x - s * len * 0.11, base + 0.25, z, cargoLen, 0.64, width * 0.94, car.cargo);
      renderer.cube(car.x - s * len * 0.11, base + 0.72, z, cargoLen * 0.96, 0.06, width * 0.88, CR.shade(car.cargo, 0.14));
      renderer.cube(cabX, base + 0.17, z, cabLen, 0.2, width * 0.88, dark);
      renderer.cube(cabX, base + 0.34, z, cabLen * 0.94, 0.47, width * 0.86, color);
      renderer.cube(cabX, base + 0.78, z, cabLen * 0.82, 0.06, width * 0.8, roof);
      renderer.cube(cabX + s * cabLen * 0.36, base + 0.49, z, 0.04, 0.22, width * 0.68, glass);
      renderer.cube(cabX - s * cabLen * 0.04, base + 0.53, nearFace, cabLen * 0.6, 0.2, 0.025, glassLight);
    } else if (car.type === "bus") {
      renderer.cube(car.x, base + 0.14, z, len * 0.94, 0.24, width * 0.94, dark);
      renderer.cube(car.x, base + 0.29, z, len * 0.96, 0.7, width * 0.96, color);
      renderer.cube(car.x, base + 0.97, z, len * 0.92, 0.08, width * 0.9, roof);
      renderer.cube(car.x, base + 0.36, z - width * 0.486, len * 0.88, 0.1, 0.03, "#f4d56a");
      renderer.cube(car.x, base + 0.62, nearFace, len * 0.8, 0.22, 0.025, glass);
      renderer.cube(car.x - len * 0.08, base + 0.62, nearFace - 0.01, 0.06, 0.23, 0.02, color);
      renderer.cube(car.x + len * 0.18, base + 0.62, nearFace - 0.01, 0.06, 0.23, 0.02, color);
      renderer.cube(front, base + 0.48, z, 0.04, 0.38, width * 0.72, glass);
    } else if (car.type === "van") {
      renderer.cube(car.x - s * len * 0.04, base + 0.14, z, len * 0.9, 0.62, width * 0.92, color);
      renderer.cube(car.x - s * len * 0.04, base + 0.74, z, len * 0.85, 0.07, width * 0.84, roof);
      renderer.cube(car.x + s * len * 0.28, base + 0.49, z, 0.04, 0.24, width * 0.66, glass);
      renderer.cube(car.x + s * len * 0.04, base + 0.51, nearFace, len * 0.42, 0.21, 0.025, glassLight);
    } else {
      renderer.cube(car.x, base + 0.14, z, len * 0.93, 0.26, width * 0.9, color);
      renderer.cube(car.x - s * len * 0.04, base + 0.39, z, len * 0.54, 0.25, width * 0.78, color);
      renderer.cube(car.x - s * len * 0.04, base + 0.62, z, len * 0.47, 0.045, width * 0.7, roof);
      renderer.cube(car.x - s * len * 0.04, base + 0.45, nearFace, len * 0.38, 0.16, 0.025, glass);
      renderer.cube(car.x + s * len * 0.18, base + 0.45, z, 0.04, 0.17, width * 0.62, glass);
      if (car.type === "taxi") {
        renderer.cube(car.x - s * len * 0.04, base + 0.68, z, 0.33, 0.12, 0.28, "#fff7dc");
      }
    }

    renderer.cube(front, base + 0.34, z - width * 0.26, 0.045, 0.11, 0.15, "#ffeaa0");
    renderer.cube(front, base + 0.34, z + width * 0.26, 0.045, 0.11, 0.15, "#ffeaa0");
    renderer.cube(rear, base + 0.36, z, 0.035, 0.1, width * 0.48, "#ff4c4c");
  };

  /* ------------------------------------------------------------------------
     River logs
     ------------------------------------------------------------------------ */

  World.prototype._drawLog = function (renderer, log, row, time) {
    var z = row.z;
    var base = 0.035;
    var length = log.len;
    var bob = Math.sin(time * 1.7 + log.phase) * 0.012;

    if (row.z > this.player.z + 16) {
      renderer.cube(log.x, base + bob, z, length * 0.98, 0.32, 0.68, C.log);
      renderer.cube(log.x, base + bob + 0.32, z, length * 0.9, 0.035, 0.14, C.logDark);
      return;
    }

    if (Math.abs(row.z - this.player.z) < 12) {
      renderer.shadow(log.x, z, length * 0.55, 0.29, 0.18, 0.006);
    }
    renderer.cube(log.x, base + bob, z, length * 0.98, 0.32, 0.68, C.log);
    renderer.cube(log.x + length * 0.48, base + bob, z, 0.07, 0.28, 0.55, C.logLight);
    renderer.cube(log.x, base + bob + 0.32, z - 0.12, length * 0.94, 0.035, 0.06, C.logDark);
    renderer.cube(log.x, base + bob + 0.32, z + 0.12, length * 0.94, 0.035, 0.06, C.logDark);
    if (log.variant === 1) {
      renderer.cube(log.x + length * 0.18, base + bob + 0.35, z - 0.13, 0.42, 0.02, 0.15, "#6f9f45");
    }
    renderer.flatQuad(log.x, -0.028, z + 0.41, length * 0.8, 0.065, "#d8f8ff", 0.32);
    renderer.flatQuad(log.x, -0.028, z - 0.41, length * 0.8, 0.065, "#d8f8ff", 0.2);
  };

  /* ------------------------------------------------------------------------
     Coins
     ------------------------------------------------------------------------ */

  World.prototype._drawCoin = function (renderer, coin, row, time) {
    var ctx = renderer.ctx;
    var bob = Math.sin(time * 2.4 + coin.phase) * 0.075;
    var proj = renderer.project(coin.x, 0.68 + bob, row.z);
    if (!proj) return;

    renderer.shadow(coin.x, row.z, 0.18, 0.145, 0.12);

    var radius = CR.clamp(proj.scale * 0.105, 6.5, 27);
    if (coin.value === 3) radius *= 1.24;
    var spin = Math.cos(time * 3.4 + coin.phase);
    var rx = Math.max(2.4, radius * (0.22 + 0.78 * Math.abs(spin)));
    var ry = radius;
    var pulse = 0.5 + 0.5 * Math.sin(time * 3.4 + coin.phase);

    ctx.save();
    ctx.translate(proj.x, proj.y - radius * 0.1);

    ctx.globalAlpha = 0.16 + pulse * 0.08;
    ctx.fillStyle = "#ffe56b";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.65, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = coin.value === 3 ? "#ffb02e" : "#ffd23f";
    ctx.strokeStyle = "#9c6500";
    ctx.lineWidth = Math.max(1.4, radius * 0.13);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = coin.value === 3 ? "#ffe27c" : "#fff1a8";
    ctx.beginPath();
    ctx.ellipse(-rx * 0.12, -ry * 0.12, rx * 0.64, ry * 0.64, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "#c27e00";
    if (coin.value === 3) {
      ctx.font = "900 " + Math.round(radius * 1.05) + "px 'Arial Rounded MT Bold', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("3", 0, radius * 0.03);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -ry * 0.45);
      ctx.lineTo(rx * 0.24, -ry * 0.08);
      ctx.lineTo(rx * 0.5, 0);
      ctx.lineTo(rx * 0.24, ry * 0.08);
      ctx.lineTo(0, ry * 0.45);
      ctx.lineTo(-rx * 0.24, ry * 0.08);
      ctx.lineTo(-rx * 0.5, 0);
      ctx.lineTo(-rx * 0.24, -ry * 0.08);
      ctx.closePath();
      ctx.fill();
    }

    if (pulse > 0.72) {
      ctx.strokeStyle = "rgba(255,255,235,0.9)";
      ctx.lineWidth = Math.max(1, radius * 0.08);
      ctx.beginPath();
      ctx.moveTo(rx * 0.8, -ry * 1.3);
      ctx.lineTo(rx * 0.8, -ry * 1.9);
      ctx.moveTo(rx * 0.45, -ry * 1.6);
      ctx.lineTo(rx * 1.15, -ry * 1.6);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  };

  /* ------------------------------------------------------------------------
     Train + crossing signs
     ------------------------------------------------------------------------ */

  World.prototype._drawTrain = function (renderer, train, row, time) {
    var z = row.z;
    var base = GROUND + 0.06;
    var centers = [train.x - 3.25, train.x, train.x + 3.25];
    var leadIndex = train.dir > 0 ? 2 : 0;
    var i;
    var j;

    renderer.shadow(train.x, z, 5.2, 0.58, 0.17);

    for (i = 0; i < centers.length; i++) {
      var cx = centers[i];
      var isLead = i === leadIndex;
      var bodyColor = isLead ? "#f0b42e" : "#2f6f96";
      var roofColor = isLead ? "#ffe18a" : "#6cb1cc";

      renderer.cube(cx, base, z - 0.42, 3.0, 0.22, 0.12, "#252f35");
      renderer.cube(cx, base, z + 0.42, 3.0, 0.22, 0.12, "#252f35");
      renderer.cube(cx - 1.05, base, z - 0.46, 0.34, 0.26, 0.13, "#1c2429");
      renderer.cube(cx + 1.05, base, z - 0.46, 0.34, 0.26, 0.13, "#1c2429");
      renderer.cube(cx - 1.05, base, z + 0.46, 0.34, 0.26, 0.13, "#1c2429");
      renderer.cube(cx + 1.05, base, z + 0.46, 0.34, 0.26, 0.13, "#1c2429");
      renderer.cube(cx, base + 0.18, z, 2.94, 0.82, 0.96, bodyColor);
      renderer.cube(cx, base + 0.97, z, 2.82, 0.08, 0.88, roofColor);
      renderer.cube(cx, base + 0.38, z - 0.485, 2.75, 0.11, 0.025, "#f8db64");
      renderer.cube(cx, base + 0.6, z - 0.492, 2.55, 0.09, 0.02, "#1b333f");

      for (j = 0; j < 4; j++) {
        renderer.cube(cx - 0.92 + j * 0.61, base + 0.56, z - 0.5, 0.42, 0.28, 0.03, "#1e3541");
        renderer.cube(cx - 0.8 + j * 0.61, base + 0.65, z - 0.516, 0.08, 0.07, 0.01, "#8bc7d4");
      }

      if (isLead) {
        var frontX = cx + train.dir * 1.52;
        renderer.cube(frontX, base + 0.46, z - 0.3, 0.05, 0.16, 0.2, "#fff1a8");
        renderer.cube(frontX, base + 0.46, z + 0.3, 0.05, 0.16, 0.2, "#fff1a8");
        renderer.cube(frontX - train.dir * 0.02, base + 0.76, z, 0.04, 0.22, 0.76, "#ffe18a");
      }
    }

    if (!renderer.reducedMotion) {
      for (var st = 0; st < 4; st++) {
        var sx = train.x - train.dir * (5.5 + st * 0.65);
        renderer.flatQuad(sx, 0.34 + st * 0.1, z, 1.2, 0.03, "#ffffff", 0.11 - st * 0.02);
      }
    }
  };

  World.prototype._drawSign = function (renderer, sign, row, time) {
    var ctx = renderer.ctx;
    var warning = row.train.warned || row.train.active;
    var blink = warning && Math.sin(time * 16) > -0.1;
    var z = sign.z;

    renderer.cube(sign.x, GROUND, z, 0.09, 1.55, 0.09, "#394952");
    renderer.cube(sign.x, GROUND + 1.44, z, 0.4, 0.4, 0.06, "#f6f0df");
    renderer.cube(sign.x, GROUND + 1.48, z - 0.035, 0.28, 0.28, 0.03, "#d8d2bf");

    renderer.line(sign.x - 0.28, GROUND + 1.34, z - 0.04, sign.x + 0.28, GROUND + 1.62, z - 0.04, "#2d3940", 7);
    renderer.line(sign.x - 0.28, GROUND + 1.62, z - 0.04, sign.x + 0.28, GROUND + 1.34, z - 0.04, "#2d3940", 7);
    renderer.line(sign.x - 0.28, GROUND + 1.34, z - 0.045, sign.x + 0.28, GROUND + 1.62, z - 0.045, "#f6f0df", 3.6);
    renderer.line(sign.x - 0.28, GROUND + 1.62, z - 0.045, sign.x + 0.28, GROUND + 1.34, z - 0.045, "#f6f0df", 3.6);

    renderer.cube(sign.x - 0.19, GROUND + 1.1, z - 0.06, 0.09, 0.09, 0.06, warning ? (blink ? "#ff4949" : "#791f28") : "#4d292c");
    renderer.cube(sign.x + 0.19, GROUND + 1.1, z - 0.06, 0.09, 0.09, 0.06, warning ? (blink ? "#ff4949" : "#791f28") : "#4d292c");

    if (warning && blink) {
      var p1 = renderer.project(sign.x - 0.19, GROUND + 1.145, z - 0.09);
      var p2 = renderer.project(sign.x + 0.19, GROUND + 1.145, z - 0.09);
      if (p1) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = "#ff3838";
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, 8, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      if (p2) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = "#ff3838";
        ctx.beginPath();
        ctx.arc(p2.x, p2.y, 8, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  };

  /* ------------------------------------------------------------------------
     Character
     ------------------------------------------------------------------------ */

  World.prototype._drawPlayer = function (renderer, time) {
    var p = this.player;
    if (p.dead && this.deathCause === "water" && this.deathTime > 0.62) return;

    var skin = CR.SKINS[CR.save.data.skin] || CR.SKINS.chicken;
    var waterDeath = p.dead && this.deathCause === "water";
    var alpha = waterDeath ? CR.clamp(1 - this.deathTime * 1.4, 0, 1) : 1;
    if (alpha <= 0.02) return;

    var surface = waterDeath ? -0.03 : p.ridingLog ? LOG_TOP : p.surfaceY;
    var bob = this.mode === "menu"
      ? Math.sin(time * 2.3 + p.idlePhase) * 0.026
      : !p.hopping && !p.dead ? Math.sin(time * 2.8 + p.idlePhase) * 0.012 : 0;
    var groundY = surface + p.y + bob;
    var squashY = p.dead && !waterDeath ? p.squash : 1;
    var yaw = p.faceYaw + (p.dead && !waterDeath ? this.deathSpin : 0);
    var cos = Math.cos(yaw);
    var sin = Math.sin(yaw);
    var parts = [];

    var shadowScale = CR.clamp(1 - p.y * 0.55, 0.35, 1);
    if (!waterDeath) {
      renderer.shadow(p.x, p.z, 0.4 * shadowScale, 0.32 * shadowScale, 0.22 * alpha, surface + 0.012);
    }

    function addPart(lx, ly, lz, sx, sy, sz, color, extra) {
      var wx = p.x + lx * cos + lz * sin;
      var wz = p.z - lx * sin + lz * cos;
      var base = groundY + ly * squashY;
      var height = Math.max(0.008, sy * squashY);
      var depth = renderer.depth(wx, base + height * 0.5, wz);
      parts.push({
        x: wx,
        base: base,
        z: wz,
        sx: sx,
        sy: height,
        sz: sz,
        color: color,
        depth: depth
      });
    }

    var body = skin.body;
    var shade = skin.bodyShade;
    var belly = skin.belly;
    var wing = skin.wing;
    var beak = skin.beak;
    var feet = skin.feet;
    var eye = skin.eye;
    var blink = (time + p.idlePhase) % 4.6 > 4.44 && !p.dead;

    if (skin.style === "chicken") {
      // A tall tail fan gives the silhouette its chicken read from behind.
      addPart(0, 0.32, -0.38, 0.32, 0.18, 0.2, shade);
      addPart(-0.12, 0.44, -0.44, 0.12, 0.35, 0.14, body);
      addPart(0, 0.46, -0.47, 0.14, 0.43, 0.14, body);
      addPart(0.12, 0.44, -0.44, 0.12, 0.35, 0.14, body);
      addPart(-0.12, 0.79, -0.44, 0.12, 0.09, 0.13, wing);
      addPart(0, 0.89, -0.47, 0.14, 0.09, 0.13, wing);
      addPart(0.12, 0.79, -0.44, 0.12, 0.09, 0.13, wing);

      addPart(-0.2, 0.005, -0.02, 0.14, 0.08, 0.24, feet);
      addPart(0.2, 0.005, -0.02, 0.14, 0.08, 0.24, feet);
      addPart(-0.2, 0.045, -0.13, 0.13, 0.04, 0.1, skin.beak);
      addPart(0.2, 0.045, -0.13, 0.13, 0.04, 0.1, skin.beak);

      addPart(0, 0.08, 0, 0.64, 0.35, 0.65, body);
      addPart(0, 0.39, 0.01, 0.6, 0.24, 0.6, body);

      addPart(-0.36, 0.2, 0.02, 0.12, 0.32, 0.48, wing);
      addPart(0.36, 0.2, 0.02, 0.12, 0.32, 0.48, wing);
      addPart(-0.38, 0.18, -0.09, 0.065, 0.08, 0.23, shade);
      addPart(-0.38, 0.27, -0.09, 0.065, 0.08, 0.23, shade);
      addPart(-0.38, 0.36, -0.09, 0.065, 0.08, 0.23, shade);
      addPart(0.38, 0.18, -0.09, 0.065, 0.08, 0.23, shade);
      addPart(0.38, 0.27, -0.09, 0.065, 0.08, 0.23, shade);
      addPart(0.38, 0.36, -0.09, 0.065, 0.08, 0.23, shade);

      addPart(0, 0.15, 0.315, 0.38, 0.3, 0.05, belly);
      addPart(0, 0.61, 0.04, 0.4, 0.37, 0.42, body);
      addPart(0, 0.53, 0.295, 0.28, 0.15, 0.04, belly);

      if (this.mode === "menu") {
        addPart(-0.1, 0.8, 0.27, blink ? 0.066 : 0.066, blink ? 0.022 : 0.082, 0.045, eye);
        addPart(0.1, 0.8, 0.27, blink ? 0.066 : 0.066, blink ? 0.022 : 0.082, 0.045, eye);
        addPart(-0.1, 0.83, 0.294, 0.02, 0.026, 0.01, "#ffffff");
        addPart(0.1, 0.83, 0.294, 0.02, 0.026, 0.01, "#ffffff");
      } else {
        addPart(-0.212, 0.8, 0.11, 0.045, blink ? 0.026 : 0.084, 0.08, eye);
        addPart(0.212, 0.8, 0.11, 0.045, blink ? 0.026 : 0.084, 0.08, eye);
        addPart(-0.235, 0.83, 0.14, 0.015, 0.03, 0.02, "#ffffff");
        addPart(0.235, 0.83, 0.14, 0.015, 0.03, 0.02, "#ffffff");
      }

      addPart(0.045, 0.71, 0.345, 0.22, 0.1, 0.23, beak);
      addPart(0.15, 0.63, 0.3, 0.07, 0.11, 0.07, skin.comb);
      addPart(-0.15, 0.63, 0.3, 0.07, 0.11, 0.07, skin.comb);
      addPart(0, 0.98, 0.025, 0.092, 0.14, 0.1, skin.comb);
      addPart(-0.098, 1.0, 0.015, 0.078, 0.19, 0.088, skin.comb);
      addPart(0.098, 0.99, 0.025, 0.072, 0.16, 0.08, skin.comb);
    } else if (skin.style === "penguin") {
      addPart(0, 0.3, -0.37, 0.28, 0.18, 0.18, "#182631");
      addPart(-0.18, 0.005, -0.04, 0.14, 0.07, 0.25, feet);
      addPart(0.18, 0.005, -0.04, 0.14, 0.07, 0.25, feet);
      addPart(0, 0.09, 0, 0.64, 0.54, 0.66, body);
      addPart(-0.35, 0.2, 0, 0.1, 0.38, 0.34, wing);
      addPart(0.35, 0.2, 0, 0.1, 0.38, 0.34, wing);
      addPart(0, 0.16, 0.32, 0.4, 0.38, 0.07, belly);
      addPart(0, 0.56, 0.055, 0.48, 0.4, 0.45, body);
      addPart(0, 0.62, 0.285, 0.36, 0.3, 0.04, belly);

      // Bright scarf and side face make the penguin readable from behind.
      addPart(0, 0.55, 0.02, 0.5, 0.075, 0.52, skin.accent);
      addPart(0.2, 0.38, -0.28, 0.1, 0.28, 0.07, skin.accent);
      addPart(0.2, 0.22, -0.32, 0.13, 0.08, 0.08, skin.accent);

      if (this.mode !== "menu") {
        addPart(-0.225, 0.77, 0.08, 0.05, 0.16, 0.17, belly);
        addPart(0.225, 0.77, 0.08, 0.05, 0.16, 0.17, belly);
        addPart(-0.253, 0.79, 0.11, 0.018, 0.068, 0.06, eye);
        addPart(0.253, 0.79, 0.11, 0.018, 0.068, 0.06, eye);
        addPart(-0.248, 0.72, 0.22, 0.055, 0.07, 0.1, beak);
        addPart(0.248, 0.72, 0.22, 0.055, 0.07, 0.1, beak);
      }

      addPart(-0.12, 0.8, 0.296, blink ? 0.075 : 0.074, blink ? 0.022 : 0.085, 0.05, eye);
      addPart(0.12, 0.8, 0.296, blink ? 0.075 : 0.074, blink ? 0.022 : 0.085, 0.05, eye);
      addPart(0, 0.71, 0.35, 0.21, 0.1, 0.19, beak);
      addPart(0, 0.73, 0.34, 0.25, 0.035, 0.16, "#e08a1c");
    } else if (skin.style === "frog") {
      addPart(-0.17, 0.005, 0.12, 0.15, 0.07, 0.24, feet);
      addPart(0.17, 0.005, 0.12, 0.15, 0.07, 0.24, feet);
      addPart(0, 0.08, 0, 0.68, 0.46, 0.64, body);
      addPart(0, 0.13, 0.305, 0.46, 0.3, 0.05, belly);
      addPart(0, 0.56, 0.05, 0.5, 0.36, 0.44, body);
      addPart(-0.13, 0.88, 0.14, 0.19, 0.18, 0.18, "#ffffff");
      addPart(0.13, 0.88, 0.14, 0.19, 0.18, 0.18, "#ffffff");
      addPart(-0.13, 0.86, 0.235, 0.09, 0.12, 0.06, skin.pupil);
      addPart(0.13, 0.86, 0.235, 0.09, 0.12, 0.06, skin.pupil);
      if (this.mode !== "menu") {
        addPart(-0.13, 0.87, 0.03, 0.09, 0.11, 0.055, skin.pupil);
        addPart(0.13, 0.87, 0.03, 0.09, 0.11, 0.055, skin.pupil);
        addPart(-0.25, 0.3, -0.26, 0.12, 0.1, 0.08, skin.bodyShade);
        addPart(0.24, 0.22, -0.24, 0.1, 0.09, 0.07, skin.bodyShade);
      }
      addPart(0, 0.68, 0.33, 0.31, 0.06, 0.05, skin.beak);
      addPart(-0.25, 0.32, -0.07, 0.11, 0.1, 0.08, skin.bodyShade);
      addPart(0.24, 0.22, 0.08, 0.09, 0.09, 0.08, skin.bodyShade);
      addPart(-0.36, 0.22, 0, 0.09, 0.25, 0.34, wing);
      addPart(0.36, 0.22, 0, 0.09, 0.25, 0.34, wing);
    } else {
      addPart(0, 0.3, -0.38, 0.32, 0.25, 0.18, shade);
      addPart(-0.16, 0.005, -0.02, 0.13, 0.075, 0.24, feet);
      addPart(0.16, 0.005, -0.02, 0.13, 0.075, 0.24, feet);
      addPart(0, 0.09, 0, 0.64, 0.53, 0.68, body);
      addPart(-0.36, 0.22, 0, 0.1, 0.33, 0.42, wing);
      addPart(0.36, 0.22, 0, 0.1, 0.33, 0.42, wing);
      addPart(0, 0.16, 0.325, 0.4, 0.33, 0.05, belly);
      addPart(0, 0.57, 0.055, 0.48, 0.4, 0.45, body);
      addPart(0, 0.49, 0.295, 0.32, 0.18, 0.04, belly);
      if (this.mode !== "menu") {
        addPart(-0.212, 0.8, 0.11, 0.045, blink ? 0.026 : 0.084, 0.08, eye);
        addPart(0.212, 0.8, 0.11, 0.045, blink ? 0.026 : 0.084, 0.08, eye);
        addPart(-0.235, 0.83, 0.14, 0.015, 0.03, 0.02, "#ffffff");
        addPart(0.235, 0.83, 0.14, 0.015, 0.03, 0.02, "#ffffff");
      }
      addPart(-0.126, 0.8, 0.285, blink ? 0.075 : 0.072, blink ? 0.024 : 0.09, 0.052, eye);
      addPart(0.126, 0.8, 0.285, blink ? 0.075 : 0.072, blink ? 0.024 : 0.09, 0.052, eye);
      addPart(0, 0.71, 0.35, 0.2, 0.1, 0.18, beak);
      addPart(0, 0.87, -0.1, 0.18, 0.16, 0.2, skin.mane);
      addPart(-0.1, 0.84, -0.15, 0.18, 0.14, 0.16, skin.mane);
      addPart(0.1, 0.86, -0.12, 0.16, 0.16, 0.16, skin.mane);
      addPart(0, 0.94, 0.02, 0.11, 0.22, 0.11, skin.horn);
      addPart(0, 1.1, 0.05, 0.075, 0.16, 0.075, "#ffe27c");
      addPart(0, 1.22, 0.07, 0.045, 0.12, 0.045, "#fff1b0");
      addPart(0, 0.44, -0.41, 0.25, 0.24, 0.15, skin.mane);
    }

    parts.sort(function (a, b) {
      return b.depth - a.depth;
    });

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      renderer.cube(part.x, part.base, part.z, part.sx, part.sy, part.sz, part.color, {
        yaw: yaw,
        alpha: alpha
      });
    }
  };
})(window.CR = window.CR || {});
