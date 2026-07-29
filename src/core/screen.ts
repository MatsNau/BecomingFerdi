import { clamp } from "./math.ts";

/**
 * Virtuelle Aufloesung: Die Hoehe ist das Mass aller Dinge (540), die Breite
 * ergibt sich aus dem Seitenverhaeltnis. So gibt es auf keinem Handy schwarze
 * Balken - breite Geraete sehen einfach mehr vom Feldweg.
 */
const DESIGN_H = 500;
const MIN_W = 720;
const MAX_W = 1280;
const MAX_DPR = 2;

export class Screen {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  /** Sichtbarer Ausschnitt in virtuellen Einheiten. */
  viewW = 900;
  viewH = DESIGN_H;
  scale = 1;
  dpr = 1;

  /** Offscreen-Puffer fuer die Szene (wird fuer den Doppelbild-Effekt gebraucht). */
  readonly scene: HTMLCanvasElement;
  readonly sceneCtx: CanvasRenderingContext2D;

  private lastW = -1;
  private lastH = -1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D wird von diesem Browser nicht unterstuetzt.");
    this.ctx = ctx;

    this.scene = document.createElement("canvas");
    const sctx = this.scene.getContext("2d", { alpha: false });
    if (!sctx) throw new Error("Offscreen-Canvas nicht verfuegbar.");
    this.sceneCtx = sctx;

    this.resize();
  }

  get isPortrait(): boolean {
    return window.innerHeight > window.innerWidth;
  }

  resize(): void {
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    this.dpr = clamp(window.devicePixelRatio || 1, 1, MAX_DPR);

    let scale = cssH / DESIGN_H;
    let viewW = cssW / scale;
    if (viewW > MAX_W) scale = cssW / MAX_W;
    else if (viewW < MIN_W) scale = cssW / MIN_W;

    this.scale = scale;
    this.viewW = cssW / scale;
    this.viewH = cssH / scale;

    const pxW = Math.round(cssW * this.dpr);
    const pxH = Math.round(cssH * this.dpr);
    if (pxW === this.lastW && pxH === this.lastH) return;
    this.lastW = pxW;
    this.lastH = pxH;

    for (const c of [this.canvas, this.scene]) {
      c.width = pxW;
      c.height = pxH;
    }
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  /** Setzt beide Kontexte auf virtuelle Koordinaten zurueck. */
  beginFrame(): void {
    const k = this.dpr * this.scale;
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
    this.sceneCtx.setTransform(k, 0, 0, k, 0, 0);
  }
}
