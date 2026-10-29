/* ==========================================================================
   Game shell: UI, input, audio events, camera, loop and save integration.
   ========================================================================== */
(function (CR) {
  "use strict";

  var canvas = document.getElementById("game");
  if (!canvas) return;

  var renderer = new CR.Renderer(canvas);
  var sound = new CR.Sound();
  var world = null;
  var state = "menu";
  var gameTime = 0;
  var lastFrame = performance.now();
  var score = 0;
  var startingBest = CR.save.data.best;
  var bestBadgeShown = false;
  var newBestTimer = 0;
  var tutorialUsed = false;
  var deathTimer = 0;
  var deathData = null;
  var deathShown = false;
  var toastTimer = 0;
  var cam = { x: 0, z: 0 };
  var pointer = null;
  var fps = 60;
  var fpsAccum = 0;
  var fpsFrames = 0;
  var debugEnabled = false;

  try {
    var params = new URLSearchParams(window.location.search);
    debugEnabled = params.get("debug") === "1";
  } catch (error) {
    debugEnabled = false;
  }

  var ui = {
    hud: document.getElementById("hud"),
    menu: document.getElementById("menu"),
    pauseScreen: document.getElementById("pauseScreen"),
    gameoverScreen: document.getElementById("gameoverScreen"),
    scoreValue: document.getElementById("scoreValue"),
    bestValue: document.getElementById("bestValue"),
    coinValue: document.getElementById("coinValue"),
    scorePill: document.querySelector(".score-pill"),
    coinPill: document.querySelector(".coin-pill"),
    newBestBadge: document.getElementById("newBestBadge"),
    tutorial: document.getElementById("tutorial"),
    menuBest: document.getElementById("menuBest"),
    menuCoins: document.getElementById("menuCoins"),
    skinRail: document.getElementById("skinRail"),
    playBtn: document.getElementById("playBtn"),
    menuSoundBtn: document.getElementById("menuSoundBtn"),
    menuSoundLabel: document.getElementById("menuSoundLabel"),
    pauseBtn: document.getElementById("pauseBtn"),
    resumeBtn: document.getElementById("resumeBtn"),
    pauseRestartBtn: document.getElementById("pauseRestartBtn"),
    pauseMenuBtn: document.getElementById("pauseMenuBtn"),
    pauseSoundBtn: document.getElementById("pauseSoundBtn"),
    pauseSoundLabel: document.getElementById("pauseSoundLabel"),
    retryBtn: document.getElementById("retryBtn"),
    overMenuBtn: document.getElementById("overMenuBtn"),
    overTitle: document.getElementById("overTitle"),
    overMessage: document.getElementById("overMessage"),
    finalScore: document.getElementById("finalScore"),
    finalBest: document.getElementById("finalBest"),
    runCoins: document.getElementById("runCoins"),
    newBestRibbon: document.getElementById("newBestRibbon"),
    toast: document.getElementById("toast"),
    flash: document.getElementById("flash")
  };
  ui.pauseSoundBtn.setAttribute("aria-pressed", "false");

  /* ------------------------------------------------------------------------
     Utility UI
     ------------------------------------------------------------------------ */

  function setHidden(element, hidden) {
    if (!element) return;
    element.classList.toggle("hidden", !!hidden);
  }

  function showToast(message, duration) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      ui.toast.classList.remove("is-visible");
    }, duration || 2300);
  }

  function flash(red) {
    if (!ui.flash) return;
    ui.flash.classList.remove("is-on", "is-red");
    // Restart the CSS animation.
    void ui.flash.offsetWidth;
    if (red) ui.flash.classList.add("is-red");
    ui.flash.classList.add("is-on");
    window.setTimeout(function () {
      ui.flash.classList.remove("is-on", "is-red");
    }, 520);
  }

  function pop(element) {
    if (!element) return;
    element.classList.remove("pop");
    void element.offsetWidth;
    element.classList.add("pop");
    window.setTimeout(function () {
      element.classList.remove("pop");
    }, 320);
  }

  function updateSoundUI() {
    var muted = !!sound.muted;
    var label = muted ? "ЗВУК ВЫКЛ" : "ЗВУК ВКЛ";
    ui.menuSoundLabel.textContent = label;
    ui.pauseSoundLabel.textContent = label;
    ui.menuSoundBtn.setAttribute("aria-pressed", String(muted));
    ui.pauseSoundBtn.setAttribute("aria-pressed", String(muted));
  }

  function updateHUD(animateScore, animateCoin) {
    score = Math.max(0, score);
    ui.scoreValue.textContent = CR.fmt(score);
    ui.bestValue.textContent = CR.fmt(Math.max(CR.save.data.best, score));
    ui.coinValue.textContent = CR.fmt(CR.save.data.coins);
    ui.menuBest.textContent = CR.fmt(CR.save.data.best);
    ui.menuCoins.textContent = CR.fmt(CR.save.data.coins);
    if (animateScore) pop(ui.scorePill);
    if (animateCoin) pop(ui.coinPill);
  }

  function resetTutorial() {
    tutorialUsed = false;
    ui.tutorial.classList.remove("is-used");
    ui.tutorial.style.animation = "none";
    void ui.tutorial.offsetWidth;
    ui.tutorial.style.animation = "";
  }

  function hideTutorial() {
    if (tutorialUsed) return;
    tutorialUsed = true;
    ui.tutorial.classList.add("is-used");
  }

  /* ------------------------------------------------------------------------
     Character portraits
     ------------------------------------------------------------------------ */

  function roundFill(ctx, x, y, w, h, r, color, stroke) {
    CR.roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function ellipseFill(ctx, x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, CR.TAU);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawPortrait(canvasEl, key) {
    var ctx = canvasEl.getContext("2d");
    var W = canvasEl.width;
    var H = canvasEl.height;
    var skin = CR.SKINS[key];
    var cx = W * 0.5;
    var ink = "rgba(32,49,58,0.28)";
    ctx.clearRect(0, 0, W, H);

    // Contact shadow.
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#20313a";
    ctx.beginPath();
    ctx.ellipse(cx, H * 0.85, W * 0.26, H * 0.055, 0, 0, CR.TAU);
    ctx.fill();
    ctx.restore();

    // Feet.
    roundFill(ctx, cx - 28, H * 0.77, 22, 13, 6, skin.feet, ink);
    roundFill(ctx, cx + 6, H * 0.77, 22, 13, 6, skin.feet, ink);

    // Back wings / flippers.
    roundFill(ctx, cx - 47, H * 0.48, 18, 34, 9, skin.wing, ink);
    roundFill(ctx, cx + 29, H * 0.48, 18, 34, 9, skin.wing, ink);

    // Body.
    if (skin.style === "frog") {
      roundFill(ctx, cx - 40, H * 0.43, 80, 53, 24, skin.body, ink);
      ellipseFill(ctx, cx, H * 0.64, 27, 24, skin.belly);
    } else if (skin.style === "penguin") {
      roundFill(ctx, cx - 36, H * 0.39, 72, 58, 24, skin.body, ink);
      ellipseFill(ctx, cx, H * 0.63, 22, 28, skin.belly);
    } else {
      roundFill(ctx, cx - 36, H * 0.41, 72, 56, 23, skin.body, ink);
      ellipseFill(ctx, cx, H * 0.64, 21, 25, skin.belly);
    }

    // Neck / head base.
    var headTop = H * 0.18;
    var headH = H * 0.35;
    if (skin.style === "frog") {
      roundFill(ctx, cx - 37, headTop + 8, 74, H * 0.3, 24, skin.body, ink);
      // Bulging eyes.
      ellipseFill(ctx, cx - 22, headTop + 5, 17, 16, "#f8fff1");
      ellipseFill(ctx, cx + 22, headTop + 5, 17, 16, "#f8fff1");
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx - 22, headTop + 5, 17, 16, 0, 0, CR.TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx + 22, headTop + 5, 17, 16, 0, 0, CR.TAU);
      ctx.stroke();
      ellipseFill(ctx, cx - 22, headTop + 7, 7, 9, skin.pupil);
      ellipseFill(ctx, cx + 22, headTop + 7, 7, 9, skin.pupil);
      ellipseFill(ctx, cx - 24, headTop + 3, 2.5, 3, "#ffffff");
      ellipseFill(ctx, cx + 20, headTop + 3, 2.5, 3, "#ffffff");
      // Mouth.
      ctx.strokeStyle = "rgba(45,75,43,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, H * 0.43, 15, 0.22, Math.PI - 0.22);
      ctx.stroke();
      ellipseFill(ctx, cx - 27, H * 0.47, 4, 2.5, "rgba(255,121,168,0.45)");
      ellipseFill(ctx, cx + 27, H * 0.47, 4, 2.5, "rgba(255,121,168,0.45)");
      ellipseFill(ctx, cx - 25, H * 0.69, 4, 4, skin.bodyShade);
      ellipseFill(ctx, cx + 26, H * 0.62, 3.4, 3.4, skin.bodyShade);
      return;
    }

    // Head.
    roundFill(ctx, cx - 32, headTop, 64, headH + 10, 22, skin.body, ink);

    if (skin.style === "unicorn") {
      // Mane behind the head.
      ellipseFill(ctx, cx - 33, headTop + 8, 17, 23, skin.mane);
      ellipseFill(ctx, cx - 35, headTop + 33, 13, 20, skin.mane);
      roundFill(ctx, cx - 25, headTop - 15, 50, 20, 10, skin.mane, ink);
      // Ears.
      ctx.beginPath();
      ctx.moveTo(cx - 26, headTop + 2);
      ctx.lineTo(cx - 34, headTop - 18);
      ctx.lineTo(cx - 13, headTop - 7);
      ctx.closePath();
      ctx.fillStyle = skin.body;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Horn.
      ctx.beginPath();
      ctx.moveTo(cx - 7, headTop - 6);
      ctx.lineTo(cx, headTop - 45);
      ctx.lineTo(cx + 8, headTop - 6);
      ctx.closePath();
      ctx.fillStyle = skin.horn;
      ctx.fill();
      ctx.strokeStyle = "rgba(32,49,58,0.22)";
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, headTop - 36);
      ctx.lineTo(cx + 2, headTop - 17);
      ctx.stroke();
      // Muzzle.
      ellipseFill(ctx, cx, headTop + 34, 25, 19, skin.belly);
      ellipseFill(ctx, cx - 12, headTop + 35, 2.2, 3, "rgba(155,95,120,0.55)");
      ellipseFill(ctx, cx + 12, headTop + 35, 2.2, 3, "rgba(155,95,120,0.55)");
      // Eyes.
      ellipseFill(ctx, cx - 16, headTop + 17, 6.2, 8, skin.eye);
      ellipseFill(ctx, cx + 16, headTop + 17, 6.2, 8, skin.eye);
      ellipseFill(ctx, cx - 14, headTop + 14, 2, 2.6, "#ffffff");
      ellipseFill(ctx, cx + 18, headTop + 14, 2, 2.6, "#ffffff");
      // Cheeks.
      ellipseFill(ctx, cx - 26, headTop + 29, 7, 4, "rgba(255,121,168,0.3)");
      ellipseFill(ctx, cx + 26, headTop + 29, 7, 4, "rgba(255,121,168,0.3)");
      // Sparkles.
      drawSparkle(ctx, cx + 47, headTop + 5, 6, "#ffd23f");
      drawSparkle(ctx, cx - 51, H * 0.37, 4, "#ff79a8");
      return;
    }

    if (skin.style === "penguin") {
      // White face.
      ctx.beginPath();
      ctx.ellipse(cx, headTop + 25, 26, 25, 0, 0, CR.TAU);
      ctx.fillStyle = skin.belly;
      ctx.fill();
      // Scarf.
      roundFill(ctx, cx - 31, headTop + 44, 62, 10, 5, skin.accent, ink);
      roundFill(ctx, cx + 17, headTop + 48, 11, 24, 5, skin.accent, ink);
      // Eyes.
      ellipseFill(ctx, cx - 13, headTop + 20, 5.8, 7.5, skin.eye);
      ellipseFill(ctx, cx + 13, headTop + 20, 5.8, 7.5, skin.eye);
      ellipseFill(ctx, cx - 11, headTop + 17, 1.8, 2.4, "#ffffff");
      ellipseFill(ctx, cx + 15, headTop + 17, 1.8, 2.4, "#ffffff");
      // Beak.
      ctx.beginPath();
      ctx.moveTo(cx - 9, headTop + 30);
      ctx.lineTo(cx, headTop + 41);
      ctx.lineTo(cx + 9, headTop + 30);
      ctx.closePath();
      ctx.fillStyle = skin.beak;
      ctx.fill();
      ctx.strokeStyle = "rgba(154,92,15,0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Head highlight.
      ctx.strokeStyle = "rgba(255,255,255,0.27)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx - 8, headTop + 8, 20, Math.PI * 1.05, Math.PI * 1.42);
      ctx.stroke();
      return;
    }

    if (skin.style === "chicken") {
      // Comb.
      roundFill(ctx, cx - 22, headTop - 12, 13, 22, 6, skin.comb, ink);
      roundFill(ctx, cx - 6, headTop - 20, 13, 28, 6, skin.comb, ink);
      roundFill(ctx, cx + 10, headTop - 10, 12, 20, 6, skin.comb, ink);
      // Cheeks.
      ellipseFill(ctx, cx - 27, headTop + 29, 7, 4.4, "rgba(255,117,117,0.22)");
      ellipseFill(ctx, cx + 27, headTop + 29, 7, 4.4, "rgba(255,117,117,0.22)");
      // Eyes.
      ellipseFill(ctx, cx - 14, headTop + 19, 6, 7.8, skin.eye);
      ellipseFill(ctx, cx + 14, headTop + 19, 6, 7.8, skin.eye);
      ellipseFill(ctx, cx - 12, headTop + 16, 1.9, 2.5, "#ffffff");
      ellipseFill(ctx, cx + 16, headTop + 16, 1.9, 2.5, "#ffffff");
      // Beak.
      ctx.beginPath();
      ctx.moveTo(cx - 10, headTop + 30);
      ctx.lineTo(cx, headTop + 43);
      ctx.lineTo(cx + 10, headTop + 30);
      ctx.closePath();
      ctx.fillStyle = skin.beak;
      ctx.fill();
      ctx.strokeStyle = "rgba(161,94,14,0.42)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Head highlight.
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx - 10, headTop + 9, 19, Math.PI * 1.04, Math.PI * 1.4);
      ctx.stroke();
    }
  }

  function drawSparkle(ctx, x, y, size, color) {
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

  /* ------------------------------------------------------------------------
     Skin shop
     ------------------------------------------------------------------------ */

  function renderSkinCards() {
    if (!ui.skinRail) return;
    ui.skinRail.innerHTML = "";
    var selected = CR.save.data.skin;

    CR.SKIN_ORDER.forEach(function (key) {
      var skin = CR.SKINS[key];
      var unlocked = CR.save.data.unlocked.indexOf(key) !== -1;
      var isSelected = selected === key;
      var canBuy = !unlocked && CR.save.data.coins >= skin.cost;

      var card = document.createElement("button");
      card.type = "button";
      card.className = "char-card";
      card.dataset.skin = key;
      card.setAttribute("aria-pressed", String(isSelected));
      card.setAttribute(
        "aria-label",
        skin.name + (isSelected ? ", выбран" : unlocked ? ", доступен" : ", стоит " + skin.cost + " монет")
      );
      if (isSelected) card.classList.add("is-selected");
      if (!unlocked) card.classList.add("is-locked");
      if (canBuy) card.classList.add("can-buy");

      var art = document.createElement("span");
      art.className = "char-art";

      var preview = document.createElement("canvas");
      preview.width = 180;
      preview.height = 150;
      preview.setAttribute("aria-hidden", "true");
      art.appendChild(preview);

      var badge = document.createElement("span");
      badge.className = "char-state";
      if (isSelected) {
        badge.innerHTML = '<svg class="check-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.3l3.1 3.1L13 4.7"/></svg>';
        badge.style.background = "var(--green-deep)";
        badge.style.border = "1px solid rgba(255,255,255,.65)";
      } else if (!unlocked) {
        badge.innerHTML = '<svg class="lock-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 7V5.3a3 3 0 0 1 6 0V7h.6c.5 0 .9.4.9.9v5.2c0 .5-.4.9-.9.9H4.4a.9.9 0 0 1-.9-.9V7.9c0-.5.4-.9.9-.9H5zm1.5 0h3V5.3a1.5 1.5 0 0 0-3 0V7z"/></svg>';
      } else {
        badge.style.display = "none";
      }
      art.appendChild(badge);
      card.appendChild(art);

      var name = document.createElement("span");
      name.className = "char-name";
      name.textContent = skin.name;
      card.appendChild(name);

      var cost = document.createElement("span");
      cost.className = "char-cost";
      if (isSelected) {
        cost.textContent = "ВЫБРАНО";
      } else if (unlocked) {
        cost.textContent = "ВЫБРАТЬ";
      } else {
        cost.innerHTML = '<span class="coin-icon" aria-hidden="true"></span><span>' + skin.cost + "</span>";
      }
      card.appendChild(cost);

      card.addEventListener("click", function () {
        selectSkin(key);
      });

      ui.skinRail.appendChild(card);
      drawPortrait(preview, key);
    });
  }

  function selectSkin(key) {
    var skin = CR.SKINS[key];
    if (!skin) return;
    var unlocked = CR.save.data.unlocked.indexOf(key) !== -1;

    if (unlocked) {
      if (CR.save.data.skin === key) {
        sound.click();
        return;
      }
      CR.save.data.skin = key;
      CR.save.write();
      sound.click();
      renderSkinCards();
      return;
    }

    if (CR.save.data.coins < skin.cost) {
      sound.bump();
      showToast("Не хватает " + (skin.cost - CR.save.data.coins) + " монет. Собери их в забеге!");
      return;
    }

    CR.save.data.coins -= skin.cost;
    CR.save.data.unlocked.push(key);
    CR.save.data.skin = key;
    CR.save.write();
    sound.unlock();
    showToast(skin.name + " открыт! Отличный выбор.");
    updateHUD(false, false);
    renderSkinCards();
  }

  /* ------------------------------------------------------------------------
     Scene lifecycle
     ------------------------------------------------------------------------ */

  function makeSeed() {
    return ((Date.now() & 0x7fffffff) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  }

  function freshMenuWorld() {
    world = new CR.World(makeSeed(), { menu: true });
    cam.x = 0;
    cam.z = 0;
  }

  function showMenu() {
    state = "menu";
    freshMenuWorld();
    deathTimer = 0;
    deathShown = false;
    score = 0;
    hideTutorial();
    setHidden(ui.hud, true);
    setHidden(ui.pauseScreen, true);
    setHidden(ui.gameoverScreen, true);
    setHidden(ui.menu, false);
    setHidden(ui.newBestRibbon, true);
    setHidden(ui.newBestBadge, true);
    updateHUD(false, false);
    renderSkinCards();
    updateSoundUI();
    sound.pause(false);
    window.scrollTo(0, 0);
  }

  function startRun() {
    if (state === "playing" || state === "dying") return;
    sound.init();
    sound.pause(false);

    world = new CR.World(makeSeed(), { menu: false });
    state = "playing";
    score = 0;
    startingBest = CR.save.data.best;
    bestBadgeShown = false;
    deathTimer = 0;
    deathShown = false;
    deathData = null;
    tutorialUsed = false;
    cam.x = world.player.x;
    cam.z = world.player.z;
    pointer = null;

    setHidden(ui.menu, true);
    setHidden(ui.pauseScreen, true);
    setHidden(ui.gameoverScreen, true);
    setHidden(ui.hud, false);
    setHidden(ui.newBestRibbon, true);
    setHidden(ui.newBestBadge, true);
    resetTutorial();
    updateHUD(false, false);
    updateSoundUI();
    sound.startRun();

    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    setHidden(ui.pauseScreen, false);
    sound.pause(true);
    hideTutorial();
    pointer = null;
    window.setTimeout(function () {
      if (ui.resumeBtn) ui.resumeBtn.focus({ preventScroll: true });
    }, 20);
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    setHidden(ui.pauseScreen, true);
    sound.pause(false);
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  function handleDeath(data) {
    if (state !== "playing") return;
    state = "dying";
    deathTimer = 0;
    deathShown = false;
    deathData = data;
    score = data.score;
    hideTutorial();
    pointer = null;
    flash(data.cause !== "water");
    updateHUD(false, false);

    if (data.cause === "water") {
      sound.splash();
      sound.deathTone();
    } else {
      sound.crash();
    }

    if (data.score > CR.save.data.best) {
      CR.save.data.best = data.score;
    }
    CR.save.data.runs += 1;
    CR.save.write();

    if (!bestBadgeShown && data.score > startingBest && data.score > 0) {
      bestBadgeShown = true;
      showNewBestBadge();
    }
  }

  function showGameOverScreen() {
    if (deathShown) return;
    deathShown = true;
    state = "gameover";
    sound.pause(true);
    setHidden(ui.hud, true);
    setHidden(ui.gameoverScreen, false);

    var cause = deathData ? deathData.cause : "car";
    var title = cause === "water" ? "БУЛЬ!" : cause === "train" ? "БАМ!" : "БУМ!";
    var message = cause === "water"
      ? "Бревно уплыло. В следующий раз прыгай точнее."
      : cause === "train"
        ? "Поезд не остановить. Дождись зелёного сигнала."
        : "Машины не тормозят. Проверь оба ряда.";

    ui.overTitle.textContent = title;
    ui.overMessage.textContent = message;
    ui.finalScore.textContent = CR.fmt(deathData ? deathData.score : score);
    ui.finalBest.textContent = CR.fmt(CR.save.data.best);
    ui.runCoins.textContent = CR.fmt(deathData ? deathData.coins : world.runCoins);

    var record = deathData && deathData.score > startingBest && deathData.score > 0;
    setHidden(ui.newBestRibbon, !record);
    if (record) sound.newBest();
    updateSoundUI();

    window.setTimeout(function () {
      if (ui.retryBtn) ui.retryBtn.focus({ preventScroll: true });
    }, 60);
  }

  function showNewBestBadge() {
    setHidden(ui.newBestBadge, false);
    clearTimeout(newBestTimer);
    newBestTimer = window.setTimeout(function () {
      setHidden(ui.newBestBadge, true);
    }, 4200);
  }

  /* ------------------------------------------------------------------------
     Event pump
     ------------------------------------------------------------------------ */

  function drainEvents() {
    if (!world || !world.events.length) return;
    var events = world.events;
    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      if (event.type === "hop") {
        sound.hop();
        hideTutorial();
      } else if (event.type === "land") {
        sound.land();
      } else if (event.type === "bump") {
        sound.bump();
      } else if (event.type === "coin") {
        CR.save.data.coins += event.amount;
        CR.save.write();
        sound.coin();
        updateHUD(false, true);
        if (event.amount > 1) showToast("+" + event.amount + " монеты!");
      } else if (event.type === "score") {
        score = event.score;
        updateHUD(true, false);
        if (score > CR.save.data.best) {
          CR.save.data.best = score;
          CR.save.write();
          if (!bestBadgeShown) {
            bestBadgeShown = true;
            showNewBestBadge();
            sound.newBest();
          }
        }
      } else if (event.type === "horn") {
        sound.trainHorn(event.volume);
      } else if (event.type === "death") {
        handleDeath(event);
      }
    }
    events.length = 0;
  }

  /* ------------------------------------------------------------------------
     Input
     ------------------------------------------------------------------------ */

  function attemptMove(dx, dz) {
    if (state !== "playing" || !world) return;
    hideTutorial();
    world.tryMove(dx, dz);
  }

  function onKeyDown(event) {
    var code = event.code;
    var isMoveKey = code === "ArrowUp" || code === "ArrowDown" || code === "ArrowLeft" || code === "ArrowRight" ||
      code === "KeyW" || code === "KeyA" || code === "KeyS" || code === "KeyD" || code === "Space";

    if (isMoveKey || code === "Escape" || code === "KeyP" || code === "KeyM" || code === "Enter") {
      if (event.repeat) {
        if (isMoveKey) event.preventDefault();
        return;
      }
    }

    if (code === "KeyM") {
      sound.init();
      sound.toggleMuted();
      updateSoundUI();
      showToast(sound.muted ? "Звук выключен" : "Звук включён", 1300);
      event.preventDefault();
      return;
    }

    if (code === "Escape" || code === "KeyP") {
      if (state === "playing") pauseGame();
      else if (state === "paused") resumeGame();
      else if (state === "gameover") showMenu();
      event.preventDefault();
      return;
    }

    if (state === "menu") {
      if ((code === "Space" || code === "Enter") && !isButtonFocused()) {
        event.preventDefault();
        startRun();
      }
      return;
    }

    if (state === "gameover") {
      if ((code === "Space" || code === "Enter") && !isButtonFocused()) {
        event.preventDefault();
        startRun();
      }
      return;
    }

    if (state === "paused") {
      if (code === "Space" || code === "Enter") {
        if (!isButtonFocused()) {
          event.preventDefault();
          resumeGame();
        }
      }
      return;
    }

    if (state !== "playing") return;

    if (code === "ArrowUp" || code === "KeyW" || code === "Space") {
      event.preventDefault();
      attemptMove(0, 1);
    } else if (code === "ArrowDown" || code === "KeyS") {
      event.preventDefault();
      attemptMove(0, -1);
    } else if (code === "ArrowLeft" || code === "KeyA") {
      event.preventDefault();
      attemptMove(-1, 0);
    } else if (code === "ArrowRight" || code === "KeyD") {
      event.preventDefault();
      attemptMove(1, 0);
    }
  }

  function isButtonFocused() {
    var active = document.activeElement;
    return !!(active && (active.tagName === "BUTTON" || active.tagName === "A" || active.tagName === "INPUT"));
  }

  function onPointerDown(event) {
    if (state !== "playing") return;
    if (event.button != null && event.button !== 0 && event.pointerType === "mouse") return;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now()
    };
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
    }
    event.preventDefault();
  }

  function onPointerUp(event) {
    if (!pointer || pointer.id !== event.pointerId) return;
    var dx = event.clientX - pointer.x;
    var dy = event.clientY - pointer.y;
    var elapsed = performance.now() - pointer.time;
    pointer = null;
    if (state !== "playing") return;

    var threshold = Math.max(18, Math.min(window.innerWidth, window.innerHeight) * 0.035);
    var absX = Math.abs(dx);
    var absY = Math.abs(dy);

    if (absX < threshold && absY < threshold) {
      if (elapsed < 520) attemptMove(0, 1);
      return;
    }

    if (absX > absY) {
      attemptMove(dx > 0 ? 1 : -1, 0);
    } else {
      attemptMove(0, dy < 0 ? 1 : -1);
    }
  }

  function onPointerCancel() {
    pointer = null;
  }

  /* ------------------------------------------------------------------------
     Camera + render
     ------------------------------------------------------------------------ */

  function updateCamera(dt, time) {
    if (!world) {
      return { x: 0, y: 8, z: -14, tx: 0, ty: 1, tz: 3 };
    }

    if (state === "menu") {
      var shortPortrait = renderer.h < 650 && renderer.w < renderer.h;
      var ox = 6.4 + Math.sin(time * 0.19) * 0.32;
      var oz = -11.7 + Math.cos(time * 0.16) * 0.28;
      return {
        x: ox,
        y: 6.0 + Math.sin(time * 0.23) * 0.12,
        z: oz,
        tx: -0.55 + Math.sin(time * 0.13) * 0.12,
        ty: shortPortrait ? -1.0 : -0.5,
        tz: 2.4
      };
    }

    var anchorX = world.player.x;
    var anchorZ = world.player.z;
    cam.x = CR.damp(cam.x, anchorX, 9, dt);
    cam.z = CR.damp(cam.z, anchorZ, 9, dt);

    var portrait = renderer.h > renderer.w * 1.05;
    var shortLandscape = renderer.w > renderer.h * 1.6 && renderer.h < 560;
    var baseX = portrait ? 3.8 : 4.2;
    var baseY = portrait ? 8.4 : 7.2;
    var baseZ = portrait ? -9.0 : -10.5;
    var lookX = portrait ? -2.2 : -1.2;
    var lookY = portrait ? 0.6 : 1.0;
    var lookZ = portrait ? 5.2 : 4.2;
    if (shortLandscape) {
      lookZ = 2.0;
    }

    var deathZoom = state === "dying"
      ? CR.clamp(deathTimer * 0.48, 0, 0.35)
      : state === "gameover" ? 0.35 : 0;
    var camX = cam.x + baseX - deathZoom * 0.8;
    var camY = baseY + deathZoom * 0.7;
    var camZ = cam.z + baseZ + deathZoom * 1.6;

    return {
      x: camX,
      y: camY,
      z: camZ,
      tx: cam.x + lookX,
      ty: lookY + deathZoom * 0.2,
      tz: cam.z + lookZ - deathZoom * 0.4
    };
  }

  function drawDebugOverlay(time) {
    if (!debugEnabled) return;
    var stats = world ? world.getStats() : { rows: 0, cars: 0, logs: 0, props: 0, particles: 0 };
    renderer.drawDebug([
      "FPS " + Math.round(fps) + "  " + renderer.w + "x" + renderer.h,
      "state " + state + "  score " + score + "  best " + CR.save.data.best,
      "rows " + stats.rows + "  cars " + stats.cars + "  logs " + stats.logs + "  props " + stats.props,
      "player " + (world ? world.player.x.toFixed(1) + ", " + world.player.z.toFixed(1) : "-") +
        "  particles " + stats.particles
    ]);
  }

  /* ------------------------------------------------------------------------
     Main loop
     ------------------------------------------------------------------------ */

  function tick(now) {
    var dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;

    if (state !== "paused") {
      gameTime += dt;
    }

    fpsAccum += dt;
    fpsFrames += 1;
    if (fpsAccum > 0.5) {
      fps = fpsFrames / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
    }

    if (world) {
      if (state === "menu" || state === "playing" || state === "dying") {
        world.update(dt, gameTime);
        drainEvents();
      } else if (state === "gameover") {
        world.updateEffects(dt);
      }
    }

    if (state === "dying") {
      deathTimer += dt;
      if (deathTimer >= 0.92) {
        showGameOverScreen();
      }
    }

    var camera = updateCamera(dt, gameTime);
    renderer.beginFrame();
    renderer.setCamera(camera);
    renderer.drawSky(gameTime);

    var shake = world ? world.shake : 0;
    var shakeX = 0;
    var shakeY = 0;
    if (!renderer.reducedMotion && shake > 0.01) {
      shakeX = (Math.sin(gameTime * 74) + Math.sin(gameTime * 47) * 0.6) * 9 * shake;
      shakeY = (Math.cos(gameTime * 81) + Math.sin(gameTime * 37) * 0.5) * 8 * shake;
    }

    renderer.beginWorld(shakeX, shakeY);
    if (world) world.render(renderer, gameTime);
    renderer.endWorld();
    renderer.drawHaze();
    renderer.drawVignette();
    drawDebugOverlay(gameTime);

    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------------
     Events / bootstrap
     ------------------------------------------------------------------------ */

  ui.playBtn.addEventListener("click", function () {
    sound.init();
    sound.click();
    startRun();
  });
  ui.pauseBtn.addEventListener("click", function () {
    sound.click();
    pauseGame();
  });
  ui.resumeBtn.addEventListener("click", function () {
    sound.click();
    resumeGame();
  });
  ui.pauseRestartBtn.addEventListener("click", function () {
    sound.click();
    startRun();
  });
  ui.pauseMenuBtn.addEventListener("click", function () {
    sound.click();
    showMenu();
  });
  ui.retryBtn.addEventListener("click", function () {
    sound.click();
    startRun();
  });
  ui.overMenuBtn.addEventListener("click", function () {
    sound.click();
    showMenu();
  });
  ui.menuSoundBtn.addEventListener("click", function () {
    sound.init();
    sound.toggleMuted();
    updateSoundUI();
    if (!sound.muted) sound.click();
    showToast(sound.muted ? "Звук выключен" : "Звук включён", 1300);
  });
  ui.pauseSoundBtn.addEventListener("click", function () {
    sound.init();
    sound.toggleMuted();
    updateSoundUI();
    if (!sound.muted) sound.click();
    showToast(sound.muted ? "Звук выключен" : "Звук включён", 1300);
  });

  window.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("contextmenu", function (event) { event.preventDefault(); });

  // Browsers require a user gesture before WebAudio can start.
  window.addEventListener("pointerdown", function () { sound.init(); }, { once: true });
  window.addEventListener("keydown", function () { sound.init(); }, { once: true });

  window.addEventListener("resize", function () {
    renderer.resize();
  });
  window.addEventListener("orientationchange", function () {
    window.setTimeout(function () { renderer.resize(); }, 120);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state === "playing") {
      pauseGame();
    }
  });

  window.addEventListener("blur", function () {
    if (state === "playing") pauseGame();
  });

  window.addEventListener("error", function (event) {
    console.error(event.error || event.message);
    if (ui.toast) {
      showToast("Ой! Что-то пошло не так. Обнови страницу.", 4500);
    }
  });

  updateSoundUI();
  updateHUD(false, false);
  renderSkinCards();
  freshMenuWorld();
  showMenu();

  // Debug / automated QA hook. Harmless in normal play.
  window.CRGame = {
    start: startRun,
    menu: showMenu,
    pause: pauseGame,
    resume: resumeGame,
    move: attemptMove,
    get state() { return state; },
    get score() { return score; },
    get world() { return world; },
    renderer: renderer,
    sound: sound,
    updateHUD: updateHUD,
    setDebug: function (value) { debugEnabled = !!value; }
  };
  window.__CR_READY__ = true;

  requestAnimationFrame(tick);
})(window.CR = window.CR || {});
