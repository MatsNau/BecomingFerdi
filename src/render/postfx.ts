import type { Screen } from "../core/screen.ts";
import { clamp, mulberry32, rgba } from "../core/math.ts";

export interface PostOptions {
  /** 0..1 - Staerke von Doppelbild, Unschaerfe und Schwanken. */
  drunk: number;
  rotation: number;
  shakeX: number;
  shakeY: number;
  time: number;
  /** 0 = normal, 1 = komplett schwarz. */
  fade: number;
  /** Kurzes Aufblitzen, z.B. wenn die Herde losrennt. */
  flash: number;
}

const GRAIN_SIZE = 96;

export class PostFX {
  private readonly grain: HTMLCanvasElement;

  constructor() {
    const c = document.createElement("canvas");
    c.width = GRAIN_SIZE;
    c.height = GRAIN_SIZE;
    const g = c.getContext("2d");
    if (g) {
      const img = g.createImageData(GRAIN_SIZE, GRAIN_SIZE);
      const rng = mulberry32(20260729);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (rng() - 0.5) * 150;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    this.grain = c;
  }

  /**
   * Setzt die fertige Szene auf den sichtbaren Canvas: gedreht, doppelt
   * gesehen und mit Vignette. Erst danach kommt das HUD obendrauf - das soll
   * scharf bleiben, sonst kann man die Texte nicht mehr lesen.
   */
  composite(screen: Screen, o: PostOptions): void {
    const ctx = screen.ctx;
    const W = screen.canvas.width;
    const H = screen.canvas.height;
    const k = screen.dpr * screen.scale;
    const drunk = clamp(o.drunk, 0, 1);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 + o.shakeX * k, H / 2 + o.shakeY * k);
    ctx.rotate(o.rotation);
    const zoom = 1.06 + drunk * 0.02;
    ctx.scale(zoom, zoom);
    ctx.drawImage(screen.scene, -W / 2, -H / 2);

    if (drunk > 0.05) {
      const dx = Math.sin(o.time * 0.83) * drunk * 9 * k;
      const dy = Math.cos(o.time * 0.61) * drunk * 4 * k;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = drunk * 0.3;
      ctx.drawImage(screen.scene, -W / 2 + dx, -H / 2 + dy);
      ctx.globalAlpha = drunk * 0.17;
      ctx.drawImage(screen.scene, -W / 2 - dx * 0.75, -H / 2 - dy * 0.75);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Ab hier wieder in virtuellen Koordinaten.
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const vw = screen.viewW;
    const vh = screen.viewH;

    // Vignette
    const r = Math.hypot(vw, vh) * 0.5;
    const vg = ctx.createRadialGradient(vw / 2, vh * 0.52, r * 0.32, vw / 2, vh * 0.52, r);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,0,0,${0.55 + drunk * 0.2})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, vw, vh);

    // Filmkorn
    const pattern = ctx.createPattern(this.grain, "repeat");
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.05 + drunk * 0.03;
      ctx.translate(-Math.random() * GRAIN_SIZE, -Math.random() * GRAIN_SIZE);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, vw + GRAIN_SIZE, vh + GRAIN_SIZE);
      ctx.restore();
    }

    if (o.flash > 0.01) {
      ctx.fillStyle = rgba("#ffd9b0", o.flash * 0.5);
      ctx.fillRect(0, 0, vw, vh);
    }
    if (o.fade > 0.001) {
      ctx.fillStyle = `rgba(3,5,10,${clamp(o.fade, 0, 1)})`;
      ctx.fillRect(0, 0, vw, vh);
    }
  }
}
