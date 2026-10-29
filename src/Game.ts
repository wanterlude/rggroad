import * as THREE from "three";
import { SKINS, type SkinId } from "./config";
import type { BiomeId } from "./biomes";
import { SceneView } from "./SceneView";
import { World } from "./World";
import { AudioEngine } from "./AudioEngine";
import { UI } from "./UI";
import { save } from "./save";
import type { GameEvent, GameState } from "./types";
import { clamp, damp } from "./utils";

const makeSeed = (): number => ((Date.now() & 0x7fffffff) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;

export interface GameBootOptions {
  seed?: number;
  row?: number;
  biome?: BiomeId;
  bot?: boolean;
  autostart?: boolean;
}

interface IsoCameraOverride {
  offX: number;
  offY: number;
  offZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  height: number;
}

export class Game {
  private readonly sceneView: SceneView;
  private readonly audio = new AudioEngine();
  private readonly ui: UI;
  private world: World;
  private state: GameState = "menu";
  private gameTime = 0;
  private lastFrame = performance.now();
  private score = 0;
  private startingBest = 0;
  private newBestShown = false;
  private deathTimer = 0;
  private deathData: Extract<GameEvent, { type: "death" }> | null = null;
  private demoDeathTimer = 0;
  private demoBiomeCursor = 0;
  private lastBiomeBoundary = 0;
  private lastBiomeId = "";
  private lastElite = false;
  private cameraSnap = true;
  private readonly camAnchor = new THREE.Vector3();
  private readonly envAnchor = new THREE.Vector3();
  private pointer: { id: number; x: number; y: number; time: number } | null = null;
  private debug = false;
  private isoOverride: IsoCameraOverride | null = null;
  private readonly boot: GameBootOptions;
  private debugRun = false;
  private readonly biomesVisited = new Set<string>();
  private runMilestone = 0;

  constructor(canvas: HTMLCanvasElement, boot: GameBootOptions = {}) {
    this.boot = boot;
    this.sceneView = new SceneView(canvas);
    this.ui = new UI({
      onPlay: () => this.startRun(),
      onPause: () => this.pause(),
      onResume: () => this.resume(),
      onRestart: () => this.startRun(),
      onMenu: () => this.goMenu(),
      onSound: () => this.toggleSound(),
      onMusic: () => this.toggleMusic(),
      onSkin: (skin) => this.selectSkin(skin),
      onFavorite: (skin) => this.toggleFavorite(skin)
    });

    this.world = this.createWorld(true);
    this.sceneView.setEnvironmentVisible(false);
    this.camAnchor.set(this.world.player.x, 0, this.world.player.z);
    this.cameraSnap = true;
    this.bindEvents();
    this.ui.updateSoundUI(this.audio.muted, this.audio.musicMuted);
    this.ui.showMenu();
    this.ui.updateHUD(0);
    this.updateCamera(0, 0);
    this.ui.renderSkinCards();
    this.lastFrame = performance.now();
    requestAnimationFrame(this.loop);

    // Biome lab: a debug URL starts the run immediately, straight at the row.
    if (boot.autostart || boot.biome !== undefined || boot.row !== undefined) {
      this.startRun();
    }
  }

  private createWorld(menu: boolean): World {
    const demoBiome = menu ? this.demoBiomeCursor++ : undefined;
    return new World(makeSeed(), {
      menu: false,
      demo: menu,
      demoBiome,
      skin: save.data.skin,
      sceneView: this.sceneView,
      seed: menu ? undefined : this.boot.seed,
      startZ: menu ? undefined : this.boot.row,
      forceBiome: menu ? undefined : this.boot.biome,
      bot: menu ? undefined : this.boot.bot
    });
  }

  private restartDemo(): void {
    this.world.dispose();
    this.world = this.createWorld(true);
    this.sceneView.setEnvironmentVisible(false);
    this.sceneView.particles.clear();
    this.camAnchor.set(this.world.player.x, 0, this.world.player.z);
    this.cameraSnap = true;
    this.demoDeathTimer = 0;
    this.pointer = null;
  }

  private startRun(): void {
    if (this.state === "playing" || this.state === "dying") return;
    this.audio.init();
    this.audio.setMusicDucked(false);
    this.audio.startRun();

    this.world.dispose();
    this.world = this.createWorld(false);
    this.sceneView.setEnvironmentVisible(false);
    this.sceneView.particles.clear();
    this.state = "playing";
    this.debugRun = this.world.isDebugRun();
    this.lastBiomeBoundary = this.world.getNextBiomeBoundary();
    this.lastBiomeId = this.world.getBiome().id;
    this.lastElite = this.world.getElite();
    this.ui.setNight(this.lastElite);
    this.score = this.world.getScore();
    this.biomesVisited.clear();
    this.biomesVisited.add(this.lastBiomeId);
    this.runMilestone = Math.floor(this.score / 50);
    this.startingBest = save.data.best;
    this.newBestShown = false;
    this.deathTimer = 0;
    this.demoDeathTimer = 0;
    this.deathData = null;
    this.cameraSnap = true;
    this.pointer = null;
    this.camAnchor.set(this.world.player.x, 0, this.world.player.z);
    this.ui.showPlaying();
    this.ui.updateHUD(this.score);
    this.ui.updateStats();
    this.ui.updateSoundUI(this.audio.muted, this.audio.musicMuted);
    this.announceBiome();
    this.ui.clearFocus();
  }

  private announceBiome(): void {
    const biome = this.world.getBiome();
    const elite = this.world.getElite();
    this.ui.setWeather(biome.mechanics?.storm === true);
    this.ui.showBiomeBanner(elite ? `${biome.name} · НОЧЬ` : biome.name, biome.description ?? "");
  }

  private goMenu(): void {
    this.audio.setMusicDucked(false);
    this.world.dispose();
    this.world = this.createWorld(true);
    this.sceneView.setEnvironmentVisible(false);
    this.sceneView.particles.clear();
    this.state = "menu";
    this.score = 0;
    this.deathTimer = 0;
    this.demoDeathTimer = 0;
    this.deathData = null;
    this.cameraSnap = true;
    this.camAnchor.set(this.world.player.x, 0, this.world.player.z);
    this.pointer = null;
    this.ui.showMenu();
    this.ui.updateHUD(0);
    this.ui.updateStats();
    this.ui.updateSoundUI(this.audio.muted, this.audio.musicMuted);
    this.ui.clearFocus();
  }

  private pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.audio.setMusicDucked(true);
    this.ui.showPause();
    window.setTimeout(() => {
      const resume = document.getElementById("resumeBtn");
      if (resume) resume.focus({ preventScroll: true });
    }, 20);
  }

  private resume(): void {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.audio.setMusicDucked(false);
    this.ui.hidePause();
    this.ui.clearFocus();
  }

  private toggleSound(): void {
    this.audio.init();
    this.audio.toggleMuted();
    this.ui.updateSoundUI(this.audio.muted, this.audio.musicMuted);
    if (!this.audio.muted) this.audio.click();
    this.ui.showToast(this.audio.muted ? "Звуки выключены" : "Звуки включены", 1300);
  }

  private toggleMusic(): void {
    this.audio.init();
    this.audio.toggleMusicMuted();
    this.ui.updateSoundUI(this.audio.muted, this.audio.musicMuted);
    if (!this.audio.muted) this.audio.click();
    this.ui.showToast(this.audio.musicMuted ? "Музыка выключена" : "Музыка включена", 1300);
  }

  private selectSkin(skinId: SkinId): void {
    const skin = SKINS[skinId];
    if (!skin) return;
    if (save.data.unlocked.includes(skinId)) {
      if (save.data.skin === skinId) {
        this.audio.click();
        return;
      }
      save.data.skin = skinId;
      save.write();
      this.audio.click();
      if (this.state === "menu") {
        this.world.setSkin(skinId);
      }
      this.ui.renderSkinCards(skinId);
      return;
    }

    if (save.data.coins < skin.cost) {
      this.audio.bump();
      this.ui.showToast(`Не хватает ${skin.cost - save.data.coins} монет. Собери их в забеге!`);
      return;
    }

    if (save.unlock(skinId)) {
      this.audio.unlock();
      if (this.state === "menu") this.world.setSkin(skinId);
      this.ui.updateHUD(this.score);
      this.ui.renderSkinCards(skinId);
      this.ui.showToast(`${skin.name} открыт! Отличный выбор.`);
    }
  }

  /** Pin a hero to the front of the picker; toggling is instant and saved. */
  private toggleFavorite(skinId: SkinId): void {
    const favorites = save.data.favorites;
    const index = favorites.indexOf(skinId);
    if (index >= 0) favorites.splice(index, 1);
    else favorites.unshift(skinId);
    save.write();
    this.audio.click();
    this.ui.renderSkinCards(skinId);
  }

  private bindEvents(): void {
    window.addEventListener("keydown", this.onKeyDown);
    const canvas = this.sceneView.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", () => {
      this.pointer = null;
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("resize", this.onResize);
    window.addEventListener("orientationchange", () => {
      window.setTimeout(() => this.onResize(), 100);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "playing") this.pause();
    });
    window.addEventListener("blur", () => {
      if (this.state === "playing") this.pause();
    });
    window.addEventListener("pointerdown", () => this.audio.init(), { once: true });
    window.addEventListener("keydown", () => this.audio.init(), { once: true });
  }

  private onResize = (): void => {
    this.sceneView.resize();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const code = event.code;
    if (code === "KeyM") {
      event.preventDefault();
      this.toggleSound();
      return;
    }
    if (code === "Escape" || code === "KeyP") {
      event.preventDefault();
      if (this.state === "playing") this.pause();
      else if (this.state === "paused") this.resume();
      else if (this.state === "gameover") this.goMenu();
      return;
    }
    if (this.state === "menu") {
      return;
    }
    if (this.state === "gameover") {
      if ((code === "Space" || code === "Enter") && !this.ui.isButtonFocused()) {
        event.preventDefault();
        this.startRun();
      }
      return;
    }
    if (this.state === "paused") {
      if ((code === "Space" || code === "Enter") && !this.ui.isButtonFocused()) {
        event.preventDefault();
        this.resume();
      }
      return;
    }
    if (this.state !== "playing") return;

    let dx = 0;
    let dz = 0;
    if (code === "ArrowUp" || code === "KeyW" || code === "Space") dz = 1;
    else if (code === "ArrowDown" || code === "KeyS") dz = -1;
    // On screen, world +x points left (the camera looks along -x/+z), so the
    // left key has to add +x and the right key has to subtract it.
    else if (code === "ArrowLeft" || code === "KeyA") dx = 1;
    else if (code === "ArrowRight" || code === "KeyD") dx = -1;
    if (dx === 0 && dz === 0) return;
    event.preventDefault();
    if (event.repeat) return;
    this.ui.hideTutorial();
    this.world.tryMove(dx, dz);
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (this.state !== "playing") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    if (this.sceneView.renderer.domElement.setPointerCapture) {
      try {
        this.sceneView.renderer.domElement.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
    event.preventDefault();
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    const dx = event.clientX - this.pointer.x;
    const dy = event.clientY - this.pointer.y;
    const elapsed = performance.now() - this.pointer.time;
    this.pointer = null;
    if (this.state !== "playing") return;
    const threshold = Math.max(18, Math.min(window.innerWidth, window.innerHeight) * 0.035);
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    let moveX = 0;
    let moveZ = 0;
    if (absX < threshold && absY < threshold) {
      if (elapsed < 520) moveZ = 1;
    } else if (absX > absY) {
      // Swipe right must move the player to the screen-right, i.e. toward -x.
      moveX = dx > 0 ? -1 : 1;
    } else {
      moveZ = dy < 0 ? 1 : -1;
    }
    if (moveX === 0 && moveZ === 0) return;
    this.ui.hideTutorial();
    this.world.tryMove(moveX, moveZ);
  };

  private drainEvents(): void {
    if (this.world.events.length === 0) return;
    const events = this.world.events.splice(0, this.world.events.length);
    for (const event of events) {
      if (event.type === "hop") {
        this.audio.hop();
        this.ui.hideTutorial();
      } else if (event.type === "land") {
        this.audio.land();
      } else if (event.type === "bump") {
        this.audio.bump();
      } else if (event.type === "coin") {
        if (!this.debugRun) {
          save.data.coins += event.amount;
          save.write();
        }
        this.audio.coin();
        this.ui.updateHUD(this.score, false, true);
        if (event.amount > 1) this.ui.showToast(`+${event.amount} монеты!`);
      } else if (event.type === "score") {
        this.score = event.score;
        this.ui.updateHUD(this.score, true);
        const milestone = Math.floor(this.score / 50);
        if (milestone > this.runMilestone) {
          this.runMilestone = milestone;
          this.ui.showMilestone(milestone * 50);
          this.audio.milestone();
        }
        if (!this.debugRun && this.score > save.data.best) {
          save.data.best = this.score;
          save.write();
          if (!this.newBestShown && this.score > this.startingBest) {
            this.newBestShown = true;
            this.ui.showNewBestBadge();
            this.audio.newBest();
          }
        }
      } else if (event.type === "horn") {
        this.audio.trainHorn(event.volume);
      } else if (event.type === "geyser") {
        this.audio.geyser(event.volume);
      } else if (event.type === "tide") {
        this.audio.tide();
        this.ui.showToast("ПРИЛИВ! Волна идёт следом", 1800);
      } else if (event.type === "eagle-warning") {
        this.ui.showEagleWarning(event.seconds);
        if (event.seconds > 0) this.audio.warning();
      } else if (event.type === "death") {
        this.handleDeath(event);
      }
    }
  }

  private handleDeath(event: Extract<GameEvent, { type: "death" }>): void {
    if (this.state !== "playing") return;
    this.state = "dying";
    this.deathTimer = 0;
    this.deathData = event;
    this.score = event.score;
    this.ui.hideTutorial();
    this.ui.hideEagleWarning();
    this.ui.flash(event.cause !== "water");
    this.ui.updateHUD(this.score);
    this.pointer = null;

    if (event.cause === "water" || event.cause === "crocodile" || event.cause === "tide") {
      this.audio.splash();
      this.audio.deathTone();
    } else if (event.cause === "eagle") {
      this.audio.crash();
      this.audio.deathTone();
    } else if (event.cause === "geyser") {
      this.audio.crash();
      this.audio.deathTone();
    } else if (event.cause === "log" || event.cause === "tumble") {
      this.audio.crash();
      this.audio.deathTone();
    } else if (event.cause === "coconut" || event.cause === "beast") {
      this.audio.crash();
      this.audio.deathTone();
    } else if (event.cause === "void" || event.cause === "ghost") {
      this.audio.crash();
      this.audio.deathTone();
    } else {
      this.audio.crash();
    }

    if (!this.debugRun && this.score > save.data.best) {
      save.data.best = this.score;
    }
    if (!this.debugRun) {
      save.data.runs += 1;
    }
    save.write();
  }

  private finishDeath(): void {
    if (!this.deathData) return;
    this.state = "gameover";
    this.audio.setMusicDucked(true);
    const isRecord = this.deathData.score > this.startingBest && this.deathData.score > 0;
    this.ui.showGameOver({
      cause: this.deathData.cause,
      score: this.deathData.score,
      best: save.data.best,
      runCoins: this.deathData.coins,
      biomes: this.biomesVisited.size,
      isRecord
    });
  }

  private updateCamera(dt: number, time: number): void {
    const player = this.world.player;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const portrait = height > width * 1.05;
    const shortLandscape = height < 680 && width > height;

    if (this.state === "menu") {
      // Live demo framing: the menu is the actual game, played by the bot.
      this.sceneView.setOrthoHeight(portrait ? 16 : shortLandscape ? 13.5 : 13.5);
      if (this.cameraSnap) {
        this.camAnchor.set(player.x, 0, player.z);
        this.cameraSnap = false;
      } else {
        this.camAnchor.x = damp(this.camAnchor.x, player.x, 7.5, dt);
        this.camAnchor.z = damp(this.camAnchor.z, player.z, 7.5, dt);
      }
      const offX = 8.5;
      const offY = 13.4;
      const offZ = -10.5;
      const lookZ = 1.2;
      const lookX = offX - (offX * (lookZ - offZ)) / -offZ;
      const camera = this.sceneView.isoCamera;
      camera.position.set(this.camAnchor.x + offX, offY, this.camAnchor.z + offZ);
      camera.lookAt(this.camAnchor.x + lookX, 0, this.camAnchor.z + lookZ);
      return;
    }

    const iso = this.isoOverride;
    const isoHeight = iso?.height ?? (portrait ? 14.5 : shortLandscape ? 11.5 : 11.5);
    const offX = iso?.offX ?? 8.5;
    const offY = iso?.offY ?? 13.4;
    const offZ = iso?.offZ ?? -10.5;
    const lookZ = iso?.lookZ ?? (portrait ? 6.0 : 5.0);
    // Aim the camera so the player projects to the horizontal centre while
    // keeping the rows diagonal.
    const lookX = iso?.lookX ?? offX - (offX * (lookZ - offZ)) / -offZ;
    const lookY = iso?.lookY ?? 0;

    this.sceneView.setOrthoHeight(isoHeight);

    if (this.cameraSnap) {
      this.camAnchor.set(player.x, 0, player.z);
      this.cameraSnap = false;
    } else {
      this.camAnchor.x = damp(this.camAnchor.x, player.x, 8.5, dt);
      this.camAnchor.z = damp(this.camAnchor.z, player.z, 8.5, dt);
    }

    const shake = this.world?.getShake() ?? 0;
    const shakeX = shake > 0.01 ? (Math.sin(time * 73) + Math.sin(time * 41) * 0.6) * 0.16 * shake : 0;
    const shakeY = shake > 0.01 ? (Math.cos(time * 67) + Math.sin(time * 39) * 0.5) * 0.12 * shake : 0;
    const camera = this.sceneView.isoCamera;
    camera.position.set(this.camAnchor.x + offX + shakeX, offY + shakeY, this.camAnchor.z + offZ);
    camera.lookAt(this.camAnchor.x + lookX + shakeX * 0.25, lookY + shakeY * 0.25, this.camAnchor.z + lookZ);
  }

  private loop = (now: number): void => {
    const dt = clamp((now - this.lastFrame) / 1000, 0, 0.05);
    this.lastFrame = now;
    if (this.state !== "paused") this.gameTime += dt;

    if (this.state === "menu" || this.state === "playing" || this.state === "dying") {
      this.world.update(dt, this.gameTime);
      if (this.state === "menu") {
        this.world.events.length = 0;
      } else {
        this.drainEvents();
      }
      this.sceneView.particles.update(dt);
    } else if (this.state === "gameover") {
      this.sceneView.particles.update(dt);
    }

    if (this.state === "dying") {
      this.deathTimer += dt;
      if (this.deathTimer >= 0.95) this.finishDeath();
    }

    if (this.state === "menu") {
      if (this.world.player.dead) {
        this.demoDeathTimer += dt;
        if (this.demoDeathTimer >= 1.15) this.restartDemo();
      } else {
        this.demoDeathTimer = 0;
      }
    }

    if (this.state === "playing" || this.state === "dying") {
      const boundary = this.world.getNextBiomeBoundary();
      if (boundary !== this.lastBiomeBoundary && this.world.player.z >= boundary - 1) {
        this.lastBiomeBoundary = boundary;
        this.ui.fadeBiomeTransition();
      }
      const biomeId = this.world.getBiome().id;
      const elite = this.world.getElite();
      const eliteChanged = elite !== this.lastElite;
      if (eliteChanged) {
        this.lastElite = elite;
        this.ui.setNight(elite);
      }
      if (biomeId !== this.lastBiomeId) {
        this.lastBiomeId = biomeId;
        this.biomesVisited.add(biomeId);
        this.ui.fadeBiomeTransition();
        this.announceBiome();
      } else if (eliteChanged) {
        this.ui.fadeBiomeTransition();
        this.announceBiome();
      }
    }

    this.envAnchor.set(this.world.player.x, 0, this.world.player.z);
    this.updateCamera(dt, this.gameTime);
    const activeCamera = this.getActiveCamera();
    this.sceneView.updateEnvironment(this.gameTime, this.envAnchor, activeCamera);
    this.sceneView.render(activeCamera);

    if (this.debug) {
      this.renderDebug();
    }
    requestAnimationFrame(this.loop);
  };

  private renderDebug(): void {
    const stats = this.world.getStats();
    const info = document.getElementById("debugInfo");
    if (info) {
      info.textContent = `state ${this.state} · rows ${stats.rows} · cars ${stats.cars} · logs ${stats.logs} · props ${stats.props} · score ${this.score}`;
    }
  }

  setDebug(value: boolean): void {
    this.debug = value;
    if (value) {
      let el = document.getElementById("debugInfo");
      if (!el) {
        el = document.createElement("div");
        el.id = "debugInfo";
        el.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99;font:11px monospace;color:#d6ffe8;background:rgba(10,30,32,.55);padding:5px 8px;border-radius:6px;pointer-events:none";
        document.body.appendChild(el);
      }
      el.style.display = "block";
    }
  }

  getActiveCamera(): THREE.Camera {
    return this.sceneView.isoCamera;
  }

  setIsoOverride(value: IsoCameraOverride | null): void {
    this.isoOverride = value;
  }

  getState(): GameState {
    return this.state;
  }

  getWorld(): World {
    return this.world;
  }

  getUI(): UI {
    return this.ui;
  }

  getSceneView(): SceneView {
    return this.sceneView;
  }

  getAudio(): AudioEngine {
    return this.audio;
  }

  getScore(): number {
    return this.score;
  }

  start(): void {
    this.startRun();
  }

  menu(): void {
    this.goMenu();
  }

  pauseGame(): void {
    this.pause();
  }

  resumeGame(): void {
    this.resume();
  }

  /** Debug helper for deterministic automated inspection. */
  projectPlayer(): { x: number; y: number } | null {
    const p = this.world.player;
    const v = new THREE.Vector3(p.x, p.surfaceY + p.y + 0.6, p.z).project(this.getActiveCamera());
    if (v.z < -1 || v.z > 1) return null;
    return {
      x: Math.round((v.x * 0.5 + 0.5) * window.innerWidth),
      y: Math.round((-v.y * 0.5 + 0.5) * window.innerHeight)
    };
  }
}
