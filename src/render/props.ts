import { clamp, lerp, mulberry32, rgba, TAU } from "../core/math.ts";
import type { Cow } from "../game/cows.ts";
import { BALE_H, BALE_W, GATE_H, groundY } from "../game/level.ts";
import { VILLAGE } from "../game/story.ts";
import { PAL } from "./palette.ts";

type Ctx = CanvasRenderingContext2D;

function warmGlow(ctx: Ctx, x: number, y: number, r: number, alpha: number, color: string = PAL.warmLight) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.32));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** Lichtkegel, der auf dem Boden auslaeuft. */
function lightPool(ctx: Ctx, x: number, gy: number, w: number, alpha: number) {
  const g = ctx.createRadialGradient(x, gy, 0, x, gy, w);
  g.addColorStop(0, rgba(PAL.warmLight, alpha));
  g.addColorStop(1, rgba(PAL.warmLight, 0));
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(1, 0.24);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, w, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------- Festzelt

export function drawTent(ctx: Ctx, x: number, t: number): void {
  const gy = groundY(x);
  const left = x - 220;
  const right = x + 200;
  const top = gy - 196;
  const eave = gy - 104;

  lightPool(ctx, right - 4, gy, 190, 0.3);

  // Zeltkoerper
  ctx.fillStyle = "#0d1422";
  ctx.beginPath();
  ctx.moveTo(left, gy);
  ctx.lineTo(left, eave);
  ctx.quadraticCurveTo(x - 130, top - 18, x - 8, top);
  ctx.quadraticCurveTo(x + 120, top - 14, right, eave);
  ctx.lineTo(right, gy);
  ctx.closePath();
  ctx.fill();

  // Bahnen im Zeltdach
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba("#1d2a42", 0.85);
  ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const px = lerp(left, right, i / 10);
    ctx.beginPath();
    ctx.moveTo(px, gy);
    ctx.lineTo(lerp(px, x - 6, 0.55), top - 4);
    ctx.stroke();
  }
  ctx.restore();

  // Eingang mit Licht und Leuten
  const doorX = right - 74;
  const doorW = 66;
  const doorH = 108;
  ctx.fillStyle = rgba(PAL.warmDeep, 0.9);
  ctx.beginPath();
  ctx.roundRect(doorX, gy - doorH, doorW, doorH, [26, 26, 0, 0]);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(doorX, gy - doorH, doorW, doorH, [26, 26, 0, 0]);
  ctx.clip();
  const g = ctx.createLinearGradient(0, gy - doorH, 0, gy);
  g.addColorStop(0, rgba("#ffe0a8", 0.95));
  g.addColorStop(1, rgba(PAL.warmDeep, 0.55));
  ctx.fillStyle = g;
  ctx.fillRect(doorX, gy - doorH, doorW, doorH);

  // Tanzende Silhouetten
  ctx.fillStyle = rgba("#1a0d06", 0.85);
  for (let i = 0; i < 3; i++) {
    const px = doorX + 14 + i * 20;
    const bounce = Math.abs(Math.sin(t * 3.2 + i * 1.7)) * 5;
    const h = 62 + i * 4;
    ctx.beginPath();
    ctx.ellipse(px, gy - h - bounce, 5.5, 6.5, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(px - 6, gy - h + 5 - bounce, 12, h - 4, 5);
    ctx.fill();
  }
  ctx.restore();

  warmGlow(ctx, doorX + doorW / 2, gy - 60, 150, 0.3);

  // Abspannseile
  ctx.strokeStyle = rgba("#26344c", 0.9);
  ctx.lineWidth = 1.4;
  for (const [ax, ay, bx] of [
    [left, eave + 6, left - 46],
    [right, eave + 6, right + 44],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, groundY(bx));
    ctx.stroke();
  }

  // Bierbaenke davor
  ctx.fillStyle = "#131c2c";
  for (const bx of [x + 236, x + 320]) {
    const by = groundY(bx);
    ctx.fillRect(bx - 34, by - 27, 68, 6);
    ctx.fillRect(bx - 30, by - 21, 4, 21);
    ctx.fillRect(bx + 26, by - 21, 4, 21);
  }
}

// ---------------------------------------------------------------- Dönerbude

export function drawDoner(ctx: Ctx, x: number, t: number, active: boolean): void {
  const gy = groundY(x);
  const w = 212;
  const h = 108;
  const left = x - w / 2;
  const top = gy - h - 26;

  lightPool(ctx, x, gy, 150, 0.26);

  // Räder
  ctx.fillStyle = "#080d16";
  for (const wx of [left + 40, left + w - 40]) {
    ctx.beginPath();
    ctx.arc(wx, gy - 12, 13, 0, TAU);
    ctx.fill();
  }

  // Wagenkasten
  ctx.fillStyle = "#1b2536";
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, 7);
  ctx.fill();
  ctx.fillStyle = "#121a28";
  ctx.fillRect(left, gy - 26, w, 14);

  // Verkaufsfenster
  const fx = left + 46;
  const fy = top + 22;
  const fw = 120;
  const fh = 54;
  const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
  g.addColorStop(0, "#ffe6b0");
  g.addColorStop(1, "#ffa945");
  ctx.fillStyle = g;
  ctx.fillRect(fx, fy, fw, fh);

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();

  // Dönerspieß
  ctx.fillStyle = rgba("#5d2f14", 0.92);
  ctx.beginPath();
  ctx.moveTo(fx + 18, fy + 6);
  ctx.quadraticCurveTo(fx + 33, fy + 22, fx + 27, fy + fh);
  ctx.lineTo(fx + 9, fy + fh);
  ctx.quadraticCurveTo(fx + 5, fy + 20, fx + 18, fy + 6);
  ctx.closePath();
  ctx.fill();

  // Der Mann am Spieß
  ctx.fillStyle = rgba("#2a1608", 0.88);
  const sway = Math.sin(t * 1.4) * 2;
  ctx.beginPath();
  ctx.arc(fx + 78 + sway, fy + 17, 9, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(fx + 63 + sway, fy + 26, 30, fh, 7);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#0b1220";
  ctx.lineWidth = 3;
  ctx.strokeRect(fx, fy, fw, fh);

  // Markise
  ctx.fillStyle = "#222f42";
  ctx.beginPath();
  ctx.moveTo(fx - 12, fy - 6);
  ctx.lineTo(fx + fw + 12, fy - 6);
  ctx.lineTo(fx + fw + 26, fy - 24);
  ctx.lineTo(fx - 26, fy - 24);
  ctx.closePath();
  ctx.fill();

  // Schild
  ctx.fillStyle = active ? PAL.accent : "#8a7a5c";
  ctx.font = "700 19px 'Trebuchet MS', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DIYARO", x + 6, top - 14);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  warmGlow(ctx, fx + fw / 2, fy + fh / 2, 170, 0.28);

  // Dampf
  ctx.fillStyle = rgba("#c9d6ea", 0.05);
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.25 + i * 0.33) % 1;
    ctx.beginPath();
    ctx.arc(x + 70 + Math.sin(p * 5 + i) * 10, top - 20 - p * 60, 8 + p * 20, 0, TAU);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ Zuhause

export function drawHome(ctx: Ctx, x: number, t: number): void {
  const gy = groundY(x);
  const w = 250;
  const left = x - w / 2;
  const wallH = 130;
  const roofH = 70;

  lightPool(ctx, x - 40, gy, 130, 0.2);

  ctx.fillStyle = "#0c1322";
  ctx.beginPath();
  ctx.moveTo(left - 16, gy - wallH);
  ctx.lineTo(x, gy - wallH - roofH);
  ctx.lineTo(left + w + 16, gy - wallH);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(left, gy - wallH, w, wallH);

  // Küchenfenster - hier wartet die Familie
  const wx = x + 44;
  const wy = gy - 104;
  const flick = 0.9 + Math.sin(t * 2.3) * 0.05;
  ctx.fillStyle = rgba(PAL.windowLight, 0.92 * flick);
  ctx.fillRect(wx, wy, 52, 44);
  ctx.strokeStyle = "#0b1220";
  ctx.lineWidth = 3.5;
  ctx.strokeRect(wx, wy, 52, 44);
  ctx.beginPath();
  ctx.moveTo(wx + 26, wy);
  ctx.lineTo(wx + 26, wy + 44);
  ctx.moveTo(wx, wy + 22);
  ctx.lineTo(wx + 52, wy + 22);
  ctx.stroke();
  warmGlow(ctx, wx + 26, wy + 22, 130, 0.24, PAL.windowLight);

  // Haustür bei doorX (= x - 40)
  const dx = x - 40;
  ctx.fillStyle = "#070c16";
  ctx.beginPath();
  ctx.roundRect(dx - 21, gy - 86, 42, 86, [4, 4, 0, 0]);
  ctx.fill();
  ctx.fillStyle = rgba(PAL.warmLight, 0.8);
  ctx.beginPath();
  ctx.arc(dx + 12, gy - 44, 2.4, 0, TAU);
  ctx.fill();

  // Aussenlampe
  ctx.fillStyle = rgba(PAL.warmLight, 0.85);
  ctx.beginPath();
  ctx.arc(dx, gy - 96, 4.5, 0, TAU);
  ctx.fill();
  warmGlow(ctx, dx, gy - 96, 90, 0.3);

  // Gartenzaun
  ctx.strokeStyle = "#101a2b";
  ctx.lineWidth = 4;
  for (let px = left - 90; px < left + 6; px += 16) {
    const py = groundY(px);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - 34);
    ctx.stroke();
  }
}

// ------------------------------------------------------------- Kleinkulissen

export function drawLamp(ctx: Ctx, x: number): void {
  const gy = groundY(x);
  const h = 152;
  lightPool(ctx, x + 16, gy, 110, 0.22);
  ctx.strokeStyle = "#0e1729";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, gy);
  ctx.lineTo(x, gy - h);
  ctx.quadraticCurveTo(x, gy - h - 16, x + 20, gy - h - 14);
  ctx.stroke();
  ctx.fillStyle = rgba(PAL.warmLight, 0.92);
  ctx.beginPath();
  ctx.ellipse(x + 22, gy - h - 11, 7, 4.5, 0, 0, TAU);
  ctx.fill();
  warmGlow(ctx, x + 22, gy - h - 10, 120, 0.26);
}

export function drawSign(ctx: Ctx, x: number): void {
  const gy = groundY(x);
  ctx.strokeStyle = "#0e1729";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, gy);
  ctx.lineTo(x, gy - 74);
  ctx.stroke();

  ctx.fillStyle = "#c8bf87";
  ctx.beginPath();
  ctx.roundRect(x - 52, gy - 106, 104, 34, 3);
  ctx.fill();
  ctx.strokeStyle = "#0b1220";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x - 52, gy - 106, 104, 34);

  ctx.fillStyle = "#141a26";
  ctx.font = "700 15px 'Trebuchet MS', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(VILLAGE.toUpperCase(), x, gy - 88);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function drawBusstop(ctx: Ctx, x: number): void {
  const gy = groundY(x);
  ctx.fillStyle = "#0d1524";
  ctx.beginPath();
  ctx.roundRect(x - 54, gy - 86, 108, 8, 3);
  ctx.fill();
  ctx.fillRect(x - 52, gy - 80, 5, 80);
  ctx.fillRect(x + 47, gy - 80, 5, 80);
  ctx.fillRect(x - 52, gy - 80, 104, 44);
  ctx.fillStyle = "#111b2c";
  ctx.fillRect(x - 40, gy - 30, 80, 6);
  ctx.fillRect(x - 36, gy - 24, 4, 24);
  ctx.fillRect(x + 32, gy - 24, 4, 24);
}

export function drawPole(ctx: Ctx, x: number): void {
  const gy = groundY(x);
  const h = 210;
  ctx.strokeStyle = "#0a1120";
  ctx.lineWidth = 6;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(x, gy);
  ctx.lineTo(x, gy - h);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 24, gy - h + 16);
  ctx.lineTo(x + 24, gy - h + 16);
  ctx.moveTo(x - 18, gy - h + 34);
  ctx.lineTo(x + 18, gy - h + 34);
  ctx.stroke();
}

export function drawBale(ctx: Ctx, x: number): void {
  const gy = groundY(x);
  const top = gy - BALE_H;
  ctx.fillStyle = "#141d2c";
  ctx.beginPath();
  ctx.roundRect(x - BALE_W / 2, top, BALE_W, BALE_H, 8);
  ctx.fill();
  ctx.strokeStyle = rgba("#243450", 0.8);
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 5; i++) {
    const yy = top + (BALE_H / 5) * i;
    ctx.beginPath();
    ctx.moveTo(x - BALE_W / 2 + 4, yy);
    ctx.lineTo(x + BALE_W / 2 - 4, yy);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba("#3d527a", 0.5);
  ctx.lineWidth = 2;
  for (const ox of [-18, 18]) {
    ctx.beginPath();
    ctx.moveTo(x + ox, top);
    ctx.lineTo(x + ox, gy);
    ctx.stroke();
  }
  ctx.fillStyle = rgba("#2c3f5e", 0.55);
  ctx.beginPath();
  ctx.roundRect(x - BALE_W / 2, top, BALE_W, 6, [8, 8, 0, 0]);
  ctx.fill();
}

export function drawFence(ctx: Ctx, x: number): void {
  const gy = groundY(x);
  ctx.strokeStyle = "#0c1524";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  // Der Draht laeuft ins Feld hinein - deshalb steigt er zum Horizont.
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    for (let i = 1; i <= 5; i++) {
      const px = x + dir * i * 34;
      const py = groundY(px) - 12 - i * 5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - 30 + i * 3);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x + dir * 12, gy - 34);
    ctx.lineTo(x + dir * 5 * 34, groundY(x + dir * 170) - 44);
    ctx.stroke();
    ctx.restore();
  }

  // Durchgang: hier muss gesprungen werden
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - 9, gy);
  ctx.lineTo(x - 9, gy - GATE_H);
  ctx.moveTo(x + 9, gy);
  ctx.lineTo(x + 9, gy - GATE_H);
  ctx.stroke();
  ctx.lineWidth = 4;
  for (const yy of [GATE_H - 6, GATE_H * 0.6, GATE_H * 0.28]) {
    ctx.beginPath();
    ctx.moveTo(x - 10, gy - yy);
    ctx.lineTo(x + 10, gy - yy);
    ctx.stroke();
  }
}

export function drawTrough(ctx: Ctx, x: number): void {
  const gy = groundY(x);
  ctx.fillStyle = "#0f1828";
  ctx.beginPath();
  ctx.roundRect(x - 38, gy - 26, 76, 26, [3, 3, 7, 7]);
  ctx.fill();
  ctx.fillStyle = rgba(PAL.waterGlint, 0.22);
  ctx.beginPath();
  ctx.roundRect(x - 33, gy - 22, 66, 5, 3);
  ctx.fill();
}

export function drawBush(ctx: Ctx, x: number, seed: number): void {
  const gy = groundY(x);
  const rng = mulberry32(seed * 977);
  ctx.fillStyle = "#0a1120";
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const bx = x + (rng() - 0.5) * 62;
    const by = gy - rng() * 26;
    ctx.moveTo(bx, by);
    ctx.arc(bx, by, 12 + rng() * 13, 0, TAU);
  }
  ctx.fill();
}

// ------------------------------------------------------------------- Kuehe

const COW_LEN = 104;

export function drawCow(ctx: Ctx, cow: Cow, t: number): void {
  const gy = cow.groundY;
  const depth = cow.depth;
  const scale = 1 + depth * 0.11;
  const yOff = depth * 15;

  ctx.save();
  ctx.translate(cow.x, gy + yOff);
  ctx.scale(scale, scale);

  const panic = cow.panic;
  const gallop = panic > 0 ? Math.abs(Math.sin(t * 11)) * 9 : 0;
  ctx.translate(0, -gallop);
  ctx.rotate(panic * -0.12);

  // Schatten
  ctx.fillStyle = rgba("#000000", 0.3);
  ctx.beginPath();
  ctx.ellipse(0, gallop + 1, COW_LEN * 0.44, 5, 0, 0, TAU);
  ctx.fill();

  const bodyTop = -96;
  const bodyBot = -46;
  const front = -COW_LEN / 2;
  const back = COW_LEN / 2;

  // Beine
  ctx.strokeStyle = "#aeb6c3";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  const legPhase = panic > 0 ? t * 11 : t * 0.5 + cow.baseX;
  for (const [lx, off] of [
    [front + 16, 0],
    [front + 26, Math.PI],
    [back - 16, Math.PI * 0.6],
    [back - 26, Math.PI * 1.6],
  ] as const) {
    const swing = panic > 0 ? Math.sin(legPhase + off) * 13 : Math.sin(legPhase + off) * 1.2;
    ctx.beginPath();
    ctx.moveTo(lx, bodyBot - 2);
    ctx.lineTo(lx + swing * 0.4, (bodyBot - 2) / 2);
    ctx.lineTo(lx + swing, -gallop);
    ctx.stroke();
  }

  // Rumpf
  ctx.fillStyle = PAL.cowBody;
  ctx.beginPath();
  ctx.moveTo(front + 4, bodyBot + 4);
  ctx.quadraticCurveTo(front - 6, bodyTop + 16, front + 20, bodyTop + 2);
  ctx.quadraticCurveTo(0, bodyTop - 5, back - 14, bodyTop + 4);
  ctx.quadraticCurveTo(back + 8, bodyTop + 14, back - 2, bodyBot + 2);
  ctx.quadraticCurveTo(0, bodyBot + 12, front + 4, bodyBot + 4);
  ctx.closePath();
  ctx.fill();

  // Flecken
  ctx.save();
  ctx.clip();
  ctx.fillStyle = PAL.cowPatch;
  const rng = mulberry32(Math.floor(cow.baseX));
  for (let i = 0; i < 4; i++) {
    const px = lerp(front + 6, back - 6, rng());
    const py = lerp(bodyTop + 2, bodyBot, rng());
    ctx.beginPath();
    ctx.ellipse(px, py, 9 + rng() * 14, 8 + rng() * 11, rng() * TAU, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = rgba(PAL.cowShade, 0.5);
  ctx.fillRect(front - 10, bodyBot - 12, COW_LEN + 20, 22);
  ctx.restore();

  // Schwanz
  ctx.strokeStyle = PAL.cowBody;
  ctx.lineWidth = 3;
  const tail = cow.tail * 0.35 + panic * 0.6;
  ctx.beginPath();
  ctx.moveTo(back - 6, bodyTop + 10);
  ctx.quadraticCurveTo(back + 12, bodyTop + 34, back + 8 + tail * 12, bodyBot + 6);
  ctx.stroke();
  ctx.fillStyle = PAL.cowPatch;
  ctx.beginPath();
  ctx.ellipse(back + 8 + tail * 12, bodyBot + 8, 3, 5, 0, 0, TAU);
  ctx.fill();

  // Hals und Kopf: unten im Gras oder oben und wach
  const h = cow.head;
  const neckRoot = { x: front + 16, y: bodyTop + 8 };
  const headX = lerp(front - 26, front - 34, h);
  const headY = lerp(-16, bodyTop - 6, h);
  const headAng = lerp(1.15, 0.18, h);

  ctx.strokeStyle = PAL.cowBody;
  ctx.lineWidth = 21;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(neckRoot.x, neckRoot.y);
  ctx.lineTo(lerp(headX + 14, headX + 16, h), lerp(headY - 10, headY + 12, h));
  ctx.stroke();

  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(headAng);

  ctx.fillStyle = PAL.cowBody;
  ctx.beginPath();
  ctx.roundRect(-13, -11, 34, 22, [10, 7, 7, 10]);
  ctx.fill();
  ctx.fillStyle = "#8c93a1";
  ctx.beginPath();
  ctx.ellipse(-10, 0, 6.5, 7.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PAL.cowPatch;
  ctx.beginPath();
  ctx.ellipse(-11.5, -2.6, 1.5, 1.2, 0, 0, TAU);
  ctx.ellipse(-11, 2.8, 1.5, 1.2, 0, 0, TAU);
  ctx.fill();

  // Ohren - zucken kurz bevor der Kopf hochgeht
  const twitch = Math.sin(t * 24) * cow.ears * 0.5;
  for (const sign of [-1, 1]) {
    ctx.save();
    ctx.translate(10, sign * 9);
    ctx.rotate(sign * (0.5 + h * 0.35) + twitch * sign);
    ctx.fillStyle = PAL.cowBody;
    ctx.beginPath();
    ctx.ellipse(6, 0, 8, 3.6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Auge - nur sichtbar, wenn der Kopf oben ist
  if (h > 0.12) {
    ctx.globalAlpha = clamp((h - 0.12) / 0.4, 0, 1);
    ctx.fillStyle = "#12161f";
    ctx.beginPath();
    ctx.ellipse(2, -4.5, 2.6, 2.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba("#dce6f6", 0.75);
    ctx.beginPath();
    ctx.arc(2.8, -5.2, 0.9, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Aufmerksamkeitsring
  if (cow.alert > 0.02 && panic <= 0) {
    const a = cow.alert;
    const ry = bodyTop - 34;
    ctx.save();
    ctx.translate(front - 30, ry);
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = rgba("#8fa6c6", 0.22);
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = a > 0.72 ? PAL.danger : a > 0.4 ? PAL.accent : "#cfe0f7";
    ctx.beginPath();
    ctx.arc(0, 0, 11, -Math.PI / 2, -Math.PI / 2 + TAU * a);
    ctx.stroke();
    if (a > 0.72) {
      ctx.fillStyle = PAL.danger;
      ctx.globalAlpha = 0.55 + Math.sin(t * 14) * 0.45;
      ctx.beginPath();
      ctx.roundRect(-1.6, -5, 3.2, 6.5, 1.6);
      ctx.arc(0, 3.6, 1.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
}
