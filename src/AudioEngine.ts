import { clamp } from "./utils";
import { save } from "./save";

type Bus = "sfx" | "music";

const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicDucked = false;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  private ready = false;
  muted = save.data.muted;
  musicMuted = save.data.musicMuted;

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
      this.musicGain.gain.value = this.musicMuted ? 0 : 0.42;
      this.musicGain.connect(this.master);

      this.noiseBuffer = this.makeNoise(ctx);
      this.ready = true;
      this.startMusic();
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
    const target = this.musicMuted ? 0 : this.musicDucked ? 0.16 : 0.42;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(target, now, smoothing);
  }

  setMusicDucked(ducked: boolean): void {
    this.musicDucked = ducked;
    this.applyMusicGain(0.14);
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

  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.15;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 60);
  }

  private scheduleMusic(): void {
    if (!this.ctx || this.musicMuted || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    if (this.nextNoteTime < now - 0.5) this.nextNoteTime = now + 0.08;
    while (this.nextNoteTime < now + 0.22) {
      this.playMusicStep(this.musicStep, this.nextNoteTime);
      this.musicStep = (this.musicStep + 1) % 32;
      this.nextNoteTime += 0.172;
    }
  }

  private playMusicStep(step: number, time: number): void {
    const melody: Record<number, number> = {
      0: 12, 2: 7, 4: 4, 6: 7, 8: 9, 10: 7, 12: 4, 14: 2,
      16: 0, 18: 4, 20: 7, 22: 9, 24: 7, 26: 4, 28: 2, 30: 0
    };
    const note = melody[step];
    if (note !== undefined) {
      this.musicVoice(midiToFreq(72 + note), time, 0.29, 0.037, "triangle");
      this.musicVoice(midiToFreq(84 + note), time + 0.012, 0.18, 0.009, "sine");
    }
    if (step % 8 === 0) {
      const roots = [48, 43, 45, 41];
      this.musicVoice(midiToFreq(roots[(step / 8) % 4]), time, 0.65, 0.033, "sine");
    }
    if (step % 4 === 2) this.musicShaker(time, 0.011);
    if (step === 0) {
      this.musicVoice(midiToFreq(60), time, 1.1, 0.012, "sine");
      this.musicVoice(midiToFreq(67), time + 0.02, 0.9, 0.009, "sine");
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
