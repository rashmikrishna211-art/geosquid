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

  playTone(freq, duration, startOffset = 0, type = 'triangle', gainVal = 0.28) {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // "Mu-gung-hwa kko-ci pi-eot seum-ni-da" doll chant cadence
  playDollChant(tempoMultiplier = 1.0) {
    if (this.muted) return;
    const step = 0.21 / tempoMultiplier;
    const notes = [
      { f: 440.0, d: step * 0.85, t: 0 },      // Mu- (A4)
      { f: 587.33, d: step * 0.85, t: 1 },     // gung- (D5)
      { f: 587.33, d: step * 0.85, t: 2 },     // hwa (D5)
      { f: 587.33, d: step * 0.85, t: 3 },     // kko- (D5)
      { f: 523.25, d: step * 0.9, t: 4 },      // ci (C5)
      { f: 587.33, d: step * 0.85, t: 5.2 },   // pi- (D5)
      { f: 587.33, d: step * 0.85, t: 6.2 },   // eot (D5)
      { f: 440.0, d: step * 0.85, t: 7.2 },    // seum- (A4)
      { f: 440.0, d: step * 0.85, t: 8.2 },    // ni- (A4)
      { f: 523.25, d: step * 1.4, t: 9.2 },    // da! (C5)
    ];

    notes.forEach((n) => {
      this.playTone(n.f, n.d, n.t * step, 'triangle', 0.3);
      this.playTone(n.f * 2, n.d * 0.7, n.t * step, 'sine', 0.08);
    });

    return 11.2 * step * 1000;
  }

  startGreenLightLoop() {
    this.stopLoop();
    if (this.muted) return;
    let speed = 1.0;

    const runCycle = () => {
      const durationMs = this.playDollChant(speed) || 2400;
      speed = Math.min(speed + 0.08, 1.45); // Gradually speeds up tension
      this.loopTimer = setTimeout(runCycle, durationMs + 250);
    };

    runCycle();
  }

  playRedLightStop() {
    this.stopLoop();
    if (this.muted) return;
    // Doll head-turn servo whirr + sharp freeze buzzer
    this.playTone(880, 0.14, 0, 'sawtooth', 0.32);
    this.playTone(220, 0.38, 0.12, 'square', 0.35);
  }

  playEliminated() {
    this.stopLoop();
    if (this.muted) return;
    this.playTone(150, 0.25, 0, 'sawtooth', 0.45);
    this.playTone(95, 0.55, 0.18, 'sawtooth', 0.45);
  }

  playWinner() {
    this.stopLoop();
    if (this.muted) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      this.playTone(freq, 0.25, idx * 0.13, 'triangle', 0.32);
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