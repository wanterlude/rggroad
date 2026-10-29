/* ==========================================================================
   Procedural audio: a tiny WebAudio synth for music and game feedback.
   No external sound files required.
   ========================================================================== */
(function (CR) {
  "use strict";

  var AudioCtor = window.AudioContext || window.webkitAudioContext;

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function Sound() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
    this.muted = !!CR.save.data.muted;
    this.available = !!AudioCtor;
    this.ready = false;
    this._unlockHandler = null;
  }

  Sound.prototype.init = function () {
    if (!this.available) return false;
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(function () {});
      }
      return true;
    }

    try {
      var ctx = new AudioCtor();
      this.ctx = ctx;

      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.24;
      this.compressor.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.82;
      this.master.connect(this.compressor);

      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);

      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.42;
      this.musicGain.connect(this.master);

      this.noiseBuffer = this._makeNoise(ctx);
      this.ready = true;
      this.startMusic();

      if (ctx.state === "suspended") {
        ctx.resume().catch(function () {});
      }
      return true;
    } catch (error) {
      this.available = false;
      this.ready = false;
      return false;
    }
  };

  Sound.prototype._makeNoise = function (ctx) {
    var seconds = 1;
    var buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var seed = 1337;
    for (var i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    return buffer;
  };

  Sound.prototype.setMuted = function (muted) {
    this.muted = !!muted;
    CR.save.data.muted = this.muted;
    CR.save.write();
    if (this.master && this.ctx) {
      var now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.82, now, 0.025);
    }
    return this.muted;
  };

  Sound.prototype.toggleMuted = function () {
    this.init();
    return this.setMuted(!this.muted);
  };

  Sound.prototype.setMusicDucked = function (ducked) {
    if (!this.musicGain || !this.ctx) return;
    var now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(ducked ? 0.16 : 0.42, now, 0.14);
  };

  Sound.prototype._canPlay = function () {
    return this.ctx && this.ctx.state === "running" && !this.muted;
  };

  Sound.prototype._tone = function (options) {
    if (!this.ready || !this._canPlay()) return;
    var ctx = this.ctx;
    var when = ctx.currentTime + (options.delay || 0);
    var duration = Math.max(0.02, options.duration || 0.12);
    var gainNode = ctx.createGain();
    var osc = ctx.createOscillator();
    var volume = options.volume == null ? 0.08 : options.volume;
    var attack = options.attack == null ? 0.008 : options.attack;

    osc.type = options.type || "sine";
    osc.frequency.setValueAtTime(Math.max(20, options.frequency || 440), when);
    if (options.endFrequency && options.endFrequency !== options.frequency) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), when + duration);
    }

    gainNode.gain.setValueAtTime(0.0001, when);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), when + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    osc.connect(gainNode);
    gainNode.connect(options.bus === "music" ? this.musicGain : this.sfxGain);
    osc.start(when);
    osc.stop(when + duration + 0.04);
  };

  Sound.prototype._noise = function (options) {
    if (!this.ready || !this._canPlay() || !this.noiseBuffer) return;
    var ctx = this.ctx;
    var when = ctx.currentTime + (options.delay || 0);
    var duration = Math.max(0.03, options.duration || 0.2);
    var source = ctx.createBufferSource();
    var filter = ctx.createBiquadFilter();
    var gainNode = ctx.createGain();

    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = options.filterType || "lowpass";
    filter.frequency.setValueAtTime(options.frequency || 900, when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, options.endFrequency || 160), when + duration);
    filter.Q.value = options.q || 0.8;

    gainNode.gain.setValueAtTime(0.0001, when);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.volume || 0.08), when + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxGain);
    source.start(when);
    source.stop(when + duration + 0.03);
  };

  /* ------------------------------------------------------------------------
     Feedback
     ------------------------------------------------------------------------ */

  Sound.prototype.click = function () {
    this._tone({ frequency: 620, endFrequency: 480, duration: 0.055, type: "triangle", volume: 0.045 });
  };

  Sound.prototype.hop = function () {
    this._tone({ frequency: 360, endFrequency: 590, duration: 0.085, type: "triangle", volume: 0.055 });
    this._tone({ frequency: 760, endFrequency: 910, duration: 0.045, type: "sine", volume: 0.02, delay: 0.018 });
  };

  Sound.prototype.land = function () {
    this._noise({ duration: 0.055, volume: 0.025, filterType: "lowpass", frequency: 340, endFrequency: 130 });
  };

  Sound.prototype.bump = function () {
    this._tone({ frequency: 155, endFrequency: 95, duration: 0.11, type: "square", volume: 0.035 });
    this._noise({ duration: 0.07, volume: 0.03, filterType: "lowpass", frequency: 260, endFrequency: 110 });
  };

  Sound.prototype.coin = function () {
    var self = this;
    [988, 1319, 1760].forEach(function (freq, index) {
      self._tone({
        frequency: freq,
        duration: 0.11,
        type: "triangle",
        volume: index === 2 ? 0.035 : 0.055,
        delay: index * 0.045
      });
    });
  };

  Sound.prototype.crash = function () {
    this._noise({ duration: 0.23, volume: 0.2, filterType: "lowpass", frequency: 2600, endFrequency: 220 });
    this._tone({ frequency: 130, endFrequency: 48, duration: 0.3, type: "sawtooth", volume: 0.09 });
    this._tone({ frequency: 390, endFrequency: 210, duration: 0.13, type: "square", volume: 0.035, delay: 0.03 });
  };

  Sound.prototype.splash = function () {
    this._noise({ duration: 0.34, volume: 0.14, filterType: "bandpass", frequency: 1500, endFrequency: 260, q: 0.7 });
    this._tone({ frequency: 420, endFrequency: 120, duration: 0.24, type: "sine", volume: 0.055 });
    this._noise({ duration: 0.22, volume: 0.08, filterType: "highpass", frequency: 1000, endFrequency: 3000, delay: 0.08 });
  };

  Sound.prototype.trainHorn = function (volume) {
    var level = CR.clamp(volume == null ? 0.05 : volume, 0.01, 0.09);
    this._tone({ frequency: 196, endFrequency: 190, duration: 0.55, type: "sawtooth", volume: level });
    this._tone({ frequency: 247, endFrequency: 242, duration: 0.55, type: "sawtooth", volume: level * 0.85 });
    this._tone({ frequency: 294, endFrequency: 286, duration: 0.55, type: "triangle", volume: level * 0.55 });
  };

  Sound.prototype.deathTone = function () {
    this._tone({ frequency: 330, endFrequency: 130, duration: 0.5, type: "triangle", volume: 0.05 });
    this._tone({ frequency: 220, endFrequency: 80, duration: 0.6, type: "sine", volume: 0.045, delay: 0.1 });
  };

  Sound.prototype.newBest = function () {
    var self = this;
    [523, 659, 784, 1047].forEach(function (freq, index) {
      self._tone({
        frequency: freq,
        duration: 0.22,
        type: "triangle",
        volume: 0.055,
        delay: index * 0.09
      });
    });
  };

  Sound.prototype.unlock = function () {
    var self = this;
    [523, 784, 1047, 1319].forEach(function (freq, index) {
      self._tone({
        frequency: freq,
        duration: 0.16,
        type: "sine",
        volume: 0.05,
        delay: index * 0.065
      });
    });
    this._noise({ duration: 0.18, volume: 0.018, filterType: "highpass", frequency: 4200, endFrequency: 7000, delay: 0.17 });
  };

  Sound.prototype.startRun = function () {
    var self = this;
    [392, 523, 659].forEach(function (freq, index) {
      self._tone({
        frequency: freq,
        duration: 0.13,
        type: "triangle",
        volume: 0.04,
        delay: index * 0.055
      });
    });
  };

  Sound.prototype.pause = function (ducked) {
    this.setMusicDucked(!!ducked);
  };

  /* ------------------------------------------------------------------------
     Music loop
     ------------------------------------------------------------------------ */

  Sound.prototype.startMusic = function () {
    if (!this.ctx || this.musicTimer) return;
    this.nextNoteTime = this.ctx.currentTime + 0.15;
    this.musicStep = 0;
    var self = this;
    this.musicTimer = window.setInterval(function () {
      self._scheduleMusic();
    }, 60);
  };

  Sound.prototype._scheduleMusic = function () {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state !== "running") return;
    var now = this.ctx.currentTime;
    if (this.nextNoteTime < now - 0.5) this.nextNoteTime = now + 0.08;

    while (this.nextNoteTime < now + 0.22) {
      this._playMusicStep(this.musicStep, this.nextNoteTime);
      this.musicStep = (this.musicStep + 1) % 32;
      this.nextNoteTime += 0.172;
    }
  };

  Sound.prototype._playMusicStep = function (step, time) {
    var ctx = this.ctx;
    if (!ctx) return;

    var melody = {
      0: 12, 2: 7, 4: 4, 6: 7, 8: 9, 10: 7, 12: 4, 14: 2,
      16: 0, 18: 4, 20: 7, 22: 9, 24: 7, 26: 4, 28: 2, 30: 0
    };
    var note = melody[step];

    if (note != null) {
      this._musicVoice(midiToFreq(72 + note), time, 0.29, 0.037, "triangle");
      this._musicVoice(midiToFreq(84 + note), time + 0.012, 0.18, 0.009, "sine");
    }

    if (step % 8 === 0) {
      var bassRoots = [48, 43, 45, 41];
      var root = bassRoots[(step / 8) % 4];
      this._musicVoice(midiToFreq(root), time, 0.65, 0.033, "sine");
    }

    if (step % 4 === 2) {
      this._musicShaker(time, 0.011);
    }

    if (step === 0) {
      this._musicVoice(midiToFreq(60), time, 1.1, 0.012, "sine");
      this._musicVoice(midiToFreq(67), time + 0.02, 0.9, 0.009, "sine");
    }
  };

  Sound.prototype._musicVoice = function (freq, time, duration, volume, type) {
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    var gainNode = ctx.createGain();
    var filter = ctx.createBiquadFilter();

    osc.type = type || "triangle";
    osc.frequency.setValueAtTime(freq, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, time);
    filter.Q.value = 0.3;

    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.exponentialRampToValueAtTime(volume, time + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  };

  Sound.prototype._musicShaker = function (time, volume) {
    if (!this.noiseBuffer) return;
    var ctx = this.ctx;
    var source = ctx.createBufferSource();
    var filter = ctx.createBiquadFilter();
    var gainNode = ctx.createGain();

    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = "highpass";
    filter.frequency.value = 5200;
    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.exponentialRampToValueAtTime(volume, time + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.musicGain);
    source.start(time);
    source.stop(time + 0.08);
  };

  CR.Sound = Sound;
})(window.CR = window.CR || {});
