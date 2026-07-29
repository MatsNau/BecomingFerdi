import { makeNoise1D, mulberry32, rgba, TAU } from "../core/math.ts";
import { groundY, LEVEL, WATER_Y } from "../game/level.ts";
import { PAL } from "./palette.ts";

type Ctx = CanvasRenderingContext2D;

export interface View {
  w: number;
  h: number;
}

const hillFar = makeNoise1D(21);
const hillMid = makeNoise1D(88);
const fieldN = makeNoise1D(404);
const grassN = makeNoise1D(660);

const STAR_COUNT = 150;
const stars = (() => {
  const rng = mulberry32(4711);
  return Array.from({ length: STAR_COUNT }, () => ({
    x: rng() * 4200,
    y: rng() * 0.55,
    r: 0.5 + rng() * 1.1,
    tw: rng() * TAU,
  }));
})();

export function drawSky(ctx: Ctx, view: View, camX: number, time: number): void {
  const g = ctx.createLinearGradient(0, -30, 0, view.h);
  g.addColorStop(0, PAL.skyTop);
  g.addColorStop(0.42, PAL.skyMid);
  g.addColorStop(0.76, PAL.skyLow);
  g.addColorStop(1, PAL.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, view.w + 80, view.h + 80);

  // Sterne
  const off = camX * 0.03;
  for (const s of stars) {
    let sx = ((s.x - off) % 4200 + 4200) % 4200;
    if (sx > view.w + 20) continue;
    sx -= 10;
    const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.3 + s.tw));
    ctx.fillStyle = rgba(PAL.star, a * (1 - s.y * 0.9));
    ctx.beginPath();
    ctx.arc(sx, s.y * view.h, s.r, 0, TAU);
    ctx.fill();
  }

  // Mond
  const mx = view.w * 0.74 - camX * 0.012;
  const my = view.h * 0.15;
  const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 150);
  glow.addColorStop(0, rgba(PAL.moon, 0.2));
  glow.addColorStop(1, rgba(PAL.moon, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(mx, my, 150, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PAL.moon;
  ctx.beginPath();
  ctx.arc(mx, my, 23, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba("#c3cee6", 0.35);
  ctx.beginPath();
  ctx.arc(mx - 7, my - 5, 4.5, 0, TAU);
  ctx.arc(mx + 6, my + 6, 6, 0, TAU);
  ctx.arc(mx + 3, my - 9, 3, 0, TAU);
  ctx.fill();
}

function hillLayer(
  ctx: Ctx,
  view: View,
  camX: number,
  factor: number,
  baseY: number,
  amp: number,
  freq: number,
  color: string,
  noise: (x: number) => number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, view.h + 40);
  for (let sx = -20; sx <= view.w + 20; sx += 12) {
    const wx = camX * factor + sx;
    ctx.lineTo(sx, baseY + noise(wx * freq) * amp);
  }
  ctx.lineTo(view.w + 20, view.h + 40);
  ctx.closePath();
  ctx.fill();
}

function church(ctx: Ctx, view: View, camX: number, factor: number, baseY: number): void {
  const sx = 1180 - camX * factor;
  if (sx < -80 || sx > view.w + 80) return;
  const y = baseY + hillFar(1180 * factor * 0.004) * 16;
  ctx.fillStyle = PAL.hillMid;
  ctx.beginPath();
  ctx.moveTo(sx - 13, y);
  ctx.lineTo(sx - 13, y - 62);
  ctx.lineTo(sx, y - 92);
  ctx.lineTo(sx + 13, y - 62);
  ctx.lineTo(sx + 13, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(sx + 12, y - 34, 44, 34);
  ctx.fillStyle = rgba(PAL.windowLight, 0.5);
  ctx.beginPath();
  ctx.arc(sx, y - 62, 4, 0, TAU);
  ctx.fill();
}

function treeLine(ctx: Ctx, view: View, camX: number, factor: number, baseY: number): void {
  const spacing = 96;
  const x0 = camX * factor - 60;
  const i0 = Math.floor(x0 / spacing);
  const i1 = Math.ceil((x0 + view.w + 120) / spacing);
  ctx.fillStyle = PAL.treeLine;
  for (let i = i0; i <= i1; i++) {
    const rng = mulberry32(i * 7919 + 13);
    const wx = i * spacing + rng() * spacing * 0.7;
    const sx = wx - camX * factor;
    const h = 52 + rng() * 46;
    const w = 22 + rng() * 20;
    const y = baseY + hillMid(wx * 0.004) * 10;
    ctx.beginPath();
    ctx.moveTo(sx - w * 0.18, y + 6);
    ctx.lineTo(sx - w * 0.18, y - h * 0.5);
    ctx.lineTo(sx + w * 0.18, y - h * 0.5);
    ctx.lineTo(sx + w * 0.18, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx, y - h * 0.62, w * 0.62, h * 0.46, 0, 0, TAU);
    ctx.fill();
  }
}

export function drawFarLayers(ctx: Ctx, view: View, camX: number, camY: number, time: number): void {
  const horizon = view.h * 0.58 - camY * 0.06;

  hillLayer(ctx, view, camX, 0.1, horizon - 22, 16, 0.0011, PAL.hillFar, hillFar);
  church(ctx, view, camX, 0.1, horizon - 22);
  hillLayer(ctx, view, camX, 0.2, horizon + 4, 13, 0.0022, PAL.hillMid, hillMid);

  // Nebelband ueber dem Feld
  const fog = ctx.createLinearGradient(0, horizon - 26, 0, horizon + 60);
  fog.addColorStop(0, rgba("#7f9bc4", 0));
  fog.addColorStop(0.5, rgba("#7f9bc4", 0.075));
  fog.addColorStop(1, rgba("#7f9bc4", 0));
  ctx.fillStyle = fog;
  ctx.fillRect(-20, horizon - 26, view.w + 40, 86);

  treeLine(ctx, view, camX, 0.34, horizon + 30);
  hillLayer(ctx, view, camX, 0.52, horizon + 52, 10, 0.0038, PAL.fieldFar, fieldN);

  // Ferne Feldreihen als angedeutete Struktur
  ctx.strokeStyle = rgba("#22344f", 0.5);
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const sx = ((i * 74 - camX * 0.62) % (view.w + 160) + view.w + 160) % (view.w + 160) - 80;
    const y = horizon + 60 + (i % 5) * 6;
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.lineTo(sx + 34, y + 3);
    ctx.stroke();
  }

  hillLayer(
    ctx,
    view,
    camX,
    0.74,
    horizon + 84 + Math.sin(time * 0.1) * 0.5,
    9,
    0.0055,
    PAL.fieldNear,
    grassN,
  );
}

/** Boden, Grasnarbe und Grabenwasser - wird im Weltkoordinatensystem gezeichnet. */
export function drawGround(ctx: Ctx, x0: number, x1: number, bottom: number): void {
  const step = 10;
  ctx.fillStyle = PAL.ground;
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let x = x0; x <= x1; x += step) ctx.lineTo(x, groundY(x));
  ctx.lineTo(x1, bottom);
  ctx.closePath();
  ctx.fill();

  // Grasnarbe / Wegkante
  ctx.strokeStyle = PAL.groundTop;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += step) {
    const y = groundY(x);
    if (x === x0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Grasbueschel auf der Weide
  ctx.strokeStyle = rgba("#1d2c44", 0.75);
  ctx.lineWidth = 1.4;
  const gs = 13;
  const gi0 = Math.floor(x0 / gs);
  const gi1 = Math.ceil(x1 / gs);
  for (let i = gi0; i <= gi1; i++) {
    const wx = i * gs;
    if (wx < LEVEL.pastureIn - 200 || wx > LEVEL.pastureOut + 200) continue;
    const gy = groundY(wx);
    const h = 4 + Math.abs(grassN(wx * 0.6)) * 7;
    ctx.beginPath();
    ctx.moveTo(wx, gy);
    ctx.lineTo(wx + grassN(wx * 0.3) * 3, gy - h);
    ctx.stroke();
  }

  // Wasser im Graben
  const d = LEVEL.ditch;
  if (x1 > d.center - d.half && x0 < d.center + d.half) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d.center - d.half, WATER_Y);
    for (let x = d.center - d.half; x <= d.center + d.half; x += 6) ctx.lineTo(x, groundY(x));
    ctx.lineTo(d.center + d.half, WATER_Y);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = PAL.water;
    ctx.fillRect(d.center - d.half, WATER_Y, d.half * 2, 120);
    ctx.fillStyle = rgba(PAL.waterGlint, 0.3);
    ctx.fillRect(d.center - d.half, WATER_Y, d.half * 2, 2.5);
    ctx.restore();
  }
}

/** Dunkles, unscharfes Gras direkt vor der Kamera. */
export function drawForeground(ctx: Ctx, view: View, camX: number, time: number): void {
  const factor = 1.32;
  const base = view.h + 12;
  ctx.fillStyle = PAL.fore;
  ctx.beginPath();
  ctx.moveTo(-20, view.h + 40);
  for (let sx = -20; sx <= view.w + 20; sx += 9) {
    const wx = camX * factor + sx;
    const sway = Math.sin(time * 0.9 + wx * 0.02) * 3;
    ctx.lineTo(sx, base - 26 - Math.abs(grassN(wx * 0.02)) * 26 + sway);
  }
  ctx.lineTo(view.w + 20, view.h + 40);
  ctx.closePath();
  ctx.fill();

  // einzelne Halme
  ctx.strokeStyle = PAL.fore;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  for (let i = 0; i < 40; i++) {
    const wx = camX * factor + i * 31;
    const sx = wx - camX * factor;
    if (sx < -20 || sx > view.w + 20) continue;
    const h = 22 + Math.abs(grassN(wx * 0.05 + 9)) * 40;
    const sway = Math.sin(time * 1.1 + i) * 5;
    ctx.beginPath();
    ctx.moveTo(sx, base);
    ctx.quadraticCurveTo(sx + sway * 0.4, base - h * 0.6, sx + sway, base - h);
    ctx.stroke();
  }
}

/** Leichte Schwaden, die ueber den Feldweg treiben. */
export function drawMist(ctx: Ctx, view: View, camX: number, time: number, strength: number): void {
  if (strength <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = strength;
  for (let i = 0; i < 4; i++) {
    const sx = ((i * 380 - camX * 0.86 + time * 6) % (view.w + 760) + view.w + 760) % (view.w + 760) - 380;
    const y = view.h * 0.74 + i * 14;
    const g = ctx.createLinearGradient(sx - 200, y, sx + 200, y);
    g.addColorStop(0, rgba("#93aed6", 0));
    g.addColorStop(0.5, rgba("#93aed6", 0.07));
    g.addColorStop(1, rgba("#93aed6", 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(sx, y, 200, 22, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
