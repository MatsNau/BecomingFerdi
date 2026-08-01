import type { GameAudio } from "../core/audio.ts";
import { clamp, damp, falloff } from "../core/math.ts";
import { COW_SPAWNS, groundY, type CowSpawn } from "./level.ts";

const HEAR_INNER = 72;
const HEAR_OUTER = 195;
const ALERT_RISE = 1.55;
const ALERT_FALL = 0.72;

export class Cow {
  readonly baseX: number;
  readonly depth: number;
  private readonly period: number;
  private readonly awake: number;
  private readonly phase0: number;

  x = 0;
  phase = 0;
  /** 0 = Kopf unten im Gras, 1 = Kopf oben und wach. */
  head = 0;
  ears = 0;
  alert = 0;
  tail = 0;
  panic = 0;
  vx = 0;
  private mooCooldown = 0;
  private warned = false;

  constructor(spawn: CowSpawn) {
    this.baseX = spawn.x;
    this.depth = spawn.depth;
    this.period = spawn.period;
    this.awake = spawn.awake;
    this.phase0 = spawn.phase;
    this.reset();
  }

  reset(): void {
    this.x = this.baseX;
    this.phase = this.phase0;
    this.head = this.phase < this.awake ? 1 : 0;
    this.ears = 0;
    this.alert = 0;
    this.panic = 0;
    this.vx = 0;
    this.mooCooldown = 0;
    this.warned = false;
  }

  get groundY(): number {
    return groundY(this.x);
  }

  /** Sekunden, bis der Kopf wieder hochgeht (0, wenn er schon oben ist). */
  get timeUntilLift(): number {
    if (this.phase < this.awake) return 0;
    return (1 - this.phase) * this.period;
  }

  update(dt: number, time: number, playerX: number, playerNoise: number, audio: GameAudio): void {
    this.tail = Math.sin(time * 1.7 + this.baseX) * 0.5 + Math.sin(time * 0.6 + this.baseX) * 0.5;
    this.mooCooldown = Math.max(0, this.mooCooldown - dt);

    if (this.panic > 0) {
      this.vx = damp(this.vx, 260, 2.2, dt);
      this.x += this.vx * dt;
      this.head = damp(this.head, 1, 8, dt);
      return;
    }

    this.phase = (this.phase + dt / this.period) % 1;
    const wantsUp = this.phase < this.awake ? 1 : 0;
    this.head = damp(this.head, wantsUp, 5.5, dt);

    const lift = this.timeUntilLift;
    const twitching = lift > 0 && lift < 0.75;
    this.ears = damp(this.ears, twitching ? 1 : 0, 9, dt);

    const prox = falloff(Math.abs(playerX - this.x), HEAR_INNER, HEAR_OUTER);
    const influence = playerNoise * prox * this.head;
    if (influence > 0.02) this.alert = clamp(this.alert + influence * ALERT_RISE * dt, 0, 1);
    else this.alert = clamp(this.alert - ALERT_FALL * dt, 0, 1);

    if (this.alert > 0.4 && !this.warned && this.mooCooldown <= 0) {
      audio.moo(this.alert * 0.6);
      this.mooCooldown = 2.4;
      this.warned = true;
    }
    if (this.alert < 0.15) this.warned = false;
  }
}

export type HerdResult = "calm" | "startled";

export class Herd {
  readonly cows: Cow[] = COW_SPAWNS.map((s) => new Cow(s));
  stampeding = false;
  stampedeT = 0;
  /** Wie oft die Herde diesen Spieler schon vertrieben hat. */
  scares = 0;

  reset(): void {
    this.stampeding = false;
    this.stampedeT = 0;
    for (const c of this.cows) c.reset();
  }

  get maxAlert(): number {
    let m = 0;
    for (const c of this.cows) m = Math.max(m, c.alert);
    return m;
  }

  /** Naechste Kuh mit erhobenem Kopf in Spielernaehe - fuer den Bildschirmhinweis. */
  watcher(playerX: number): Cow | null {
    let best: Cow | null = null;
    let bestD = Infinity;
    for (const c of this.cows) {
      if (c.head < 0.35) continue;
      const d = Math.abs(c.x - playerX);
      if (d < 260 && d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  update(
    dt: number,
    time: number,
    playerX: number,
    playerNoise: number,
    audio: GameAudio,
  ): HerdResult {
    if (this.stampeding) {
      this.stampedeT += dt;
      for (const c of this.cows) c.update(dt, time, playerX, 0, audio);
      return "calm";
    }

    for (const c of this.cows) {
      c.update(dt, time, playerX, playerNoise, audio);
      if (c.alert >= 1) {
        this.trigger(audio);
        return "startled";
      }
    }
    return "calm";
  }

  private trigger(audio: GameAudio): void {
    this.stampeding = true;
    this.stampedeT = 0;
    this.scares++;
    audio.stampede();
    for (const c of this.cows) {
      c.panic = 1;
      c.vx = 40;
    }
  }
}
