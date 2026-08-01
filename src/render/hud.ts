import { clamp, rgba, TAU } from "../core/math.ts";
import { END, HUD, TITLE } from "../game/story.ts";
import { PAL } from "./palette.ts";
import type { View } from "./backdrop.ts";

type Ctx = CanvasRenderingContext2D;

/** letterSpacing kennen nicht alle TS-DOM-Versionen - deshalb weich angefasst. */
type SpacedCtx = Ctx & { letterSpacing?: string };

function font(ctx: Ctx, size: number, weight = 700, spacing = 0): void {
  ctx.font = `${weight} ${size}px 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif`;
  (ctx as SpacedCtx).letterSpacing = `${spacing}px`;
}

function resetSpacing(ctx: Ctx): void {
  (ctx as SpacedCtx).letterSpacing = "0px";
}

function center(ctx: Ctx, text: string, x: number, y: number, color: string, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Anzeige, wie sehr Ferdi noch schwankt. */
export function drawDrunkMeter(ctx: Ctx, drunk: number, pulse: number): void {
  const x = 22;
  const y = 24;
  const w = 116;
  const h = 7;
  const wobble = Math.sin(pulse * 3.1) * drunk * 1.6;

  ctx.save();
  ctx.translate(x, y + wobble);
  font(ctx, 10, 700, 2.2);
  ctx.fillStyle = rgba(PAL.textDim, 0.55);
  ctx.textBaseline = "alphabetic";
  ctx.fillText(HUD.drunk, 0, -7);

  ctx.fillStyle = rgba("#0a1020", 0.55);
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h / 2);
  ctx.fill();

  const fill = clamp(drunk, 0, 1) * w;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "#69d18a");
  g.addColorStop(0.55, PAL.accent);
  g.addColorStop(1, "#ff7a5c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0, 0, Math.max(fill, fill > 0 ? h : 0), h, h / 2);
  ctx.fill();
  ctx.restore();
  resetSpacing(ctx);
}

/** Textzeile unten - Erzaehlung und Hinweise. */
export function drawCaption(ctx: Ctx, view: View, text: string, alpha: number): void {
  if (alpha <= 0.01 || !text) return;
  const y = view.h - 74;
  ctx.save();
  font(ctx, 19, 700, 0.6);
  const w = ctx.measureText(text).width;
  ctx.globalAlpha = alpha * 0.55;
  ctx.fillStyle = "#03060c";
  ctx.beginPath();
  ctx.roundRect(view.w / 2 - w / 2 - 18, y - 18, w + 36, 36, 18);
  ctx.fill();
  ctx.restore();
  center(ctx, text, view.w / 2, y, PAL.text, alpha);
  resetSpacing(ctx);
}

/** Kleiner Hinweis direkt ueber Ferdi (Bildschirmkoordinaten). */
export function drawPrompt(ctx: Ctx, x: number, y: number, text: string, alpha: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  font(ctx, 13, 700, 1.2);
  center(ctx, text, x, y, PAL.accent, alpha);
  ctx.restore();
  resetSpacing(ctx);
}

/** Ladering beim Dönermann. */
export function drawOrderRing(ctx: Ctx, x: number, y: number, p: number): void {
  ctx.save();
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.strokeStyle = rgba("#ffffff", 0.18);
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = PAL.accent;
  ctx.beginPath();
  ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p, 0, 1));
  ctx.stroke();
  ctx.restore();
}

/** Roter Rand, wenn eine Kuh gleich genug hat. */
export function drawAlertEdge(ctx: Ctx, view: View, alert: number, time: number): void {
  if (alert <= 0.25) return;
  const a = ((alert - 0.25) / 0.75) ** 1.6;
  const pulse = alert > 0.7 ? 0.65 + Math.sin(time * 12) * 0.35 : 1;
  const g = ctx.createRadialGradient(
    view.w / 2,
    view.h / 2,
    Math.min(view.w, view.h) * 0.3,
    view.w / 2,
    view.h / 2,
    Math.hypot(view.w, view.h) * 0.52,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, rgba(PAL.danger, a * 0.38 * pulse));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);
}

export function drawTitle(ctx: Ctx, view: View, time: number, touch: boolean): void {
  const cx = view.w / 2;
  ctx.save();
  ctx.fillStyle = "rgba(3,5,10,0.55)";
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.restore();

  font(ctx, 13, 700, 5);
  center(ctx, TITLE.act + " — " + TITLE.subtitle.toUpperCase(), cx, view.h * 0.3, PAL.accent, 0.9);

  font(ctx, Math.min(58, view.w * 0.075), 700, 3);
  center(ctx, TITLE.game, cx, view.h * 0.43, PAL.text);

  const blink = 0.55 + Math.sin(time * 2.6) * 0.35;
  font(ctx, 16, 700, 1.4);
  center(ctx, touch ? TITLE.hintTouch : TITLE.hintKeys, cx, view.h * 0.62, PAL.text, blink);

  font(ctx, 13, 400, 0.8);
  center(
    ctx,
    touch ? TITLE.controlsTouch : TITLE.controlsKeys,
    cx,
    view.h * 0.74,
    PAL.textDim,
    0.85,
  );
  resetSpacing(ctx);
}

export function drawEndCard(ctx: Ctx, view: View, t: number, touch: boolean): void {
  const cx = view.w / 2;
  const step = (d: number) => clamp((t - d) / 0.7, 0, 1);

  font(ctx, 13, 700, 5);
  center(ctx, END.act, cx, view.h * 0.32, PAL.accent, step(0.2));

  font(ctx, Math.min(42, view.w * 0.055), 700, 1.5);
  center(ctx, END.line, cx, view.h * 0.44, PAL.text, step(0.6));

  font(ctx, 15, 700, 2);
  center(ctx, END.next, cx, view.h * 0.6, PAL.textDim, step(1.4));
  font(ctx, 12, 400, 3);
  center(ctx, END.nextNote.toUpperCase(), cx, view.h * 0.66, PAL.textDim, step(1.7) * 0.7);

  const blink = 0.5 + Math.sin(t * 2.6) * 0.3;
  font(ctx, 14, 700, 1.2);
  center(ctx, touch ? END.retryTouch : END.retryKeys, cx, view.h * 0.82, PAL.text, step(2.4) * blink);
  resetSpacing(ctx);
}
