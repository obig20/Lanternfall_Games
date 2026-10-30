/** All sound is generated live with the Web Audio API: no audio files, no licenses. */
export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: OscillatorNode[] = [];
  private muted = false;
  private volume = 0.5;

  /** Browsers only allow audio after a click/keypress, so call this from the Start button. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  /** Master volume 0..1 (the mute toggle still wins). */
  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }

  // --- sound effects ---------------------------------------------------------
  jump(): void { this.tone(330, 0.14, 'triangle', 0.18, 0, 560); }
  land(speed: number): void {
    this.noise(0.12, Math.min(0.3, 0.08 + speed * 0.012), 500);
    this.tone(90, 0.12, 'sine', 0.2, 0, 60);
  }
  reveal(): void {
    this.tone(660, 0.35, 'sine', 0.16, 0);
    this.tone(990, 0.4, 'sine', 0.1, 0.06);
  }
  step(): void { this.noise(0.05, 0.06, 900); }
  pulse(): void { this.tone(220, 0.6, 'sine', 0.22, 0, 880); }
  checkpoint(): void {
    [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.18, i * 0.1));
  }
  respawn(): void { this.tone(400, 0.35, 'sine', 0.16, 0, 150); }
  win(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.18, i * 0.12));
  }

  // --- building blocks -------------------------------------------------------
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, cutoff: number): void {
    if (!this.ctx || !this.master) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
  }

  /** Quiet, slowly breathing two-note drone for atmosphere. */
  private startAmbient(): void {
    if (!this.ctx || !this.master) return;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.035;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);
    [98, 146.83, 196].forEach((f) => {
      const o = this.ctx!.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(gain);
      o.start();
      this.ambient.push(o);
    });
    gain.connect(this.master);
    lfo.start();
    this.ambient.push(lfo);
  }

  dispose(): void {
    this.ambient.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
    this.ambient = [];
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
  }
}
