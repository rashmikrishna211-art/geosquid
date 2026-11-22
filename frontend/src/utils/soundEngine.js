class SoundEngine {
  constructor() {
    this.ctx = null;
    this.loopTimer = null;
    this.muted = false;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) this.stopLoop();
  }

  playVocalNote(freq, duration, startOffset = 0, gainVal = 0.34, formantHz = 760) {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + startOffset;

    // Dual detuned oscillators create a hollow, childlike doll-voice timbre
    const oscMain = this.ctx.createOscillator();
    const oscHarm = this.ctx.createOscillator();
    oscMain.type = 'sawtooth';
    oscHarm.type = 'triangle';
    oscMain.frequency.setValueAtTime(freq, now);
    oscHarm.frequency.setValueAtTime(freq * 1.004, now);

    // Subtle pitch vibrato on sustained syllables
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(5.5, now);
    lfoGain.gain.setValueAtTime(freq * 0.012, now);
    lfo.connect(lfoGain);
    lfoGain.connect(oscMain.frequency);

    // Bandpass vocal formant filter removes harsh buzz and shapes vowel tone
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(formantHz, now);
    filter.Q.setValueAtTime(2.6, now);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(gainVal, now + 0.025);
    env.gain.setValueAtTime(gainVal * 0.88, now + Math.max(0.03, duration - 0.04));
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscMain.connect(filter);
    oscHarm.connect(filter);
    filter.connect(env);
    env.connect(this.ctx.destination);

    oscMain.start(now);
    oscHarm.start(now);
    lfo.start(now);

    const stopAt = now + duration + 0.03;
    oscMain.stop(stopAt);
    oscHarm.stop(stopAt);
    lfo.stop(stopAt);
  }

  playRawTone(freq, endFreq, duration, startOffset = 0, type = 'sawtooth', gainVal = 0.28) {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // Tuned Korean chant phrasing: "Mu-gung-hwa kko-chi / pi-eot / seum-ni-da"
  playDollChant(tempoMultiplier = 1.0) {
    if (this.muted) return 2400;
    const b = 0.22 / tempoMultiplier;

    // Frequencies in E minor / G major pentatonic doll register (B4, E5, D5, A4, G4)
    const B4 = 493.88;
    const E5 = 659.25;
    const D5 = 587.33;
    const A4 = 440.0;
    const G4 = 392.0;

    const syllables = [
      // "Mu - gung - hwa"
      { f: B4, d: b * 0.95, t: 0.0, fm: 620 },   // Mu-
      { f: E5, d: b * 0.90, t: 1.05, fm: 720 },  // gung-
      { f: E5, d: b * 0.95, t: 2.05, fm: 880 },  // hwa

      // "kko - chi" (slight breath pause before kko-)
      { f: E5, d: b * 0.85, t: 3.35, fm: 740 },  // kko-
      { f: D5, d: b * 1.15, t: 4.30, fm: 920 },  // chi

      // "pi - eot"
      { f: E5, d: b * 0.85, t: 5.85, fm: 900 },  // pi-
      { f: E5, d: b * 0.85, t: 6.80, fm: 760 },  // eot

      // "seum - ni - da!" (descending cadence with held final syllable)
      { f: D5, d: b * 0.80, t: 7.95, fm: 680 },  // seum-
      { f: B4, d: b * 0.80, t: 8.85, fm: 860 },  // ni-
      { f: A4, d: b * 1.55, t: 9.75, fm: 880 },  // da!
    ];

    syllables.forEach((s) => {
      this.playVocalNote(s.f, s.d, s.t * b, 0.36, s.fm);
    });

    return 11.6 * b * 1000;
  }

  startGreenLightLoop() {
    this.stopLoop();
    if (this.muted) return;
    let speed = 0.96;

    const runCycle = () => {
      const durationMs = this.playDollChant(speed) || 2500;
      // Gradually accelerates like the doll speeding up each round
      speed = Math.min(speed + 0.09, 1.55);
      this.loopTimer = setTimeout(runCycle, durationMs + 180);
    };

    runCycle();
  }

  playRedLightStop() {
    this.stopLoop();
    if (this.muted) return;
    // Mechanical doll head-snap servo whirr + low lock-in thud
    this.playRawTone(320, 980, 0.16, 0.0, 'sawtooth', 0.26);
    this.playRawTone(160, 52, 0.34, 0.13, 'triangle', 0.42);
  }

  playEliminated() {
    this.stopLoop();
    if (this.muted) return;
    // Sharp elimination crack + sub-bass drop
    this.playRawTone(420, 75, 0.22, 0.0, 'sawtooth', 0.44);
    this.playRawTone(130, 48, 0.55, 0.14, 'square', 0.36);
  }

  playWinner() {
    this.stopLoop();
    if (this.muted) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      this.playVocalNote(freq, 0.28, idx * 0.13, 0.32, 850);
    });
  }

  stopLoop() {
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }
}

export const soundEngine = new SoundEngine();