import { clamp } from "./math.ts";

const BPM = 126;
const BEAT = 60 / BPM;

/**
 * Kleiner WebAudio-Synth. Keine Sounddateien - alles wird erzeugt: der Bass
 * aus dem Festzelt, Schritte, das Muhen. Startet erst nach der ersten
 * Nutzergeste (Browser-Regel).
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private windGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  /** Verschiebung zwischen Spielzeit und AudioContext-Zeit. */
  private clockOffset = 0;
  private scheduledBeat = 0;
  private visualBeat = 0;

  /** 1 direkt auf dem Beat, faellt danach ab - fuer das Pulsieren des Bildes. */
  beatPulse = 0;
  enabled = true;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  unlock(gameTime: number): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    type Win = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as Win).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    this.master = master;

    const music = ctx.createGain();
    music.gain.value = 0;
    music.connect(master);
    this.musicBus = music;

    // Weisses Rauschen als Basis fuer Wind, Schritte, Platschen.
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    const windSrc = ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 380;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilter).connect(windGain).connect(master);
    windSrc.start();
    this.windGain = windGain;

    this.clockOffset = ctx.currentTime - gameTime;
    this.scheduledBeat = Math.ceil(gameTime / BEAT);
    this.visualBeat = this.scheduledBeat;
    void ctx.resume();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.9 : 0;
  }

  /**
   * @param tent  0..1 - wie nah man am Festzelt ist
   * @param wind  0..1 - Feldwind
   */
  update(dt: number, gameTime: number, tent: number, wind: number): void {
    this.beatPulse = Math.max(0, this.beatPulse - dt * 3.4);

    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.windGain) return;

    this.musicBus.gain.setTargetAtTime(clamp(tent, 0, 1) * 0.5, ctx.currentTime, 0.25);
    this.windGain.gain.setTargetAtTime(0.02 + wind * 0.06, ctx.currentTime, 0.6);

    // Beats knapp im Voraus einplanen, damit nichts stottert.
    const horizon = gameTime + 0.25;
    while (this.scheduledBeat * BEAT < horizon) {
      this.scheduleBeat(this.scheduledBeat, this.clockOffset + this.scheduledBeat * BEAT);
      this.scheduledBeat++;
    }
    while (this.visualBeat * BEAT <= gameTime) {
      if (tent > 0.02) this.beatPulse = 1;
      this.visualBeat++;
    }
  }

  private scheduleBeat(index: number, at: number): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    const t = Math.max(at, ctx.currentTime + 0.01);

    // Kick auf jeder Viertel.
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + 0.34);

    // Offbeat-Hut, damit es nach Zeltdisco klingt und nicht nach Herzschlag.
    if (this.noiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6500;
      const hg = ctx.createGain();
      const ht = t + BEAT / 2;
      hg.gain.setValueAtTime(0.0001, ht);
      hg.gain.exponentialRampToValueAtTime(0.13, ht + 0.004);
      hg.gain.exponentialRampToValueAtTime(0.0001, ht + 0.06);
      src.connect(hp).connect(hg).connect(bus);
      src.start(ht);
      src.stop(ht + 0.08);
    }

    // Alle vier Takte eine dumpfe Synthfigur.
    if (index % 8 === 0) {
      const lead = ctx.createOscillator();
      const lg = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700;
      lead.type = "sawtooth";
      lead.frequency.setValueAtTime(index % 16 === 0 ? 146.8 : 174.6, t);
      lg.gain.setValueAtTime(0.0001, t);
      lg.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
      lg.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 1.6);
      lead.connect(lp).connect(lg).connect(bus);
      lead.start(t);
      lead.stop(t + BEAT * 1.8);
    }
  }

  // ------------------------------------------------------------------ Effekte

  private blip(
    freq: number,
    endFreq: number,
    dur: number,
    gain: number,
    type: OscillatorType = "sine",
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, freq: number, gain: number, type: BiquadFilterType = "bandpass"): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuf) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  step(power: number): void {
    this.noise(0.09, 900 + Math.random() * 300, 0.05 + power * 0.07);
  }

  jump(): void {
    this.blip(280, 480, 0.14, 0.1, "triangle");
    this.noise(0.1, 1400, 0.05);
  }

  land(power: number): void {
    this.noise(0.16, 320, 0.06 + power * 0.1, "lowpass");
    this.blip(150, 70, 0.12, 0.06 + power * 0.06, "sine");
  }

  splash(): void {
    this.noise(0.45, 1800, 0.16, "bandpass");
    this.noise(0.3, 500, 0.1, "lowpass");
  }

  chomp(): void {
    this.noise(0.12, 700, 0.14, "lowpass");
    this.blip(190, 120, 0.1, 0.07, "triangle");
  }

  slurp(): void {
    this.blip(320, 620, 0.25, 0.09, "triangle");
  }

  /** @param urgency 0 = gemuetliches Muhen, 1 = sehr wach */
  moo(urgency: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const dur = 0.55 + urgency * 0.35;
    const base = 118 + urgency * 42;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(base * 0.8, t);
    osc.frequency.linearRampToValueAtTime(base, t + dur * 0.25);
    osc.frequency.linearRampToValueAtTime(base * 0.62, t + dur);

    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vib.frequency.value = 5.5;
    vibGain.gain.value = 5;
    vib.connect(vibGain).connect(osc.frequency);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(600 + urgency * 500, t);
    lp.frequency.linearRampToValueAtTime(320, t + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1 + urgency * 0.16, t + 0.08);
    g.gain.setValueAtTime(0.1 + urgency * 0.16, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(lp).connect(g).connect(this.master);
    vib.start(t);
    osc.start(t);
    vib.stop(t + dur + 0.05);
    osc.stop(t + dur + 0.05);
  }

  stampede(): void {
    this.moo(1);
    window.setTimeout(() => this.moo(0.8), 180);
    window.setTimeout(() => this.moo(0.95), 420);
    this.noise(1.4, 160, 0.22, "lowpass");
  }

  door(): void {
    this.noise(0.5, 240, 0.09, "lowpass");
    this.blip(90, 60, 0.4, 0.07, "sine");
  }

  chime(): void {
    this.blip(660, 660, 0.5, 0.07, "triangle");
    window.setTimeout(() => this.blip(880, 880, 0.6, 0.06, "triangle"), 110);
  }
}
