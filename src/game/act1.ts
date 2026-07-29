import type { GameAudio } from "../core/audio.ts";
import type { Input } from "../core/input.ts";
import type { Screen } from "../core/screen.ts";
import { clamp, damp, lerp, makeNoise1D } from "../core/math.ts";
import { drawFarLayers, drawForeground, drawGround, drawMist, drawSky, type View } from "../render/backdrop.ts";
import { drawFerdi } from "../render/ferdi.ts";
import {
  drawAlertEdge,
  drawCaption,
  drawDrunkMeter,
  drawEndCard,
  drawOrderRing,
  drawPrompt,
  drawTitle,
} from "../render/hud.ts";
import type { PostFX } from "../render/postfx.ts";
import {
  drawBale,
  drawBush,
  drawBusstop,
  drawCow,
  drawDoner,
  drawFence,
  drawHome,
  drawLamp,
  drawPole,
  drawSign,
  drawTent,
  drawTrough,
} from "../render/props.ts";
import { Herd } from "./cows.ts";
import { groundY, LEVEL, PROPS, tentIntensity, warmthAt } from "./level.ts";
import { HEIGHT, Player, RUN_SPEED } from "./player.ts";
import { BEATS, HINTS } from "./story.ts";

type Mode = "title" | "play" | "stampede" | "arriving" | "done";

const START_DRUNK = 0.85;
const DONER_DRUNK = 0.26;
const ORDER_SECONDS = 1.4;

const camNoise = makeNoise1D(1234);

export class Act1 {
  private readonly player = new Player();
  private readonly herd = new Herd();

  private mode: Mode = "title";
  private modeT = 0;
  private time = 0;

  private camX = 0;
  private camY = 0;

  private airT = 0;
  private gait = 0;

  private caption = "";
  private captionT = 0;
  private captionDur = 0;
  private firedBeats = new Set<number>();

  private orderProgress = 0;
  private donerTaken = false;
  private donerMissed = false;
  private eatFrom = START_DRUNK;

  private fade = 1;
  private flash = 0;
  private shake = 0;
  private frightHinted = false;

  constructor(private readonly audio: GameAudio) {
    this.reset();
  }

  reset(): void {
    this.player.reset(LEVEL.startX);
    this.player.drunk = START_DRUNK;
    this.herd.reset();
    this.herd.scares = 0;
    this.mode = "title";
    this.modeT = 0;
    this.camX = LEVEL.startX - 420;
    this.camY = groundY(LEVEL.startX) - 340;
    this.caption = "";
    this.captionT = 0;
    this.firedBeats.clear();
    this.orderProgress = 0;
    this.donerTaken = false;
    this.donerMissed = false;
    this.fade = 1;
    this.flash = 0;
    this.shake = 0;
    this.frightHinted = false;
  }

  private say(text: string, seconds = 3.5): void {
    this.caption = text;
    this.captionDur = seconds;
    this.captionT = 0;
  }

  /** Untergrenze fuer den Restrausch - der Döner und der Schreck senken sie. */
  private get drunkFloor(): number {
    if (this.donerTaken) return 0.06;
    if (this.herd.scares >= 4) return 0.2;
    if (this.herd.scares >= 2) return 0.3;
    return 0.42;
  }

  update(dt: number, input: Input, view: View): void {
    this.time += dt;
    this.modeT += dt;
    input.setTime(this.time);

    this.captionT += dt;
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.shake = Math.max(0, this.shake - dt * 3.2);

    switch (this.mode) {
      case "title":
        this.fade = damp(this.fade, 0.0, 2.2, dt);
        if (this.modeT > 0.6 && input.consumeAnyPress()) {
          this.audio.unlock(this.time);
          this.mode = "play";
          this.modeT = 0;
          const first = BEATS[0];
          if (first) this.say(first.text, first.seconds ?? 3.5);
          this.firedBeats.add(0);
        }
        break;

      case "play":
        this.updatePlay(dt, input);
        break;

      case "stampede":
        this.updateStampede(dt);
        break;

      case "arriving":
        this.updateArriving(dt, input);
        break;

      case "done":
        this.fade = damp(this.fade, 0.82, 1.6, dt);
        if (this.modeT > 3.2 && input.consumeAnyPress()) this.reset();
        break;
    }

    this.updateCamera(dt, view);
    this.audio.update(dt, this.time, tentIntensity(this.player.x) * 0.9, this.fieldWind());
  }

  private fieldWind(): number {
    return clamp((this.player.x - 1900) / 900, 0, 1);
  }

  // ------------------------------------------------------------------ Spielen

  private updatePlay(dt: number, input: Input): void {
    const p = this.player;
    this.fade = damp(this.fade, 0, 2.4, dt);

    // Frische Luft ernuechtert langsam.
    p.drunk = Math.max(this.drunkFloor, p.drunk - dt * 0.006);

    if (p.state === "eating") {
      const t = clamp(p.stateT / 1.9, 0, 1);
      p.drunk = lerp(this.eatFrom, DONER_DRUNK, t * t * (3 - 2 * t));
      if (p.stateT >= 1.9) {
        p.state = "normal";
        p.stateT = 0;
        this.audio.chime();
        this.say(HINTS.donerDone, 3.2);
      }
    }

    p.update(dt, this.time, input);

    if (p.stepped) this.audio.step(p.speedRatio);
    if (p.justLanded > 0) {
      this.audio.land(p.justLanded);
      this.shake = Math.max(this.shake, p.justLanded * 2.4);
    }
    if (p.justSplashed) {
      this.audio.splash();
      this.say(HINTS.ditch, 2.6);
    }

    this.updateDoner(dt);
    this.updateBeats();

    // Die Kuehe hoeren erst zu, wenn er in ihre Naehe kommt.
    if (p.x > LEVEL.pastureIn - 500 && p.x < LEVEL.pastureOut + 300) {
      const result = this.herd.update(dt, this.time, p.x, p.noiseLevel, this.audio);
      if (result === "startled") this.startStampede();
    }

    if (p.x >= LEVEL.doorX - 120) {
      this.mode = "arriving";
      this.modeT = 0;
      p.state = "auto";
      p.autoDir = 1;
    }
  }

  private updateDoner(dt: number): void {
    const p = this.player;
    if (this.donerTaken || this.donerMissed || p.state === "eating") return;

    const zone = LEVEL.donerZone;
    const inZone = p.x > zone.x0 && p.x < zone.x1;

    if (inZone && p.grounded && Math.abs(p.vx) < 28) {
      this.orderProgress += dt / ORDER_SECONDS;
      if (this.orderProgress >= 1) {
        this.donerTaken = true;
        this.eatFrom = p.drunk;
        p.state = "eating";
        p.stateT = 0;
        p.vx = 0;
        this.audio.chomp();
      }
    } else if (inZone) {
      this.orderProgress = Math.max(0, this.orderProgress - dt * 1.1);
    } else {
      this.orderProgress = 0;
      if (p.x > zone.x1 + 110) {
        this.donerMissed = true;
        this.say(HINTS.donerMissed, 2.8);
      }
    }
  }

  private updateBeats(): void {
    const x = this.player.x;
    for (let i = 0; i < BEATS.length; i++) {
      if (this.firedBeats.has(i)) continue;
      const b = BEATS[i];
      if (!b || x < b.x) continue;
      this.firedBeats.add(i);
      this.say(b.text, b.seconds ?? 3.5);
    }
    // Der Kuh-Hinweis kommt direkt hinter dem Ortsschild der Weide.
    if (x > LEVEL.pastureIn + 40 && !this.firedBeats.has(-1)) {
      this.firedBeats.add(-1);
      this.say(HINTS.cows, 5);
    }
  }

  private startStampede(): void {
    this.mode = "stampede";
    this.modeT = 0;
    this.player.state = "down";
    this.player.stateT = 0;
    this.player.vx = 0;
    this.flash = 1;
    this.shake = 9;
    this.say(this.herd.scares > 1 ? HINTS.stampedeAgain : HINTS.stampede, 2.4);
  }

  private updateStampede(dt: number): void {
    const p = this.player;
    p.update(dt, this.time, IDLE_INPUT);
    this.herd.update(dt, this.time, p.x, 0, this.audio);
    this.shake = Math.max(this.shake, (1 - clamp(this.modeT / 0.9, 0, 1)) * 6);

    if (this.modeT > 1.15) this.fade = damp(this.fade, 1, 4.5, dt);
    if (this.modeT > 2.0) {
      const scares = this.herd.scares;
      this.herd.reset();
      this.herd.scares = scares;
      p.reset(LEVEL.checkpointX);
      p.drunk = Math.max(this.drunkFloor, p.drunk);
      this.mode = "play";
      this.modeT = 0;
      if (scares >= 2 && !this.frightHinted) {
        this.frightHinted = true;
        this.say(HINTS.soberedByFright, 3.6);
      } else {
        this.say(HINTS.cows, 3.4);
      }
    }
  }

  private updateArriving(dt: number, input: Input): void {
    const p = this.player;
    p.drunk = Math.max(0.05, p.drunk - dt * 0.05);

    if (p.x >= LEVEL.doorX) {
      p.autoDir = 0;
      if (this.modeT > 1.1 && this.fade < 0.02) this.audio.door();
      this.fade = damp(this.fade, 1, 1.5, dt);
      if (this.fade > 0.96) {
        this.mode = "done";
        this.modeT = 0;
      }
    }
    p.update(dt, this.time, IDLE_INPUT);
    if (p.stepped) this.audio.step(0.3);
    input.consumeAnyPress();
  }

  // ------------------------------------------------------------------ Kamera

  private updateCamera(dt: number, view: View): void {
    const p = this.player;
    const lookahead = p.facing * 40 * clamp(Math.abs(p.vx) / RUN_SPEED + 0.35, 0, 1);
    const tx = p.x - view.w * 0.42 + lookahead;
    const ty = p.y - view.h * 0.68;

    this.camX = damp(this.camX, tx, 4.2, dt);
    this.camY = damp(this.camY, ty, 3.0, dt);
    this.camX = clamp(this.camX, -300, LEVEL.endX + 260 - view.w);

    this.airT = damp(this.airT, p.grounded ? 0 : 1, 13, dt);
    this.gait = damp(this.gait, clamp(Math.abs(p.vx) / RUN_SPEED / 0.62, 0, 1), 8, dt);
  }

  // ---------------------------------------------------------------- Zeichnen

  render(screen: Screen, post: PostFX, input: Input): void {
    const sctx = screen.sceneCtx;
    const view: View = { w: screen.viewW, h: screen.viewH };
    const p = this.player;
    const camX = this.camX;
    const camY = this.camY;

    drawSky(sctx, view, camX, this.time);
    drawFarLayers(sctx, view, camX, camY, this.time);

    sctx.save();
    sctx.translate(-camX, -camY);

    const x0 = camX - 60;
    const x1 = camX + view.w + 60;
    drawGround(sctx, x0, x1, camY + view.h + 200);

    for (const prop of PROPS) {
      const margin = prop.kind === "tent" || prop.kind === "home" ? 520 : 260;
      if (prop.x < x0 - margin || prop.x > x1 + margin) continue;
      switch (prop.kind) {
        case "tent":
          drawTent(sctx, prop.x, this.time);
          break;
        case "lamp":
          drawLamp(sctx, prop.x);
          break;
        case "sign":
          drawSign(sctx, prop.x);
          break;
        case "busstop":
          drawBusstop(sctx, prop.x);
          break;
        case "doner":
          drawDoner(sctx, prop.x, this.time, !this.donerTaken && !this.donerMissed);
          break;
        case "pole":
          drawPole(sctx, prop.x);
          break;
        case "bale":
          drawBale(sctx, prop.x);
          break;
        case "fence":
          drawFence(sctx, prop.x);
          break;
        case "trough":
          drawTrough(sctx, prop.x);
          break;
        case "bush":
          drawBush(sctx, prop.x, prop.seed);
          break;
        case "home":
          drawHome(sctx, prop.x, this.time);
          break;
      }
    }

    for (const cow of this.herd.cows) {
      if (cow.depth <= 0.3 && cow.x > x0 - 200 && cow.x < x1 + 200) drawCow(sctx, cow, this.time);
    }

    drawFerdi(sctx, {
      x: p.x,
      y: p.y,
      facing: p.facing,
      phase: p.walkPhase,
      gait: this.gait,
      air: this.airT,
      vy: p.vy,
      lean: p.lean,
      drunk: p.drunk,
      state: p.state,
      stateT: p.stateT,
      warm: warmthAt(p.x),
      time: this.time,
      inWater: p.inWater,
    });

    for (const cow of this.herd.cows) {
      if (cow.depth > 0.3 && cow.x > x0 - 200 && cow.x < x1 + 200) drawCow(sctx, cow, this.time);
    }

    if (this.orderProgress > 0.01) {
      drawOrderRing(sctx, p.x, p.y - HEIGHT - 26, this.orderProgress);
    }

    sctx.restore();

    drawMist(sctx, view, camX, this.time, this.fieldWind() * 0.85);
    drawForeground(sctx, view, camX, this.time);

    // ------------------------------------------------------------ Nachbearbeitung
    const beat = this.audio.beatPulse * tentIntensity(p.x);
    post.composite(screen, {
      drunk: p.drunk,
      rotation: camNoise(this.time * 0.4) * p.drunk * 0.035,
      shakeX: (Math.random() - 0.5) * this.shake,
      shakeY: (Math.random() - 0.5) * this.shake - beat * 1.6,
      time: this.time,
      fade: this.fade,
      flash: this.flash,
    });

    // ------------------------------------------------------------------- HUD
    const ctx = screen.ctx;
    if (this.mode === "title") {
      drawTitle(ctx, view, this.time, input.touchVisible);
      return;
    }
    if (this.mode === "done") {
      drawEndCard(ctx, view, this.modeT, input.touchVisible);
      return;
    }

    drawDrunkMeter(ctx, p.drunk, this.time);
    drawAlertEdge(ctx, view, this.herd.maxAlert, this.time);

    if (!this.donerTaken && !this.donerMissed && this.orderProgress <= 0.01) {
      const zone = LEVEL.donerZone;
      const near = 1 - clamp(Math.abs(p.x - (zone.x0 + zone.x1) / 2) / 130, 0, 1);
      if (near > 0.05) {
        drawPrompt(ctx, p.x - camX, p.y - camY - HEIGHT - 30, HINTS.doner, near);
      }
    }

    const capAlpha =
      this.captionT < 0.35
        ? this.captionT / 0.35
        : clamp((this.captionDur - this.captionT) / 0.6, 0, 1);
    drawCaption(ctx, view, this.caption, capAlpha);
  }
}

/** Steuerung "aus" - fuer Zwischensequenzen. */
const IDLE_INPUT = {
  left: false,
  right: false,
  run: false,
  jumpHeld: false,
  consumeJump: () => false,
};
