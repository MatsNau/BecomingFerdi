import { approach, clamp, damp, makeNoise1D } from "../core/math.ts";
import { groundY, inDitch, SOLIDS, WATER_Y } from "./level.ts";

export const WALK_SPEED = 132;
export const RUN_SPEED = 258;

const ACCEL_GROUND = 1150;
const ACCEL_AIR = 640;
const FRICTION = 1500;
const GRAVITY = 1560;
const JUMP_VEL = 492;
const JUMP_CUT = 0.42;
const COYOTE = 0.11;
const JUMP_BUFFER = 0.13;

export const HALF_W = 13;
export const HEIGHT = 82;

export type PlayerState = "normal" | "eating" | "down" | "auto";

const swayNoise = makeNoise1D(77);
const driftNoise = makeNoise1D(311);
const pulseNoise = makeNoise1D(905);

export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  grounded = true;

  /** 0 = nuechtern, 1 = "wie komme ich hier eigentlich weg". */
  drunk = 0.85;
  /** Aktuelle Seitwaertsdrift durch das Torkeln, in px/s. */
  drift = 0;
  /** Oberkoerperneigung, nur fuer die Darstellung. */
  lean = 0;

  state: PlayerState = "normal";
  stateT = 0;
  /** Erzwungene Laufrichtung im Zustand "auto" (Abspann). */
  autoDir = 0;

  inWater = false;
  wasInWater = false;

  walkPhase = 0;
  /** Wird true fuer genau einen Frame, wenn ein Fuss aufsetzt. */
  stepped = false;
  /** 0..1, wie hart die letzte Landung war. */
  landImpact = 0;
  justLanded = 0;
  justSplashed = false;

  private coyoteT = 0;
  private landNoise = 0;

  /** Wie viel Krach Ferdi gerade macht (0..1) - die Kuehe hoeren genau das. */
  noiseLevel = 0;

  reset(x: number): void {
    this.x = x;
    this.y = groundY(x);
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.grounded = true;
    this.state = "normal";
    this.stateT = 0;
    this.walkPhase = 0;
    this.landNoise = 0;
    this.noiseLevel = 0;
    this.inWater = false;
    this.wasInWater = false;
  }

  get speedRatio(): number {
    return Math.min(1, Math.abs(this.vx) / RUN_SPEED);
  }

  get controllable(): boolean {
    return this.state === "normal";
  }

  update(
    dt: number,
    time: number,
    input: { left: boolean; right: boolean; run: boolean; jumpHeld: boolean; consumeJump(b: number): boolean },
  ): void {
    this.stepped = false;
    this.justLanded = 0;
    this.justSplashed = false;
    this.stateT += dt;

    // ---------------------------------------------------------- Torkeln
    const wobble = driftNoise(time * 0.55) * 0.7 + driftNoise(time * 1.9 + 40) * 0.3;
    const surge = Math.max(0, pulseNoise(time * 0.3) - 0.5) / 0.5;
    this.drift = wobble * (1 + surge * 1.5) * this.drunk * 58;
    this.lean = damp(this.lean, swayNoise(time * 0.7) * this.drunk * 0.22, 5, dt);

    let dir = 0;
    let wantRun = false;
    if (this.state === "normal") {
      dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      wantRun = input.run;
    } else if (this.state === "auto") {
      dir = this.autoDir;
    }

    // ---------------------------------------------------------- Horizontal
    const drunkPenalty = 1 - this.drunk * 0.14;
    let maxSpeed = (wantRun ? RUN_SPEED : WALK_SPEED) * drunkPenalty;
    if (this.state === "auto") maxSpeed = WALK_SPEED * 0.85;
    if (this.inWater) maxSpeed *= 0.5;

    const canDrift = this.state === "normal" || this.state === "auto";
    const target = dir * maxSpeed + (canDrift ? this.drift : 0);
    const accel = this.grounded ? ACCEL_GROUND * (1 - this.drunk * 0.25) : ACCEL_AIR;
    const rate = dir !== 0 || Math.abs(this.drift) > 4 ? accel : FRICTION;
    this.vx = approach(this.vx, this.state === "down" ? 0 : target, rate * dt);

    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;

    // ---------------------------------------------------------- Springen
    if (this.grounded) this.coyoteT = COYOTE;
    else this.coyoteT = Math.max(0, this.coyoteT - dt);

    if (this.state === "normal" && this.coyoteT > 0 && input.consumeJump(JUMP_BUFFER)) {
      this.vy = -JUMP_VEL;
      this.grounded = false;
      this.coyoteT = 0;
    }
    if (this.vy < 0 && !input.jumpHeld) this.vy += JUMP_VEL * JUMP_CUT * dt * 6;

    // ---------------------------------------------------------- Bewegung
    this.x += this.vx * dt;
    this.resolveHorizontal();

    const prevFeet = this.y;
    this.vy = Math.min(this.vy + GRAVITY * dt, 1200);
    this.y += this.vy * dt;
    this.grounded = false;
    this.resolveVertical(prevFeet);

    const gy = groundY(this.x);
    if (this.y >= gy) {
      if (!this.grounded && this.vy > 60) this.onLand();
      this.y = gy;
      this.vy = 0;
      this.grounded = true;
    }

    // ---------------------------------------------------------- Wasser
    const wet = inDitch(this.x) && this.y > WATER_Y;
    this.inWater = wet;
    if (wet && !this.wasInWater) this.justSplashed = true;
    this.wasInWater = wet;

    // ---------------------------------------------------------- Schrittzyklus
    const prevPhase = this.walkPhase;
    if (this.grounded && Math.abs(this.vx) > 6) {
      this.walkPhase += (Math.abs(this.vx) / 26) * dt * Math.PI;
      if (Math.floor(prevPhase / Math.PI) !== Math.floor(this.walkPhase / Math.PI)) {
        this.stepped = true;
      }
    } else if (!this.grounded) {
      this.walkPhase = damp(this.walkPhase, Math.round(this.walkPhase / Math.PI) * Math.PI, 6, dt);
    }

    // ---------------------------------------------------------- Lautstaerke
    this.landNoise = Math.max(0, this.landNoise - dt * 2.2);
    const ratio = Math.abs(this.vx) / RUN_SPEED;
    const moveNoise = ratio < 0.06 ? 0 : 0.16 + ratio * 0.88;
    this.noiseLevel = clamp(Math.max(moveNoise, this.landNoise), 0, 1);
  }

  private onLand(): void {
    this.landImpact = clamp(this.vy / 520, 0, 1);
    this.justLanded = this.landImpact;
    this.landNoise = Math.max(this.landNoise, 0.55 + this.landImpact * 0.45);
  }

  private resolveHorizontal(): void {
    const top = this.y - HEIGHT;
    for (const s of SOLIDS) {
      if (this.x + HALF_W <= s.x || this.x - HALF_W >= s.x + s.w) continue;
      if (this.y <= s.y + 1 || top >= s.y + s.h) continue;
      const fromLeft = this.x + HALF_W - s.x;
      const fromRight = s.x + s.w - (this.x - HALF_W);
      if (fromLeft < fromRight) this.x = s.x - HALF_W;
      else this.x = s.x + s.w + HALF_W;
      this.vx = 0;
    }
  }

  private resolveVertical(prevFeet: number): void {
    for (const s of SOLIDS) {
      if (this.x + HALF_W <= s.x || this.x - HALF_W >= s.x + s.w) continue;

      if (this.vy >= 0 && prevFeet <= s.y + 2 && this.y > s.y) {
        if (!this.grounded && this.vy > 60) this.onLand();
        this.y = s.y;
        this.vy = 0;
        this.grounded = true;
      } else if (this.vy < 0) {
        const head = this.y - HEIGHT;
        const prevHead = prevFeet - HEIGHT;
        if (prevHead >= s.y + s.h - 2 && head < s.y + s.h && this.y > s.y + s.h) {
          this.y = s.y + s.h + HEIGHT;
          this.vy = 0;
        }
      }
    }
  }
}
