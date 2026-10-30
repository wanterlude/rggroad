import { clamp } from "./utils";
import { save } from "./save";
import type { BiomeId } from "./biomes";
import { MENU_THEME } from "./assets/music/menuTheme";
import { BIOME_TRACK_IDS } from "./music/tracks";

type Bus = "sfx" | "music";

const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * One short procedural theme per biome. The melody is written as scale
 * degrees so every world gets its own colour without shipping audio files:
 * minor pentatonic for the darker places, major pentatonic for the calm ones,
 * whole-tone for space and void. All themes share the same 16-step grid so a
 * biome change lands on a phrase boundary instead of cutting a note.
 */
interface MusicTheme {
  root: number;
  scale: number[];
  melody: number[];
  bass: number[];
  step: number;
  wave: OscillatorType;
  leadVolume: number;
  bassVolume: number;
  shaker: boolean;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PENTA = [0, 2, 4, 7, 9];
const MINOR_PENTA = [0, 3, 5, 7, 10];
const WHOLE = [0, 2, 4, 6, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

const theme = (
  root: number,
  scale: number[],
  melody: number[],
  bass: number[],
  step: number,
  wave: OscillatorType,
  leadVolume: number,
  bassVolume: number,
  shaker = false
): MusicTheme => ({ root, scale, melody, bass, step, wave, leadVolume, bassVolume, shaker });

const MUSIC_THEMES: Record<BiomeId, MusicTheme> = {
  autumn: theme(50, PENTA, [0, 2, 4, 2, 5, 4, 2, 0, 4, 5, 7, 5, 4, 2, 0, -1], [0, -5, 3, -2], 0.176, "triangle", 0.036, 0.03, true),
  forest: theme(48, PENTA, [0, 4, 2, 4, 5, 7, 5, 2, 0, 2, 4, 5, 4, 2, 0, -1], [0, 3, 5, -2], 0.19, "sine", 0.034, 0.032, true),
  desert: theme(45, PHRYGIAN, [0, 1, 4, 1, 5, 4, 1, 0, 4, 5, 1, 4, 0, 1, -1, -1], [0, 1, -2, 4], 0.185, "sawtooth", 0.024, 0.028, true),
  ocean: theme(45, MAJOR, [0, 4, 7, 5, 4, 2, 4, 0, 5, 7, 9, 7, 4, 2, 0, -1], [0, 5, 3, -2], 0.205, "sine", 0.033, 0.034, false),
  frost: theme(52, MINOR_PENTA, [0, 3, 5, 7, 5, 3, 0, -1, 7, 5, 3, 5, 7, 10, 7, -1], [0, -2, 3, -5], 0.2, "sine", 0.03, 0.028, false),
  lava: theme(38, MINOR, [0, 3, 5, 3, 6, 5, 3, 0, 5, 6, 8, 6, 5, 3, 0, -1], [0, 3, -2, 5], 0.162, "sawtooth", 0.026, 0.034, true),
  void: theme(45, WHOLE, [0, 2, 4, 2, 6, 4, 2, -1, 4, 6, 8, 6, 4, 2, -1, -1], [0, -3, 2, -5], 0.215, "sine", 0.031, 0.03, false),
  savanna: theme(43, PENTA, [0, 2, 4, 5, 4, 2, 0, -1, 5, 4, 7, 5, 4, 2, 0, -1], [0, 5, -2, 3], 0.178, "triangle", 0.034, 0.03, true),
  jungle: theme(45, MINOR_PENTA, [0, 3, 5, 7, 5, 3, 0, 3, 7, 10, 7, 5, 3, 5, 0, -1], [0, 3, 5, -2], 0.158, "triangle", 0.033, 0.031, true),
  city: theme(48, MINOR, [0, 3, 5, 7, 5, 3, 5, 0, 7, 8, 5, 3, 0, 3, -1, -1], [0, 5, -2, 3], 0.152, "square", 0.021, 0.032, true),
  space: theme(50, WHOLE, [0, 4, 2, 6, 4, 8, 6, 2, 0, 2, 4, 6, 8, 10, 6, -1], [0, -2, 4, -4], 0.225, "sine", 0.03, 0.026, false),
  candy: theme(52, MAJOR, [0, 4, 7, 9, 7, 4, 2, 4, 9, 7, 4, 2, 0, 4, 7, -1], [0, 5, 3, -2], 0.15, "triangle", 0.035, 0.028, true),
  prehistoric: theme(41, MINOR_PENTA, [0, 3, 5, 3, 0, 5, 7, 5, 3, 0, -1, 3, 5, 7, 0, -1], [0, 3, -2, 5], 0.172, "sawtooth", 0.023, 0.033, true),
  halloween: theme(43, MINOR, [0, 1, 3, 1, 6, 3, 1, 0, 3, 6, 1, 3, 0, -1, -1, -1], [0, 1, -2, 6], 0.19, "triangle", 0.03, 0.03, false),
  swamp: theme(43, MINOR_PENTA, [0, 3, 5, 3, 0, -1, 5, 7, 5, 3, 0, 3, 5, -1, 0, -1], [0, -2, 3, -5], 0.2, "sine", 0.031, 0.032, false),
  ashlands: theme(41, PHRYGIAN, [0, 1, 4, 1, 5, 4, 1, 0, 4, 5, 1, 4, 0, -1, -1, -1], [0, 3, -2, 4], 0.17, "sawtooth", 0.023, 0.031, true),
  storm: theme(45, MINOR, [0, 3, 5, 3, 7, 5, 3, 0, 5, 7, 8, 7, 5, 3, 0, -1], [0, 3, 5, 3], 0.148, "sawtooth", 0.022, 0.03, true),
  flood: theme(48, MAJOR, [0, 4, 2, 4, 7, 4, 2, 0, 5, 7, 4, 2, 0, 4, -1, -1], [0, 5, -2, 3], 0.2, "sine", 0.031, 0.032, false),
  crossroads: theme(46, PHRYGIAN, [0, 1, 3, 5, 3, 1, 0, -1, 5, 3, 1, 0, 3, 5, 0, -1], [0, 3, -2, 1], 0.16, "triangle", 0.029, 0.031, true)
};

const DEFAULT_THEME = MUSIC_THEMES.autumn;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private menuGain: GainNode | null = null;
  private biomeGain: GainNode | null = null;
  private menuBuffer: AudioBuffer | null = null;
  private menuSource: AudioBufferSourceNode | null = null;
  private menuSourceGain: GainNode | null = null;
  private biomeSource: AudioBufferSourceNode | null = null;
  private biomeSourceGain: GainNode | null = null;
  private biomeBuffer: BiomeId | null = null;
  private trackCache = new Map<BiomeId, AudioBuffer>();
  private trackRequests = new Map<BiomeId, Promise<AudioBuffer | null>>();
  private trackBytes = new Map<BiomeId, ArrayBuffer>();
  private trackByteRequests = new Map<BiomeId, Promise<ArrayBuffer | null>>();
  private decodedOrder: BiomeId[] = [];
  private trackToken = 0;
  private preloading = false;
  private menuMode = true;
  private menuLoading = false;
  private musicDucked = false;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  private ready = false;
  private musicTheme: MusicTheme = DEFAULT_THEME;
  private currentBiome: BiomeId = "autumn";
  muted = save.data.muted;
  musicMuted = save.data.musicMuted;
  musicVolume = save.data.musicVolume;

  init(): boolean {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return true;
    }

    try {
      const ctx = new Ctor();
      this.ctx = ctx;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.24;
      compressor.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.gain.value = 0.82;
      this.master.connect(compressor);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = this.muted ? 0 : 0.9;
      this.sfxGain.connect(this.master);

      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.musicMuted ? 0 : 0.42 * this.musicVolume;
      this.musicGain.connect(this.master);

      this.menuGain = ctx.createGain();
      this.menuGain.gain.value = this.musicMuted ? 0 : this.musicVolume;
      this.menuGain.connect(this.master);

      this.biomeGain = ctx.createGain();
      this.biomeGain.gain.value = this.musicMuted ? 0 : this.musicVolume;
      this.biomeGain.connect(this.master);

      this.noiseBuffer = this.makeNoise(ctx);
      this.ready = true;
      void this.loadBiomeBytes("autumn");
      this.loadMenuTheme();
      if (ctx.state === "suspended") void ctx.resume();
      return true;
    } catch {
      this.ready = false;
      return false;
    }
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1337;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    return buffer;
  }

  /** Mute only gameplay SFX; the music keeps playing. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    save.data.muted = muted;
    save.write();
    if (this.sfxGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.sfxGain.gain.cancelScheduledValues(now);
      this.sfxGain.gain.setTargetAtTime(muted ? 0 : 0.9, now, 0.025);
    }
  }

  toggleMuted(): boolean {
    this.init();
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Mute only the music; gameplay SFX stay audible. */
  getMusicVolume(): number {
    return this.musicVolume;
  }

  setMusicVolume(value: number): void {
    this.musicVolume = Math.min(1, Math.max(0, value));
    save.data.musicVolume = this.musicVolume;
    save.write();
    this.applyMusicGain(0.04);
  }

  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    save.data.musicMuted = muted;
    save.write();
    this.applyMusicGain(0.03);
  }

  toggleMusicMuted(): boolean {
    this.init();
    this.setMusicMuted(!this.musicMuted);
    return this.musicMuted;
  }

  private applyMusicGain(smoothing: number): void {
    if (!this.musicGain || !this.ctx) return;
    const procedural = (this.musicMuted ? 0 : this.musicDucked ? 0.16 : 0.42) * this.musicVolume;
    const menu = this.musicMuted ? 0 : (this.musicDucked ? 0.35 : 1) * this.musicVolume;
    const biome = this.musicMuted ? 0 : (this.musicDucked ? 0.3 : 1) * this.musicVolume;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(procedural, now, smoothing);
    if (this.menuGain) {
      this.menuGain.gain.cancelScheduledValues(now);
      this.menuGain.gain.setTargetAtTime(menu, now, smoothing);
    }
    if (this.biomeGain) {
      this.biomeGain.gain.cancelScheduledValues(now);
      this.biomeGain.gain.setTargetAtTime(biome, now, smoothing);
    }
  }

  setMusicDucked(ducked: boolean): void {
    this.musicDucked = ducked;
    this.applyMusicGain(0.14);
  }

  /** Menu and runs both use recorded loops, crossfaded instead of cut. */
  setMenuMode(menu: boolean): void {
    this.menuMode = menu;
    if (menu) {
      this.trackToken++;
      this.stopMusicScheduler();
      this.playMenuTheme(1.6);
    } else {
      this.stopMusicScheduler();
      void this.playBiome(this.currentBiome, 2.2);
    }
  }

  private async loadMenuTheme(): Promise<void> {
    if (!this.ctx || this.menuLoading || this.menuBuffer) return;
    this.menuLoading = true;
    try {
      const response = await fetch(MENU_THEME);
      const bytes = await response.arrayBuffer();
      this.menuBuffer = await this.ctx.decodeAudioData(bytes);
      if (this.menuMode) this.playMenuTheme(1.2);
      void this.preloadBiomeTracks();
    } catch {
      // Fall back to the procedural theme if decoding fails.
      this.menuMode = false;
      this.startMusic();
    } finally {
      this.menuLoading = false;
    }
  }

  private async loadBiomeBytes(biome: BiomeId): Promise<ArrayBuffer | null> {
    const cached = this.trackBytes.get(biome);
    if (cached) return cached;
    const existing = this.trackByteRequests.get(biome);
    if (existing) return existing;

    const request = (async () => {
      try {
        const url = `${import.meta.env.BASE_URL}music/${biome}.ogg`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const bytes = await response.arrayBuffer();
        this.trackBytes.set(biome, bytes);
        return bytes;
      } catch {
        return null;
      } finally {
        this.trackByteRequests.delete(biome);
      }
    })();

    this.trackByteRequests.set(biome, request);
    return request;
  }

  private async loadBiomeTrack(biome: BiomeId): Promise<AudioBuffer | null> {
    const cached = this.trackCache.get(biome);
    if (cached) return cached;
    const existing = this.trackRequests.get(biome);
    if (existing) return existing;

    const request = (async () => {
      if (!this.ctx) return null;
      const bytes = await this.loadBiomeBytes(biome);
      if (!bytes) return null;
      try {
        const buffer = await this.ctx.decodeAudioData(bytes.slice(0));
        this.trackCache.set(biome, buffer);
        this.decodedOrder = this.decodedOrder.filter((id) => id !== biome);
        this.decodedOrder.push(biome);
        while (this.decodedOrder.length > 3) {
          const oldest = this.decodedOrder.shift();
          if (oldest && oldest !== this.currentBiome) this.trackCache.delete(oldest);
        }
        return buffer;
      } catch {
        return null;
      } finally {
        this.trackRequests.delete(biome);
      }
    })();

    this.trackRequests.set(biome, request);
    return request;
  }

  private async preloadBiomeTracks(): Promise<void> {
    if (this.preloading) return;
    this.preloading = true;
    // Fetch compressed bytes in parallel; decode only a few at a time.
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    await Promise.all(
      BIOME_TRACK_IDS.filter((id) => id !== "autumn").map((id) => this.loadBiomeBytes(id))
    );
  }

  private fadeOutMenu(fade: number): void {
    if (!this.ctx || !this.menuSource || !this.menuSourceGain) return;
    const now = this.ctx.currentTime;
    const source = this.menuSource;
    const gain = this.menuSourceGain;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fade);
    try {
      source.stop(now + fade + 0.08);
    } catch {
      // already stopped
    }
    this.menuSource = null;
    this.menuSourceGain = null;
    window.setTimeout(() => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // already disconnected
      }
    }, (fade + 0.15) * 1000);
  }

  private playMenuTheme(fade = 1.2): void {
    if (!this.ctx || !this.menuGain || !this.menuBuffer) return;
    const now = this.ctx.currentTime;
    this.fadeOutBiome(fade);
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = this.menuBuffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.menuGain);
    source.start(now);
    gain.gain.linearRampToValueAtTime(1, now + fade);
    this.menuSource = source;
    this.menuSourceGain = gain;
  }

  private fadeOutBiome(fade: number): void {
    if (!this.ctx || !this.biomeSource || !this.biomeSourceGain) return;
    const now = this.ctx.currentTime;
    const source = this.biomeSource;
    const gain = this.biomeSourceGain;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fade);
    try {
      source.stop(now + fade + 0.08);
    } catch {
      // already stopped
    }
    this.biomeSource = null;
    this.biomeSourceGain = null;
    this.biomeBuffer = null;
    window.setTimeout(() => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        // already disconnected
      }
    }, (fade + 0.15) * 1000);
  }

  private async playBiome(biome: BiomeId, fade: number): Promise<void> {
    const token = ++this.trackToken;
    const buffer = await this.loadBiomeTrack(biome);
    if (
      !buffer ||
      !this.ctx ||
      !this.biomeGain ||
      this.menuMode ||
      token !== this.trackToken ||
      this.currentBiome !== biome
    ) {
      if (!buffer && this.currentBiome === biome && !this.menuMode) {
        this.stopMusicScheduler();
        this.fadeOutMenu(fade);
        this.startMusic();
      }
      return;
    }

    this.stopMusicScheduler();
    this.fadeOutMenu(fade);
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.biomeGain);
    source.start(now);
    gain.gain.linearRampToValueAtTime(1, now + fade);

    const oldSource = this.biomeSource;
    const oldGain = this.biomeSourceGain;
    if (oldSource && oldGain) {
      oldGain.gain.cancelScheduledValues(now);
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0, now + fade);
      try {
        oldSource.stop(now + fade + 0.08);
      } catch {
        // already stopped
      }
      window.setTimeout(() => {
        try {
          oldSource.disconnect();
          oldGain.disconnect();
        } catch {
          // already disconnected
        }
      }, (fade + 0.15) * 1000);
    }

    this.biomeSource = source;
    this.biomeSourceGain = gain;
    this.biomeBuffer = biome;
  }

  /**
   * Switch to the next biome. The old loop fades out under the new one, so the
   * transition lands on the biome change without a silent gap.
   */
  setBiome(biome: BiomeId): void {
    if (biome === this.currentBiome) return;
    this.currentBiome = biome;
    this.musicTheme = MUSIC_THEMES[biome] ?? DEFAULT_THEME;
    if (!this.ctx || this.menuMode) return;
    this.trackToken++;
    void this.playBiome(biome, 1.8);
  }

  private canPlay(): boolean {
    return !!this.ctx && this.ctx.state === "running" && !this.muted;
  }

  private tone(options: {
    frequency: number;
    endFrequency?: number;
    duration?: number;
    type?: OscillatorType;
    volume?: number;
    delay?: number;
    attack?: number;
    bus?: Bus;
  }): void {
    if (!this.ready || !this.canPlay() || !this.ctx) return;
    const ctx = this.ctx;
    const when = ctx.currentTime + (options.delay ?? 0);
    const duration = Math.max(0.02, options.duration ?? 0.12);
    const gainNode = ctx.createGain();
    const osc = ctx.createOscillator();
    const volume = options.volume ?? 0.08;
    const attack = options.attack ?? 0.008;
    osc.type = options.type ?? "sine";
    osc.frequency.setValueAtTime(Math.max(20, options.frequency), when);
    if (options.endFrequency && options.endFrequency !== options.frequency) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), when + duration);
    }
    gainNode.gain.setValueAtTime(0.0001, when);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), when + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gainNode);
    gainNode.connect(options.bus === "music" ? this.musicGain! : this.sfxGain!);
    osc.start(when);
    osc.stop(when + duration + 0.04);
  }

  private noise(options: {
    duration?: number;
    volume?: number;
    filterType?: BiquadFilterType;
    frequency?: number;
    endFrequency?: number;
    q?: number;
    delay?: number;
  }): void {
    if (!this.ready || !this.canPlay() || !this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const when = ctx.currentTime + (options.delay ?? 0);
    const duration = Math.max(0.03, options.duration ?? 0.2);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = options.filterType ?? "lowpass";
    filter.frequency.setValueAtTime(options.frequency ?? 900, when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, options.endFrequency ?? 160), when + duration);
    filter.Q.value = options.q ?? 0.8;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.volume ?? 0.08), when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    source.start(when);
    source.stop(when + duration + 0.03);
  }

  click(): void {
    this.tone({ frequency: 620, endFrequency: 480, duration: 0.055, type: "triangle", volume: 0.045 });
  }

  hop(): void {
    this.tone({ frequency: 360, endFrequency: 590, duration: 0.085, type: "triangle", volume: 0.055 });
    this.tone({ frequency: 760, endFrequency: 910, duration: 0.045, type: "sine", volume: 0.02, delay: 0.018 });
  }

  land(): void {
    this.noise({ duration: 0.055, volume: 0.025, filterType: "lowpass", frequency: 340, endFrequency: 130 });
  }

  bump(): void {
    this.tone({ frequency: 155, endFrequency: 95, duration: 0.11, type: "square", volume: 0.035 });
    this.noise({ duration: 0.07, volume: 0.03, filterType: "lowpass", frequency: 260, endFrequency: 110 });
  }

  coin(): void {
    [988, 1319, 1760].forEach((frequency, index) => {
      this.tone({
        frequency,
        duration: 0.11,
        type: "triangle",
        volume: index === 2 ? 0.035 : 0.055,
        delay: index * 0.045
      });
    });
  }

  crash(): void {
    this.noise({ duration: 0.23, volume: 0.2, filterType: "lowpass", frequency: 2600, endFrequency: 220 });
    this.tone({ frequency: 130, endFrequency: 48, duration: 0.3, type: "sawtooth", volume: 0.09 });
    this.tone({ frequency: 390, endFrequency: 210, duration: 0.13, type: "square", volume: 0.035, delay: 0.03 });
  }

  geyser(volume = 0.05): void {
    const level = clamp(volume, 0.01, 0.12);
    this.noise({ duration: 0.38, volume: level, filterType: "bandpass", frequency: 320, endFrequency: 1100, q: 1.2 });
    this.tone({ frequency: 92, endFrequency: 52, duration: 0.32, type: "sawtooth", volume: level * 0.55 });
  }

  tide(): void {
    this.noise({ duration: 0.7, volume: 0.11, filterType: "lowpass", frequency: 220, endFrequency: 80 });
    this.tone({ frequency: 72, endFrequency: 44, duration: 0.8, type: "sine", volume: 0.06 });
  }

  wind(): void {
    this.noise({ duration: 0.62, volume: 0.06, filterType: "bandpass", frequency: 420, endFrequency: 1500, q: 0.55 });
    this.tone({ frequency: 180, endFrequency: 240, duration: 0.42, type: "sine", volume: 0.018 });
  }

  sinkWarn(): void {
    this.noise({ duration: 0.32, volume: 0.055, filterType: "bandpass", frequency: 280, endFrequency: 90, q: 2.2 });
    this.tone({ frequency: 130, endFrequency: 70, duration: 0.3, type: "triangle", volume: 0.035 });
  }

  sink(): void {
    this.noise({ duration: 0.65, volume: 0.13, filterType: "lowpass", frequency: 420, endFrequency: 70 });
    this.tone({ frequency: 110, endFrequency: 38, duration: 0.7, type: "sine", volume: 0.07 });
    this.noise({ duration: 0.3, volume: 0.05, filterType: "bandpass", frequency: 900, endFrequency: 200, q: 1.4, delay: 0.1 });
  }

  splash(): void {
    this.noise({ duration: 0.34, volume: 0.14, filterType: "bandpass", frequency: 1500, endFrequency: 260, q: 0.7 });
    this.tone({ frequency: 420, endFrequency: 120, duration: 0.24, type: "sine", volume: 0.055 });
    this.noise({ duration: 0.22, volume: 0.08, filterType: "highpass", frequency: 1000, endFrequency: 3000, delay: 0.08 });
  }

  trainHorn(volume = 0.05): void {
    const level = clamp(volume, 0.01, 0.09);
    this.tone({ frequency: 196, endFrequency: 190, duration: 0.55, type: "sawtooth", volume: level });
    this.tone({ frequency: 247, endFrequency: 242, duration: 0.55, type: "sawtooth", volume: level * 0.85 });
    this.tone({ frequency: 294, endFrequency: 286, duration: 0.55, type: "triangle", volume: level * 0.55 });
  }

  warning(): void {
    this.tone({ frequency: 880, endFrequency: 740, duration: 0.09, type: "square", volume: 0.028 });
    this.tone({ frequency: 660, endFrequency: 520, duration: 0.12, type: "triangle", volume: 0.022, delay: 0.08 });
  }

  deathTone(): void {
    this.tone({ frequency: 330, endFrequency: 130, duration: 0.5, type: "triangle", volume: 0.05 });
    this.tone({ frequency: 220, endFrequency: 80, duration: 0.6, type: "sine", volume: 0.045, delay: 0.1 });
  }

  milestone(): void {
    [523, 659, 784, 1047].forEach((frequency, index) => {
      this.tone({ frequency, duration: 0.16, type: "triangle", volume: 0.055, delay: index * 0.07 });
    });
    this.noise({
      duration: 0.25,
      volume: 0.02,
      filterType: "highpass",
      frequency: 3200,
      endFrequency: 6400,
      delay: 0.05
    });
  }

  newBest(): void {
    [523, 659, 784, 1047].forEach((frequency, index) => {
      this.tone({ frequency, duration: 0.22, type: "triangle", volume: 0.055, delay: index * 0.09 });
    });
  }

  unlock(): void {
    [523, 784, 1047, 1319].forEach((frequency, index) => {
      this.tone({ frequency, duration: 0.16, type: "sine", volume: 0.05, delay: index * 0.065 });
    });
    this.noise({ duration: 0.18, volume: 0.018, filterType: "highpass", frequency: 4200, endFrequency: 7000, delay: 0.17 });
  }

  startRun(): void {
    [392, 523, 659].forEach((frequency, index) => {
      this.tone({ frequency, duration: 0.13, type: "triangle", volume: 0.04, delay: index * 0.055 });
    });
  }

  private stopMusicScheduler(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null || this.menuMode) return;
    this.nextNoteTime = this.ctx.currentTime + 0.15;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 60);
  }

  private scheduleMusic(): void {
    if (!this.ctx || this.musicMuted || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    if (this.nextNoteTime < now - 0.5) this.nextNoteTime = now + 0.08;
    while (this.nextNoteTime < now + 0.24) {
      this.playMusicStep(this.musicStep, this.nextNoteTime);
      this.musicStep = (this.musicStep + 1) % 16;
      this.nextNoteTime += this.musicTheme.step;
    }
  }

  /** Convert a scale degree into a MIDI note, wrapping octaves as needed. */
  private scaleNote(degree: number): number {
    const { scale, root } = this.musicTheme;
    const octave = Math.floor(degree / scale.length);
    const index = ((degree % scale.length) + scale.length) % scale.length;
    return root + octave * 12 + scale[index];
  }

  private playMusicStep(step: number, time: number): void {
    const theme = this.musicTheme;
    const degree = theme.melody[step] ?? -1;
    if (degree >= 0) {
      const lead = this.scaleNote(degree) + 24;
      this.musicVoice(midiToFreq(lead), time, 0.29, theme.leadVolume, theme.wave);
      this.musicVoice(midiToFreq(lead + 12), time + 0.012, 0.16, theme.leadVolume * 0.25, "sine");
    }
    if (step % 4 === 0) {
      const bassDegree = theme.bass[(step / 4) % theme.bass.length] ?? 0;
      this.musicVoice(midiToFreq(this.scaleNote(bassDegree)), time, 0.7, theme.bassVolume, "sine");
    }
    if (theme.shaker && step % 4 === 2) this.musicShaker(time, 0.009);
    if (step === 0) {
      this.musicVoice(midiToFreq(this.scaleNote(0)), time, 1.1, 0.012, "sine");
      this.musicVoice(midiToFreq(this.scaleNote(4)), time + 0.02, 0.9, 0.009, "sine");
    }
  }

  private musicVoice(freq: number, time: number, duration: number, volume: number, type: OscillatorType): void {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, time);
    filter.Q.value = 0.3;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  private musicShaker(time: number, volume: number): void {
    if (!this.ctx || !this.noiseBuffer || !this.musicGain) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = "highpass";
    filter.frequency.value = 5200;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    source.start(time);
    source.stop(time + 0.08);
  }
}
