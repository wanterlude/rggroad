import { SKINS, SKIN_ORDER, type SkinId } from "./config";
import { drawPortrait } from "./Portraits";
import { GENERATED_ART } from "./assets/art";
import { save } from "./save";
import { fmt } from "./utils";
import type { DeathCause } from "./types";
import pkg from "../package.json";

interface UIHandlers {
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onSound: () => void;
  onSkin: (skin: SkinId) => void;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export class UI {
  readonly refs = {
    hud: $("hud"),
    menu: $("menu"),
    pause: $("pauseScreen"),
    gameover: $("gameoverScreen"),
    scoreValue: $("scoreValue"),
    bestValue: $("bestValue"),
    coinValue: $("coinValue"),
    scorePill: document.querySelector(".score-pill") as HTMLElement,
    coinPill: document.querySelector(".coin-pill") as HTMLElement,
    newBestBadge: $("newBestBadge"),
    tutorial: $("tutorial"),
    eagleWarning: $("eagleWarning"),
    eagleCountdown: $("eagleCountdown"),
    biomeFade: $("biomeFade"),
    menuBest: $("menuBest"),
    menuCoins: $("menuCoins"),
    skinRail: $("skinRail"),
    skinDock: $("skinDock"),
    skinPrev: $<HTMLButtonElement>("skinPrev"),
    skinNext: $<HTMLButtonElement>("skinNext"),
    artModal: $("artModal"),
    artModalImg: $<HTMLImageElement>("artModalImg"),
    artModalTitle: $("artModalTitle"),
    artModalClose: $<HTMLButtonElement>("artModalClose"),
    menuVersion: $("menuVersion"),
    menuSoundLabel: $("menuSoundLabel"),
    pauseSoundLabel: $("pauseSoundLabel"),
    menuSoundBtn: $<HTMLButtonElement>("menuSoundBtn"),
    pauseSoundBtn: $<HTMLButtonElement>("pauseSoundBtn"),
    playBtn: $<HTMLButtonElement>("playBtn"),
    pauseBtn: $<HTMLButtonElement>("pauseBtn"),
    resumeBtn: $<HTMLButtonElement>("resumeBtn"),
    pauseRestartBtn: $<HTMLButtonElement>("pauseRestartBtn"),
    pauseMenuBtn: $<HTMLButtonElement>("pauseMenuBtn"),
    retryBtn: $<HTMLButtonElement>("retryBtn"),
    overMenuBtn: $<HTMLButtonElement>("overMenuBtn"),
    overTitle: $("overTitle"),
    overMessage: $("overMessage"),
    finalScore: $("finalScore"),
    finalBest: $("finalBest"),
    runCoins: $("runCoins"),
    newBestRibbon: $("newBestRibbon"),
    toast: $("toast"),
    flash: $("flash")
  };

  private toastTimer = 0;
  private newBestTimer = 0;
  private wheelAccum = 0;
  private wheelIdleTimer = 0;
  private wheelIndex = -1;
  private tutorialUsed = false;
  private skinPointerId: number | null = null;
  private skinPointerStartX = 0;
  private skinPointerStartScroll = 0;
  private skinDragging = false;
  private suppressSkinClick = false;

  constructor(private handlers: UIHandlers) {
    const { refs } = this;
    refs.menuVersion.textContent = `v${pkg.version}`;
    refs.playBtn.addEventListener("click", () => handlers.onPlay());
    refs.pauseBtn.addEventListener("click", () => handlers.onPause());
    refs.resumeBtn.addEventListener("click", () => handlers.onResume());
    refs.pauseRestartBtn.addEventListener("click", () => handlers.onRestart());
    refs.pauseMenuBtn.addEventListener("click", () => handlers.onMenu());
    refs.retryBtn.addEventListener("click", () => handlers.onRestart());
    refs.overMenuBtn.addEventListener("click", () => handlers.onMenu());
    refs.menuSoundBtn.addEventListener("click", () => handlers.onSound());
    refs.pauseSoundBtn.addEventListener("click", () => handlers.onSound());
    refs.pauseSoundBtn.setAttribute("aria-pressed", "false");
    refs.skinPrev.addEventListener("click", () => this.scrollSkin(-1));
    window.addEventListener("resize", () => this.positionArtworkCard());
    refs.skinNext.addEventListener("click", () => this.scrollSkin(1));
    refs.skinRail.addEventListener("scroll", () => this.updateSkinNav());
    // Capture wheel events globally: the menu has no vertical scroll, so a
    // wheel over the hero dock always moves the rail horizontally.
    window.addEventListener("wheel", (event) => {
      const rail = refs.skinRail;
      if (rail.scrollWidth <= rail.clientWidth + 2) return;
      const rect = refs.skinDock.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) return;
      const delta = (Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX) *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rail.clientWidth : 1);
      if (!delta) return;
      event.preventDefault();
      event.stopPropagation();
      // Wheel up → right, wheel down → left, as requested. The wheel steps
      // through cards one at a time; high-resolution wheels send small deltas,
      // so those accumulate first instead of being snapped straight back.
      this.wheelAccum += delta;
      window.clearTimeout(this.wheelIdleTimer);
      this.wheelIdleTimer = window.setTimeout(() => {
        this.wheelAccum = 0;
        this.wheelIndex = -1;
      }, 500);
      if (Math.abs(this.wheelAccum) < 35) return;
      const direction = this.wheelAccum < 0 ? 1 : -1;
      this.wheelAccum = 0;
      this.stepSkin(direction);
    }, { passive: false, capture: true });
    // Mouse and touch drag scrolling, without accidentally opening a card.
    refs.skinRail.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const rail = refs.skinRail;
      if (rail.scrollWidth <= rail.clientWidth + 2) return;
      this.suppressSkinClick = false;
      this.wheelIndex = -1;
      this.wheelAccum = 0;
      this.skinPointerId = event.pointerId;
      this.skinPointerStartX = event.clientX;
      this.skinPointerStartScroll = rail.scrollLeft;
      this.skinDragging = false;
    });

    refs.skinRail.addEventListener("pointermove", (event) => {
      if (this.skinPointerId !== event.pointerId) return;
      const rail = refs.skinRail;
      const dx = event.clientX - this.skinPointerStartX;
      if (!this.skinDragging && Math.abs(dx) > 6) {
        this.skinDragging = true;
        rail.classList.add("is-dragging");
        try { rail.setPointerCapture(event.pointerId); } catch { /* pointer capture is optional */ }
      }
      if (!this.skinDragging) return;
      event.preventDefault();
      rail.scrollLeft = this.skinPointerStartScroll - dx;
      this.updateSkinNav();
    });

    const finishSkinDrag = (event: PointerEvent) => {
      if (this.skinPointerId !== event.pointerId) return;
      const rail = refs.skinRail;
      if (this.skinDragging) {
        this.suppressSkinClick = true;
        this.skinDragging = false;
        rail.classList.remove("is-dragging");
        window.setTimeout(() => { this.suppressSkinClick = false; }, 80);
      }
      this.skinPointerId = null;
    };
    refs.skinRail.addEventListener("pointerup", finishSkinDrag);
    refs.skinRail.addEventListener("pointercancel", finishSkinDrag);
    window.addEventListener("pointerup", finishSkinDrag);
    window.addEventListener("pointercancel", finishSkinDrag);
    refs.skinRail.addEventListener("click", (event) => {
      if (!this.suppressSkinClick) return;
      event.preventDefault();
      event.stopPropagation();
      this.suppressSkinClick = false;
    }, true);
    refs.artModalClose.addEventListener("click", () => this.closeArtwork());
    refs.artModal.addEventListener("click", (event) => {
      if (event.target === refs.artModal) this.closeArtwork();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && refs.artModal.classList.contains("is-open")) this.closeArtwork();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!refs.artModal.classList.contains("is-open")) return;
      const target = event.target as Node | null;
      if (target && refs.artModal.contains(target)) return;
      this.closeArtwork();
    }, true);

  }

  private setHidden(element: HTMLElement, hidden: boolean): void {
    element.classList.toggle("hidden", hidden);
  }

  showMenu(): void {
    this.setHidden(this.refs.menu, false);
    this.setHidden(this.refs.hud, true);
    this.setHidden(this.refs.eagleWarning, true);
    this.setHidden(this.refs.pause, true);
    this.setHidden(this.refs.gameover, true);
    this.setHidden(this.refs.newBestBadge, true);
    this.setHidden(this.refs.newBestRibbon, true);
    this.hideTutorial();
    this.updateStats();
    this.renderSkinCards();
  }

  showEagleWarning(seconds: number): void {
    if (seconds <= 0) {
      this.hideEagleWarning();
      return;
    }
    this.refs.eagleCountdown.textContent = String(seconds);
    this.setHidden(this.refs.eagleWarning, false);
  }

  hideEagleWarning(): void {
    this.setHidden(this.refs.eagleWarning, true);
  }

  fadeBiomeTransition(): void {
    const fade = this.refs.biomeFade;
    fade.classList.remove("is-active");
    void fade.offsetWidth;
    fade.classList.add("is-active");
  }

  showPlaying(): void {
    this.setHidden(this.refs.menu, true);
    this.setHidden(this.refs.hud, false);
    this.setHidden(this.refs.eagleWarning, true);
    this.setHidden(this.refs.pause, true);
    this.setHidden(this.refs.gameover, true);
    this.setHidden(this.refs.newBestBadge, true);
    this.setHidden(this.refs.newBestRibbon, true);
    this.resetTutorial();
  }

  showPause(): void {
    this.setHidden(this.refs.pause, false);
    this.hideEagleWarning();
    this.hideTutorial();
  }

  hidePause(): void {
    this.setHidden(this.refs.pause, true);
  }

  showGameOver(options: {
    cause: DeathCause;
    score: number;
    best: number;
    runCoins: number;
    isRecord: boolean;
  }): void {
    this.hideEagleWarning();
    const title =
      options.cause === "water"
        ? "БУЛЬ!"
        : options.cause === "train"
          ? "БАМ!"
          : options.cause === "eagle"
            ? "КАР-Р-Р!"
            : options.cause === "crocodile"
              ? "ХРУМ!"
              : "БУМ!";
    const message =
      options.cause === "water"
        ? "Бревно уплыло. В следующий раз прыгай точнее."
        : options.cause === "train"
          ? "Поезд не остановить. Дождись зелёного сигнала."
          : options.cause === "eagle"
            ? "Нельзя стоять на месте слишком долго — тебя унесёт."
            : options.cause === "crocodile"
              ? "Крокодил не любит, когда прыгают ему на голову."
              : "Машины не тормозят. Проверь оба ряда.";
    this.refs.overTitle.textContent = title;
    this.refs.overMessage.textContent = message;
    this.refs.finalScore.textContent = fmt(options.score);
    this.refs.finalBest.textContent = fmt(options.best);
    this.refs.runCoins.textContent = fmt(options.runCoins);
    this.setHidden(this.refs.newBestRibbon, !options.isRecord);
    this.setHidden(this.refs.gameover, false);
    this.setHidden(this.refs.hud, true);
    window.setTimeout(() => {
      if (this.refs.retryBtn) this.refs.retryBtn.focus({ preventScroll: true });
    }, 60);
  }

  updateHUD(score: number, animateScore = false, animateCoin = false): void {
    const { refs } = this;
    refs.scoreValue.textContent = fmt(score);
    refs.bestValue.textContent = fmt(Math.max(save.data.best, score));
    refs.coinValue.textContent = fmt(save.data.coins);
    refs.menuBest.textContent = fmt(save.data.best);
    refs.menuCoins.textContent = fmt(save.data.coins);
    if (animateScore) this.pop(refs.scorePill);
    if (animateCoin) this.pop(refs.coinPill);
  }

  updateStats(): void {
    this.refs.menuBest.textContent = fmt(save.data.best);
    this.refs.menuCoins.textContent = fmt(save.data.coins);
    this.refs.bestValue.textContent = fmt(save.data.best);
  }

  updateSoundUI(muted: boolean): void {
    const label = muted ? "ЗВУК ВЫКЛ" : "ЗВУК ВКЛ";
    this.refs.menuSoundLabel.textContent = label;
    this.refs.pauseSoundLabel.textContent = label;
    this.refs.menuSoundBtn.setAttribute("aria-pressed", String(muted));
    this.refs.pauseSoundBtn.setAttribute("aria-pressed", String(muted));
  }

  showNewBestBadge(): void {
    this.setHidden(this.refs.newBestBadge, false);
    window.clearTimeout(this.newBestTimer);
    this.newBestTimer = window.setTimeout(() => this.setHidden(this.refs.newBestBadge, true), 4200);
  }

  resetTutorial(): void {
    this.tutorialUsed = false;
    const tutorial = this.refs.tutorial;
    tutorial.classList.remove("is-used");
    tutorial.style.animation = "none";
    void tutorial.offsetWidth;
    tutorial.style.animation = "";
  }

  hideTutorial(): void {
    if (this.tutorialUsed) return;
    this.tutorialUsed = true;
    this.refs.tutorial.classList.add("is-used");
  }

  showToast(message: string, duration = 2300): void {
    const toast = this.refs.toast;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), duration);
  }

  flash(red: boolean): void {
    const flash = this.refs.flash;
    flash.classList.remove("is-on", "is-red");
    void flash.offsetWidth;
    if (red) flash.classList.add("is-red");
    flash.classList.add("is-on");
    window.setTimeout(() => flash.classList.remove("is-on", "is-red"), 540);
  }

  private pop(element: HTMLElement): void {
    element.classList.remove("pop");
    void element.offsetWidth;
    element.classList.add("pop");
    window.setTimeout(() => element.classList.remove("pop"), 330);
  }

  renderSkinCards(): void {
    const rail = this.refs.skinRail;
    rail.innerHTML = "";
    const selected = save.data.skin;

    for (const key of SKIN_ORDER) {
      const skin = SKINS[key];
      const unlocked = save.data.unlocked.includes(key);
      const isSelected = selected === key;
      const canBuy = !unlocked && save.data.coins >= skin.cost;

      const card = document.createElement("button");
      card.type = "button";
      card.className = "char-card";
      card.dataset.skin = key;
      card.setAttribute("aria-pressed", String(isSelected));
      card.setAttribute(
        "aria-label",
        `${skin.name}${isSelected ? ", выбран" : unlocked ? ", доступен" : `, стоит ${skin.cost} монет`}`
      );
      if (isSelected) card.classList.add("is-selected");
      if (!unlocked) card.classList.add("is-locked");
      if (canBuy) card.classList.add("can-buy");

      const art = document.createElement("span");
      art.className = "char-art";
      const preview = document.createElement("canvas");
      preview.width = 240;
      preview.height = 320;
      preview.setAttribute("aria-hidden", "true");
      art.appendChild(preview);

      const badge = document.createElement("span");
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

      const name = document.createElement("span");
      name.className = "char-name";
      name.textContent = skin.name;
      card.appendChild(name);

      const cost = document.createElement("span");
      cost.className = "char-cost";
      if (isSelected) cost.textContent = "ВЫБРАНО";
      else if (unlocked) cost.textContent = "ВЫБРАТЬ";
      else cost.innerHTML = `<span class="coin-icon" aria-hidden="true"></span><span>${skin.cost}</span>`;
      card.appendChild(cost);

      card.addEventListener("click", () => {
        this.handlers.onSkin(key);
        if (GENERATED_ART[key]) this.openArtwork(key);
      });
      rail.appendChild(card);
      drawPortrait(preview, key);
    }
    const selectedCard = rail.querySelector<HTMLElement>(".char-card.is-selected");
    if (selectedCard) {
      rail.scrollLeft = Math.max(0, selectedCard.offsetLeft - 2);
    }
    this.wheelIndex = -1;
    this.wheelAccum = 0;
    this.updateSkinNav();
    requestAnimationFrame(() => this.updateSkinNav());
  }

  scrollSkin(direction: number): void {
    const rail = this.refs.skinRail;
    this.wheelIndex = -1;
    rail.scrollBy({ left: direction * Math.max(rail.clientWidth * 0.78, 300), behavior: "smooth" });
    window.setTimeout(() => this.updateSkinNav(), 280);
  }

  /** Wheel step: move exactly one card in the requested direction. */
  private stepSkin(direction: number): void {
    const rail = this.refs.skinRail;
    const cards = Array.from(rail.querySelectorAll<HTMLElement>(".char-card"));
    if (cards.length === 0) return;
    if (this.wheelIndex < 0) {
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      cards.forEach((card, index) => {
        const dist = Math.abs(card.offsetLeft - 2 - rail.scrollLeft);
        if (dist < best) {
          best = dist;
          nearest = index;
        }
      });
      this.wheelIndex = nearest;
    }
    this.wheelIndex = Math.max(0, Math.min(cards.length - 1, this.wheelIndex + direction));
    const target = cards[this.wheelIndex];
    const max = rail.scrollWidth - rail.clientWidth;
    // Cards snap to the left edge, so their snap position is their offset
    // inside the rail. Centring early cards would clamp them all to 0 and the
    // wheel would appear stuck at the start of the list.
    const left = Math.max(0, Math.min(max, target.offsetLeft - 2));
    rail.scrollTo({ left, behavior: "smooth" });
    window.setTimeout(() => this.updateSkinNav(), 300);
  }

  updateSkinNav(): void {
    const { skinRail: rail, skinPrev, skinNext } = this.refs;
    const overflow = rail.scrollWidth > rail.clientWidth + 2;
    skinPrev.hidden = !overflow;
    skinNext.hidden = !overflow;
    if (!overflow) return;
    const max = rail.scrollWidth - rail.clientWidth;
    skinPrev.disabled = rail.scrollLeft <= 2;
    skinNext.disabled = rail.scrollLeft >= max - 2;
  }

  openArtwork(key: SkinId): void {
    const art = GENERATED_ART[key];
    if (!art) return;
    const { artModal, artModalImg, artModalTitle, artModalClose } = this.refs;
    artModalImg.src = art;
    artModalImg.alt = SKINS[key].name;
    artModalTitle.textContent = SKINS[key].name;
    artModal.classList.add("is-open");
    artModal.setAttribute("aria-hidden", "false");
    this.positionArtworkCard();
    artModalClose.focus();
  }

  private positionArtworkCard(): void {
    if (!this.refs.artModal.classList.contains("is-open")) return;
    const dockTop = this.refs.skinDock.getBoundingClientRect().top;
    const gap = 14;
    const topLimit = 54;
    const available = Math.max(190, dockTop - gap - topLimit);
    // Panel is ~4/3 of its width plus title + padding. Scale to the free space above the dock.
    const width = Math.max(190, Math.min(420, (available - 44) * 0.75));
    this.refs.artModal.style.setProperty("--art-card-width", `${Math.round(width)}px`);
    this.refs.artModal.style.setProperty("--art-card-bottom", `${Math.round(window.innerHeight - dockTop + gap)}px`);
  }

  closeArtwork(): void {
    const { artModal, artModalImg } = this.refs;
    artModal.classList.remove("is-open");
    artModal.setAttribute("aria-hidden", "true");
    artModalImg.src = "";
  }

  isButtonFocused(): boolean {
    const active = document.activeElement;
    return !!active && ["BUTTON", "A", "INPUT"].includes(active.tagName);
  }

  clearFocus(): void {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
}
