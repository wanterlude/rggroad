import { SKINS, SKIN_ORDER, type SkinId } from "./config";
import { drawPortrait } from "./Portraits";
import { GENERATED_ART } from "./assets/art";
import { save } from "./save";
import { SEASONS, type SeasonId } from "./season";
import { normalizeNickname, type LeaderboardState } from "./Leaderboard";
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
  onMusic: () => void;
  onMusicVolume: (value: number) => void;
  onSkin: (skin: SkinId) => void;
  onFavorite: (skin: SkinId) => void;
  onSeason: () => void;
  onLeaderboardRefresh: () => void;
  onLeaderboardName: (name: string) => void;
  onLeaderboardGuest: () => void;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export class UI {
  readonly refs = {
    hud: $("hud"),
    weather: $("weather"),
    night: $("night"),
    menu: $("menu"),
    pause: $("pauseScreen"),
    gameover: $("gameoverScreen"),
    scoreValue: $("scoreValue"),
    bestValue: $("bestValue"),
    coinValue: $("coinValue"),
    scorePill: document.querySelector(".score-pill") as HTMLElement,
    coinPill: document.querySelector(".coin-pill") as HTMLElement,
    newBestBadge: $("newBestBadge"),
    recordGap: $("recordGap"),
    milestone: $("milestone"),
    milestoneValue: $("milestoneValue"),
    runBiomes: $("runBiomes"),
    tutorial: $("tutorial"),
    eagleWarning: $("eagleWarning"),
    eagleCountdown: $("eagleCountdown"),
    biomeFade: $("biomeFade"),
    biomeBanner: $("biomeBanner"),
    biomeBannerTitle: $("biomeBannerTitle"),
    biomeBannerText: $("biomeBannerText"),
    menuBest: $("menuBest"),
    menuCoins: $("menuCoins"),
    seasonChip: $<HTMLButtonElement>("seasonChip"),
    seasonChipLabel: $("seasonChipLabel"),
    skinRail: $("skinRail"),
    skinDock: $("skinDock"),
    skinCount: $("skinCount"),
    skinScrollHint: $("skinScrollHint"),
    leaderboard: $("leaderboard"),
    leaderboardList: $("leaderboardList"),
    leaderboardStatus: $("leaderboardStatus"),
    leaderboardSelfName: $("leaderboardSelfName"),
    leaderboardSelfScore: $("leaderboardSelfScore"),
    leaderboardRefresh: $<HTMLButtonElement>("leaderboardRefresh"),
    leaderboardClose: $<HTMLButtonElement>("leaderboardClose"),
    leaderboardOpen: $<HTMLButtonElement>("leaderboardOpen"),
    leaderboardBackdrop: $("leaderboardBackdrop"),
    leaderboardNameBtn: $<HTMLButtonElement>("leaderboardNameBtn"),
    nicknameModal: $("nicknameModal"),
    nicknameForm: $<HTMLFormElement>("nicknameForm"),
    nicknameInput: $<HTMLInputElement>("nicknameInput"),
    nicknameError: $("nicknameError"),
    nicknameGuestBtn: $<HTMLButtonElement>("nicknameGuestBtn"),
    artModal: $("artModal"),
    artModalImg: $<HTMLImageElement>("artModalImg"),
    artModalTitle: $("artModalTitle"),
    artModalClose: $<HTMLButtonElement>("artModalClose"),
    menuVersion: $("menuVersion"),
    menuSoundLabel: $("menuSoundLabel"),
    pauseSoundLabel: $("pauseSoundLabel"),
    menuSoundBtn: $<HTMLButtonElement>("menuSoundBtn"),
    pauseSoundBtn: $<HTMLButtonElement>("pauseSoundBtn"),
    menuMusicLabel: $("menuMusicLabel"),
    pauseMusicLabel: $("pauseMusicLabel"),
    menuMusicBtn: $<HTMLButtonElement>("menuMusicBtn"),
    menuMusicVolume: $<HTMLInputElement>("menuMusicVolume"),
    menuMusicVolumeLabel: $("menuMusicVolumeLabel"),
    pauseMusicBtn: $<HTMLButtonElement>("pauseMusicBtn"),
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
  private biomeBannerTimer = 0;
  private milestoneTimer = 0;
  private tutorialUsed = false;
  private lastLeaderboard: LeaderboardState | null = null;
  private nicknameForced = false;

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
    refs.menuMusicBtn.addEventListener("click", () => handlers.onMusic());
    refs.menuMusicVolume.addEventListener("input", () => {
      handlers.onMusicVolume(Number(refs.menuMusicVolume.value) / 100);
      this.updateMusicVolumeUI(Number(refs.menuMusicVolume.value) / 100);
    });
    refs.pauseMusicBtn.addEventListener("click", () => handlers.onMusic());
    refs.seasonChip.addEventListener("click", () => handlers.onSeason());
    refs.leaderboardRefresh.addEventListener("click", () => handlers.onLeaderboardRefresh());
    refs.leaderboardClose.addEventListener("click", () => this.setLeaderboardOpen(false));
    refs.leaderboardOpen.addEventListener("click", () => this.setLeaderboardOpen(true));
    refs.leaderboardBackdrop.addEventListener("click", () => this.setLeaderboardOpen(false));
    refs.leaderboardNameBtn.addEventListener("click", () => this.openNickname(false));
    refs.nicknameForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submitNickname();
    });
    refs.nicknameGuestBtn.addEventListener("click", () => {
      handlers.onLeaderboardGuest();
      this.closeNickname(true);
    });
    refs.pauseSoundBtn.setAttribute("aria-pressed", "false");
    refs.pauseMusicBtn.setAttribute("aria-pressed", "false");
    window.addEventListener("resize", () => {
      this.positionArtworkCard();
      this.updateScrollHint();
    });
    refs.skinRail.addEventListener("scroll", () => this.updateScrollHint());
    refs.artModalClose.addEventListener("click", () => this.closeArtwork());
    refs.artModalImg.addEventListener("click", () => this.closeArtwork());
    refs.artModal.addEventListener("click", (event) => {
      if (event.target === refs.artModal) this.closeArtwork();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && refs.artModal.classList.contains("is-open")) this.closeArtwork();
      if (event.key === "Escape" && !refs.nicknameModal.classList.contains("hidden") && !this.nicknameForced) {
        this.closeNickname();
      }
      if (event.key === "Escape" && refs.leaderboard.classList.contains("is-open")) {
        this.setLeaderboardOpen(false);
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!refs.artModal.classList.contains("is-open")) return;
      const target = event.target as Node | null;
      if (target && refs.artModal.contains(target)) return;
      // Clicking the same hero again must reach the card's click handler and
      // close the artwork, instead of closing on pointerdown and reopening.
      if (target instanceof Element) {
        const card = target.closest<HTMLElement>(".char-card");
        if (card && card.dataset.skin === refs.artModal.dataset.skin) return;
      }
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
    this.hideBiomeBanner();
    this.hideMilestone();
    this.setWeather(false);
    this.setNight(false);
    this.setLeaderboardOpen(false);
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

  /** Big top-centre announcement with the biome name and its special rule. */
  showBiomeBanner(title: string, text: string): void {
    const { biomeBanner, biomeBannerTitle, biomeBannerText } = this.refs;
    biomeBannerTitle.textContent = title;
    biomeBannerText.textContent = text;
    biomeBanner.classList.add("is-visible");
    window.clearTimeout(this.biomeBannerTimer);
    this.biomeBannerTimer = window.setTimeout(() => this.hideBiomeBanner(), 4500);
  }

  hideBiomeBanner(): void {
    window.clearTimeout(this.biomeBannerTimer);
    this.refs.biomeBanner.classList.remove("is-visible");
  }

  /** Storm intermediates add a rain overlay above the world, below the HUD. */
  setWeather(storm: boolean): void {
    this.refs.weather.classList.toggle("is-storm", storm);
  }

  /** Elite cycles run at night: a dark blue veil over the world. */
  setNight(night: boolean): void {
    this.refs.night.classList.toggle("is-night", night);
  }

  /** Seasonal event toggle in the menu; always visible, cycles H → NY → off. */
  setSeason(season: SeasonId): void {
    const info = SEASONS[season];
    const chip = this.refs.seasonChip;
    chip.hidden = false;
    chip.dataset.season = season;
    chip.setAttribute(
      "aria-label",
      season === "none"
        ? "Сезонное событие выключено. Включить Хэллоуин"
        : `${info.label}. Переключить сезонное событие`
    );
    chip.title = season === "none" ? "Включить сезонное событие" : `Сейчас: ${info.label}`;
    this.refs.seasonChipLabel.textContent = info.label;
    document.documentElement.dataset.season = season;
  }

  /** Mobile opens the rating as a sheet; desktop keeps the top-left card. */
  setLeaderboardOpen(open: boolean): void {
    this.refs.leaderboard.classList.toggle("is-open", open);
    this.refs.leaderboardBackdrop.hidden = !open;
    this.refs.leaderboardOpen.setAttribute("aria-expanded", String(open));
    if (open) {
      window.setTimeout(() => {
        this.refs.leaderboardRefresh.focus({ preventScroll: true });
      }, 30);
    }
  }

  /** Ask for a nickname once after the first load, or on demand from the card. */
  askNickname(): void {
    if (!this.lastLeaderboard || this.lastLeaderboard.playerName) return;
    this.openNickname(true);
  }

  renderLeaderboard(state: LeaderboardState, selfBest: number): void {
    this.lastLeaderboard = state;
    const list = this.refs.leaderboardList;
    list.innerHTML = "";
    const top = state.entries.slice(0, 25);
    if (top.length > 0) {
      top.forEach((entry, index) => {
        const row = document.createElement("li");
        row.className = "leaderboard-row";
        if (
          entry.id === state.playerId ||
          entry.name.trim().toLocaleLowerCase("ru") === state.playerName.trim().toLocaleLowerCase("ru")
        ) {
          row.classList.add("is-self");
        }
        row.dataset.rank = String(index + 1);
        const rank = document.createElement("span");
        rank.className = "leaderboard-rank";
        rank.textContent = String(index + 1);
        const name = document.createElement("span");
        name.className = "leaderboard-name";
        name.textContent = entry.name;
        name.title = entry.name;
        const score = document.createElement("span");
        score.className = "leaderboard-score";
        score.textContent = fmt(entry.score);
        row.append(rank, name, score);
        list.appendChild(row);
      });
    } else {
      const empty = document.createElement("li");
      empty.className = "leaderboard-empty";
      empty.textContent =
        state.status === "loading"
          ? "ОБНОВЛЕНИЕ…"
          : state.status === "ready"
            ? "ПОКА НИКОГО НЕТ"
            : "";
      if (empty.textContent) list.appendChild(empty);
    }

    const status = this.refs.leaderboardStatus;
    if (state.status === "unconfigured") {
      status.textContent = "FIREBASE НЕ ПОДКЛЮЧЁН";
      status.dataset.state = "error";
    } else if (state.status === "offline") {
      status.textContent = state.error ?? "НЕТ СВЯЗИ";
      status.dataset.state = "error";
    } else if (state.status === "loading") {
      status.textContent = "ОБНОВЛЕНИЕ…";
      status.dataset.state = "loading";
    } else if (state.status === "ready") {
      status.textContent = "ТОП-5 · ОБНОВЛЕНО";
      status.dataset.state = "ready";
    } else {
      status.textContent = "";
      status.dataset.state = "";
    }

    this.refs.leaderboardSelfName.textContent = state.playerName || "—";
    this.refs.leaderboardSelfScore.textContent = fmt(Math.max(0, selfBest));
    this.refs.leaderboardNameBtn.textContent = state.playerName ? "СМЕНИТЬ НИК" : "ЗАДАТЬ НИК";
    if (this.refs.nicknameModal.classList.contains("hidden") && !state.playerName) {
      this.askNickname();
    }
  }

  private openNickname(force: boolean): void {
    const current = this.lastLeaderboard?.playerName ?? "";
    this.nicknameForced = force && !current;
    this.refs.nicknameInput.value = current;
    this.refs.nicknameError.textContent = "";
    this.refs.nicknameModal.classList.remove("hidden");
    this.refs.nicknameModal.setAttribute("aria-hidden", "false");
    window.setTimeout(() => {
      this.refs.nicknameInput.focus({ preventScroll: true });
      this.refs.nicknameInput.select();
    }, 40);
  }

  private closeNickname(force = false): void {
    if (this.nicknameForced && !force) return;
    this.nicknameForced = false;
    this.refs.nicknameModal.classList.add("hidden");
    this.refs.nicknameModal.setAttribute("aria-hidden", "true");
    this.refs.nicknameError.textContent = "";
  }

  private submitNickname(): void {
    const raw = this.refs.nicknameInput.value;
    const name = normalizeNickname(raw);
    if (!name) {
      this.refs.nicknameError.textContent =
        raw.trim().length < 2
          ? "Минимум 2 символа"
          : "Можно буквы, цифры, пробел, _ и - (до 16)";
      this.refs.nicknameInput.focus();
      return;
    }
    this.handlers.onLeaderboardName(name);
    this.closeNickname(true);
  }

  /** A 50-row milestone badge. */
  showMilestone(score: number): void {
    this.refs.milestoneValue.textContent = String(score);
    this.refs.milestone.classList.remove("is-visible");
    void this.refs.milestone.offsetWidth;
    this.refs.milestone.classList.add("is-visible");
    window.clearTimeout(this.milestoneTimer);
    this.milestoneTimer = window.setTimeout(
      () => this.refs.milestone.classList.remove("is-visible"),
      2300
    );
  }

  hideMilestone(): void {
    window.clearTimeout(this.milestoneTimer);
    this.refs.milestone.classList.remove("is-visible");
  }

  showPlaying(): void {
    this.setHidden(this.refs.menu, true);
    this.setHidden(this.refs.hud, false);
    this.setHidden(this.refs.eagleWarning, true);
    this.setHidden(this.refs.pause, true);
    this.setHidden(this.refs.gameover, true);
    this.setHidden(this.refs.newBestBadge, true);
    this.setHidden(this.refs.newBestRibbon, true);
    this.closeNickname(true);
    this.setLeaderboardOpen(false);
    this.resetTutorial();
    this.hideMilestone();
  }

  showPause(): void {
    this.setHidden(this.refs.pause, false);
    this.hideEagleWarning();
    this.hideBiomeBanner();
    this.hideMilestone();
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
    biomes: number;
    isRecord: boolean;
  }): void {
    this.hideEagleWarning();
    this.hideMilestone();
    const title =
      options.cause === "water"
        ? "БУЛЬ!"
        : options.cause === "train"
          ? "БАМ!"
          : options.cause === "eagle"
            ? "КАР-Р-Р!"
            : options.cause === "crocodile"
              ? "ХРУМ!"
              : options.cause === "geyser"
                ? "ПШШ!"
                : options.cause === "log"
                  ? "ХРЯСЬ!"
                  : options.cause === "tumble"
                    ? "ВЖУХ!"
                    : options.cause === "void"
                      ? "ПРОВАЛ!"
                      : options.cause === "ghost"
                        ? "ИСЧЕЗ!"
                        : options.cause === "coconut"
                          ? "БОМ!"
                          : options.cause === "beast"
                            ? "ТОП!"
                            : options.cause === "tide"
                              ? "ВОЛНА!"
                              : options.cause === "sink"
                                ? "ЗАСОСАЛО!"
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
              : options.cause === "geyser"
                ? "Гейзер не ждёт. Уходи с клетки, как только загорелось кольцо."
                : options.cause === "log"
                  ? "Бревно катится через лужайку. Пережди или отойди в сторону."
                  : options.cause === "tumble"
                    ? "Перекати-поле не сворачивает. Не стой на его пути."
                    : options.cause === "void"
                      ? "Плита треснула и провалилась. Не задерживайся на трещинах."
                      : options.cause === "ghost"
                        ? "Призрачная плита растворилась. Не стой на ней."
                        : options.cause === "coconut"
                          ? "Кокос свалился на голову. Тень растёт — уходи с клетки."
                          : options.cause === "beast"
                            ? "Стадо несётся через саванну. Пережди волну."
                            : options.cause === "tide"
                              ? "Прилив догнал. Не отставай — волна идёт следом."
                              : options.cause === "sink"
                                ? "Трясина затянула. Не задерживайся на пузырящейся грязи."
                                : "Машины не тормозят. Проверь оба ряда.";
    this.refs.overTitle.textContent = title;
    this.refs.overMessage.textContent = message;
    this.refs.finalScore.textContent = fmt(options.score);
    this.refs.finalBest.textContent = fmt(options.best);
    this.refs.runCoins.textContent = fmt(options.runCoins);
    this.refs.runBiomes.textContent = fmt(options.biomes);
    this.setHidden(this.refs.newBestRibbon, !options.isRecord);
    this.setHidden(this.refs.gameover, false);
    this.setHidden(this.refs.hud, true);
    this.hideBiomeBanner();
    window.setTimeout(() => {
      if (this.refs.retryBtn) this.refs.retryBtn.focus({ preventScroll: true });
    }, 60);
  }

  updateHUD(score: number, animateScore = false, animateCoin = false): void {
    const { refs } = this;
    const best = Math.max(save.data.best, score);
    refs.scoreValue.textContent = fmt(score);
    refs.bestValue.textContent = fmt(best);
    refs.coinValue.textContent = fmt(save.data.coins);
    refs.menuBest.textContent = fmt(save.data.best);
    refs.menuCoins.textContent = fmt(save.data.coins);
    if (best <= 0) {
      refs.recordGap.textContent = "ПЕРВЫЙ РЕКОРД";
      refs.recordGap.classList.remove("is-record");
    } else if (score >= best) {
      refs.recordGap.textContent = "РЕКОРД ПОБИТ!";
      refs.recordGap.classList.add("is-record");
    } else {
      refs.recordGap.textContent = `ДО РЕКОРДА ${Math.ceil(best - score)}`;
      refs.recordGap.classList.remove("is-record");
    }
    if (animateScore) this.pop(refs.scorePill);
    if (animateCoin) this.pop(refs.coinPill);
  }

  updateStats(): void {
    this.refs.menuBest.textContent = fmt(save.data.best);
    this.refs.menuCoins.textContent = fmt(save.data.coins);
    this.refs.bestValue.textContent = fmt(save.data.best);
  }

  updateSoundUI(muted: boolean, musicMuted: boolean, musicVolume = 0.05): void {
    const soundLabel = muted ? "ЗВУКИ ВЫКЛ" : "ЗВУКИ ВКЛ";
    const musicLabel = musicMuted ? "МУЗЫКА ВЫКЛ" : "МУЗЫКА ВКЛ";
    this.refs.menuSoundLabel.textContent = soundLabel;
    this.refs.pauseSoundLabel.textContent = soundLabel;
    this.refs.menuMusicLabel.textContent = musicLabel;
    this.refs.pauseMusicLabel.textContent = musicLabel;
    this.refs.menuSoundBtn.setAttribute("aria-pressed", String(muted));
    this.refs.pauseSoundBtn.setAttribute("aria-pressed", String(muted));
    this.refs.menuMusicBtn.setAttribute("aria-pressed", String(musicMuted));
    this.refs.pauseMusicBtn.setAttribute("aria-pressed", String(musicMuted));
    this.updateMusicVolumeUI(musicVolume);
  }

  updateMusicVolumeUI(value: number): void {
    const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
    this.refs.menuMusicVolume.value = String(percent);
    this.refs.menuMusicVolume.style.setProperty("--volume-fill", `${percent}%`);
    this.refs.menuMusicVolumeLabel.textContent = `${percent}%`;
    this.refs.menuMusicVolume.setAttribute("aria-valuetext", `${percent}%`);
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

  renderSkinCards(focusSkin?: SkinId): void {
    const rail = this.refs.skinRail;
    rail.innerHTML = "";
    const selected = save.data.skin;
    const favorites = new Set(save.data.favorites);

    // Newest favourite first, then the rest of the roster in its usual order.
    const order = [
      ...save.data.favorites.filter((id) => SKIN_ORDER.includes(id)),
      ...SKIN_ORDER.filter((id) => !favorites.has(id))
    ];
    this.refs.skinCount.textContent = String(order.length);

    for (const key of order) {
      const skin = SKINS[key];
      const unlocked = save.data.unlocked.includes(key);
      const isSelected = selected === key;
      const isFavorite = favorites.has(key);
      const canBuy = !unlocked && save.data.coins >= skin.cost;

      const card = document.createElement("div");
      card.className = "char-card";
      card.dataset.skin = key;
      if (isSelected) card.classList.add("is-selected");
      if (!unlocked) card.classList.add("is-locked");
      if (canBuy) card.classList.add("can-buy");

      const main = document.createElement("button");
      main.type = "button";
      main.className = "char-main";
      main.setAttribute("aria-pressed", String(isSelected));
      main.setAttribute(
        "aria-label",
        `${skin.name}${
          isSelected
            ? ", выбран"
            : unlocked
              ? ", доступен"
              : skin.cost > 0
                ? `, стоит ${skin.cost} монет`
                : ", бесплатный"
        }`
      );

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
      main.appendChild(art);

      const name = document.createElement("span");
      name.className = "char-name";
      name.textContent = skin.name;
      main.appendChild(name);

      const cost = document.createElement("span");
      cost.className = "char-cost";
      if (isSelected) cost.textContent = "ВЫБРАНО";
      else if (unlocked) cost.textContent = "ВЫБРАТЬ";
      else if (skin.cost === 0) cost.textContent = "БЕСПЛАТНО";
      else cost.innerHTML = `<span class="coin-icon" aria-hidden="true"></span><span>${skin.cost}</span>`;
      main.appendChild(cost);

      main.addEventListener("click", () => {
        this.handlers.onSkin(key);
        if (!GENERATED_ART[key]) return;
        const modal = this.refs.artModal;
        if (modal.classList.contains("is-open") && modal.dataset.skin === key) {
          this.closeArtwork();
        } else {
          this.openArtwork(key);
        }
      });
      card.appendChild(main);

      const favorite = document.createElement("button");
      favorite.type = "button";
      favorite.className = "char-fav";
      if (isFavorite) favorite.classList.add("is-fav");
      favorite.setAttribute("aria-pressed", String(isFavorite));
      favorite.setAttribute(
        "aria-label",
        isFavorite ? `Убрать ${skin.name} из избранного` : `Добавить ${skin.name} в избранное`
      );
      favorite.title = isFavorite ? "Убрать из избранного" : "В избранное";
      favorite.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';
      favorite.addEventListener("click", (event) => {
        event.stopPropagation();
        this.handlers.onFavorite(key);
      });
      card.appendChild(favorite);

      rail.appendChild(card);
      drawPortrait(preview, key);
    }

    const targetSkin = focusSkin ?? (favorites.size > 0 ? order[0] : selected);
    const focus = rail.querySelector<HTMLElement>(
      `.char-card[data-skin="${targetSkin}"]`
    );
    if (focus) {
      const railTop = rail.getBoundingClientRect().top;
      const cardTop = focus.getBoundingClientRect().top;
      const cardBottom = cardTop + focus.offsetHeight;
      if (cardTop < railTop || cardBottom > railTop + rail.clientHeight) {
        rail.scrollTop += cardTop - railTop - 4;
      }
    }
    requestAnimationFrame(() => this.updateScrollHint());
  }

  /** Show "ЛИСТАЙ ↓" only while the shelf has more rows below the fold. */
  private updateScrollHint(): void {
    const { skinRail: rail, skinScrollHint: hint } = this.refs;
    const max = rail.scrollHeight - rail.clientHeight;
    hint.hidden = max <= 2 || rail.scrollTop >= max - 2;
  }

  /** Scroll the shelf by one visible page; used by keyboard/QA helpers. */
  scrollSkin(direction: number): void {
    const rail = this.refs.skinRail;
    rail.scrollBy({ top: direction * rail.clientHeight, behavior: "smooth" });
  }

  openArtwork(key: SkinId): void {
    const art = GENERATED_ART[key];
    if (!art) return;
    const { artModal, artModalImg, artModalTitle, artModalClose } = this.refs;
    artModalImg.src = art;
    artModalImg.alt = SKINS[key].name;
    artModalTitle.textContent = SKINS[key].name;
    artModal.dataset.skin = key;
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
    delete artModal.dataset.skin;
    artModalImg.src = "";
  }

  isButtonFocused(): boolean {
    const active = document.activeElement;
    return !!active && ["BUTTON", "A", "INPUT"].includes(active.tagName);
  }

  /** True while the nickname dialog is open or a visible text field has focus. */
  isTextEntryActive(): boolean {
    if (!this.refs.nicknameModal.classList.contains("hidden")) return true;
    const active = document.activeElement;
    return (
      (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
      active.getClientRects().length > 0
    );
  }

  clearFocus(): void {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
}
