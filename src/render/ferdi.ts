import { clamp, lerp, makeNoise1D, mixHex, rgba } from "../core/math.ts";
import { PAL } from "./palette.ts";

/**
 * Ferdi wird komplett prozedural gezeichnet - kein Spritesheet. Das kostet
 * etwas Mathe, dafuer laesst sich das Torkeln direkt in die Pose einrechnen.
 * Lokales System: Fuesse bei (0,0), oben ist -y, vorne ist +x.
 */

const HIP_Y = -39;
const SHOULDER_Y = -65;
const HEAD_Y = -77;
const HEAD_RX = 9.6;
const HEAD_RY = 11;

const THIGH = 20;
const SHIN = 19;
const UPPER_ARM = 15;
const FOREARM = 14;

const armNoise = makeNoise1D(515);

export interface FerdiPose {
  x: number;
  y: number;
  facing: 1 | -1;
  phase: number;
  gait: number;
  air: number;
  vy: number;
  lean: number;
  drunk: number;
  state: "normal" | "eating" | "down" | "auto";
  stateT: number;
  warm: number;
  time: number;
  inWater: boolean;
}

interface Pt {
  x: number;
  y: number;
}

/** Zwei-Knochen-IK: liefert das Gelenk zwischen Wurzel und (ggf. gekuerztem) Ziel. */
function ik(root: Pt, target: Pt, l1: number, l2: number, bend: number): { joint: Pt; end: Pt } {
  let dx = target.x - root.x;
  let dy = target.y - root.y;
  let d = Math.hypot(dx, dy) || 0.0001;
  const max = l1 + l2 - 0.01;
  if (d > max) {
    const s = max / d;
    dx *= s;
    dy *= s;
    d = max;
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d;
  const uy = dy / d;
  return {
    joint: { x: root.x + ux * a - uy * h * bend, y: root.y + uy * a + ux * h * bend },
    end: { x: root.x + dx, y: root.y + dy },
  };
}

function bone(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  c: Pt,
  width: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
}

function shoe(ctx: CanvasRenderingContext2D, ankle: Pt, knee: Pt, color: string): void {
  const ang = Math.atan2(ankle.x - knee.x, -(ankle.y - knee.y));
  ctx.save();
  ctx.translate(ankle.x, ankle.y);
  ctx.rotate(-ang * 0.35);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-4.5, -3.4, 12.5, 6.2, [3, 3, 2.2, 2.2]);
  ctx.fill();
  ctx.restore();
}

export function drawFerdi(ctx: CanvasRenderingContext2D, p: FerdiPose): void {
  const warm = clamp(p.warm, 0, 1);
  const C = {
    hair: mixHex(PAL.hair, "#2b2016", warm * 0.7),
    skin: mixHex(PAL.skin, "#cf9a63", warm * 0.8),
    skinLit: mixHex(PAL.skinLit, "#e8b478", warm * 0.8),
    jacket: mixHex(PAL.jacket, "#3f3427", warm * 0.65),
    jacketLit: mixHex(PAL.jacketLit, "#6b563c", warm * 0.7),
    jacketFar: mixHex("#1c232e", "#2c241a", warm * 0.6),
    shirt: mixHex(PAL.shirt, "#7a6242", warm * 0.6),
    jeans: mixHex(PAL.jeans, "#2c2721", warm * 0.55),
    jeansFar: mixHex("#171d27", "#231e19", warm * 0.55),
    shoe: mixHex(PAL.shoe, "#e4cba6", warm * 0.7),
    rim: mixHex(PAL.rimCold, PAL.rimWarm, warm),
  };

  // ------------------------------------------------------------- Bodenschatten
  const shadowW = lerp(26, 12, p.air);
  ctx.save();
  ctx.fillStyle = rgba("#000000", 0.34 * (1 - p.air * 0.7));
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 1, shadowW, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const down = p.state === "down";
  const downT = down ? clamp(p.stateT / 0.28, 0, 1) : 0;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.facing, 1);
  ctx.rotate(p.lean * 0.35 - downT * 1.42);
  if (down) ctx.translate(0, -2);

  // Im Graben steht er bis zu den Waden im Wasser -> unten abschneiden.
  if (p.inWater) {
    ctx.beginPath();
    ctx.rect(-60, -140, 120, 140 - 12);
    ctx.clip();
  }

  // ------------------------------------------------------------------- Posen
  const stride = (6 + 13 * p.gait) * (down ? 0.2 : 1);
  const lift = 3 + 11 * p.gait;
  const bob = -Math.abs(Math.cos(p.phase)) * 2.2 * p.gait;

  const footTarget = (offset: number): Pt => {
    const t = p.phase + offset;
    const s = Math.sin(t);
    const ground = { x: -Math.cos(t) * stride, y: s > 0 ? -s * lift : 0 };
    if (p.air <= 0.001) return ground;
    // Sprungpose: vorderes Bein streckt sich, hinteres zieht an.
    const rising = clamp(-p.vy / 420, 0, 1);
    const tuck = {
      x: lerp(-4, 11, offset === 0 ? 1 : 0) + rising * 2,
      y: lerp(-4, -15, offset === 0 ? rising * 0.35 : rising),
    };
    return { x: lerp(ground.x, tuck.x, p.air), y: lerp(ground.y, tuck.y, p.air) };
  };

  const hip: Pt = { x: 0, y: HIP_Y + bob };
  const shoulder: Pt = { x: p.lean * -4, y: SHOULDER_Y + bob };

  const legA = ik(hip, footTarget(0), THIGH, SHIN, 1);
  const legB = ik(hip, footTarget(Math.PI), THIGH, SHIN, 1);

  const armSwing = Math.cos(p.phase) * (4 + 9 * p.gait);
  const flail = armNoise(p.time * 1.6) * p.drunk * 5;
  const airArm = p.air * 12;

  let handA: Pt = { x: -armSwing + flail, y: shoulder.y + 26 - airArm };
  let handB: Pt = { x: armSwing - flail, y: shoulder.y + 26 - airArm * 0.6 };

  if (p.state === "eating") {
    const bite = Math.sin(p.stateT * 7) * 0.5 + 0.5;
    handA = { x: 7 + bite * 1.5, y: HEAD_Y + 6 + bite * 2 };
  }
  if (down) {
    handA = { x: -8, y: shoulder.y + 20 };
    handB = { x: 6, y: shoulder.y + 24 };
  }

  const armA = ik(shoulder, handA, UPPER_ARM, FOREARM, -1);
  const armB = ik(shoulder, handB, UPPER_ARM, FOREARM, -1);

  // ---------------------------------------------------- hintere Gliedmassen
  bone(ctx, hip, legB.joint, legB.end, 8.4, C.jeansFar);
  shoe(ctx, legB.end, legB.joint, mixHex(C.shoe, PAL.ink, 0.45));
  bone(ctx, shoulder, armB.joint, armB.end, 7, C.jacketFar);

  // ------------------------------------------------------------- Oberkoerper
  ctx.fillStyle = C.jacket;
  ctx.beginPath();
  ctx.moveTo(shoulder.x - 10.5, shoulder.y - 1);
  ctx.quadraticCurveTo(shoulder.x + 12, shoulder.y - 3.5, shoulder.x + 10, shoulder.y + 9);
  ctx.quadraticCurveTo(hip.x + 9.5, hip.y - 8, hip.x + 8, hip.y + 3);
  ctx.lineTo(hip.x - 8, hip.y + 3);
  ctx.quadraticCurveTo(hip.x - 10, hip.y - 12, shoulder.x - 10.5, shoulder.y - 1);
  ctx.closePath();
  ctx.fill();

  // Reissverschluss / offene Jacke, damit die Silhouette Struktur bekommt
  ctx.strokeStyle = C.shirt;
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(shoulder.x + 2.5, shoulder.y + 1);
  ctx.lineTo(hip.x + 1.5, hip.y - 4);
  ctx.stroke();

  ctx.fillStyle = C.jacketLit;
  ctx.beginPath();
  ctx.moveTo(shoulder.x - 10.5, shoulder.y - 1);
  ctx.quadraticCurveTo(shoulder.x + 2, shoulder.y - 4, shoulder.x + 9, shoulder.y + 1);
  ctx.lineTo(shoulder.x + 7.5, shoulder.y + 4.5);
  ctx.quadraticCurveTo(shoulder.x + 1, shoulder.y + 1.5, shoulder.x - 9.5, shoulder.y + 3);
  ctx.closePath();
  ctx.fill();

  // ------------------------------------------------------------------- Kopf
  drawHead(ctx, p, C, shoulder, bob);

  // ----------------------------------------------------- vordere Gliedmassen
  bone(ctx, hip, legA.joint, legA.end, 9, C.jeans);
  shoe(ctx, legA.end, legA.joint, C.shoe);
  bone(ctx, shoulder, armA.joint, armA.end, 7.4, C.jacket);

  if (p.state === "eating") {
    ctx.fillStyle = mixHex("#d9c08d", "#f0d59f", warm);
    ctx.save();
    ctx.translate(armA.end.x + 1, armA.end.y - 1);
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.roundRect(-4, -6, 8, 12, 4);
    ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------- Kantenlicht
  ctx.globalAlpha = 0.5 + warm * 0.2;
  ctx.strokeStyle = C.rim;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  const rx = -1.5 * p.facing;
  ctx.beginPath();
  ctx.moveTo(shoulder.x - 10.5 + rx, shoulder.y - 2.2);
  ctx.quadraticCurveTo(hip.x - 10 + rx, hip.y - 12, hip.x - 8 + rx, hip.y + 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hip.x + rx, hip.y + 1);
  ctx.lineTo(legA.joint.x + rx, legA.joint.y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  p: FerdiPose,
  C: Record<string, string>,
  shoulder: Pt,
  bob: number,
): void {
  const nod = Math.sin(p.phase * 2) * 1.2 * p.gait;
  const hx = shoulder.x + p.lean * -2.5;
  const hy = HEAD_Y + bob + nod;
  const tilt = p.lean * 0.5 + Math.sin(p.time * 0.9) * p.drunk * 0.09;

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(tilt);

  // Hals
  ctx.strokeStyle = C.skin as string;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-0.5, 7);
  ctx.lineTo(0.5, 13);
  ctx.stroke();

  // Kopfform inklusive Nase im Profil
  ctx.fillStyle = C.skin as string;
  ctx.beginPath();
  ctx.moveTo(0, -HEAD_RY);
  ctx.quadraticCurveTo(HEAD_RX, -HEAD_RY + 1, HEAD_RX - 0.6, -1.5);
  ctx.lineTo(HEAD_RX + 2.4, 1.2);
  ctx.lineTo(HEAD_RX - 1.4, 2.4);
  ctx.quadraticCurveTo(HEAD_RX - 1.8, HEAD_RY - 1, 1.5, HEAD_RY);
  ctx.quadraticCurveTo(-HEAD_RX, HEAD_RY - 2, -HEAD_RX, -1);
  ctx.quadraticCurveTo(-HEAD_RX, -HEAD_RY + 1, 0, -HEAD_RY);
  ctx.closePath();
  ctx.fill();

  // Mondseite des Gesichts etwas heller
  ctx.fillStyle = C.skinLit as string;
  ctx.beginPath();
  ctx.moveTo(0, -HEAD_RY);
  ctx.quadraticCurveTo(HEAD_RX, -HEAD_RY + 1, HEAD_RX - 0.6, -1.5);
  ctx.lineTo(HEAD_RX + 2.4, 1.2);
  ctx.lineTo(HEAD_RX - 1.4, 2.4);
  ctx.quadraticCurveTo(HEAD_RX - 3, 1, 0.5, -1);
  ctx.closePath();
  ctx.fill();

  // Haare: kurz, mit Ansatz im Nacken
  ctx.fillStyle = C.hair as string;
  ctx.beginPath();
  ctx.moveTo(-HEAD_RX - 0.4, -1.5);
  ctx.quadraticCurveTo(-HEAD_RX - 1.2, -HEAD_RY - 2.5, 1, -HEAD_RY - 1.8);
  ctx.quadraticCurveTo(HEAD_RX + 0.8, -HEAD_RY - 1, HEAD_RX - 0.2, -5.4);
  ctx.quadraticCurveTo(HEAD_RX - 3.6, -7.6, 0.6, -7);
  ctx.quadraticCurveTo(-HEAD_RX + 1.4, -6.4, -HEAD_RX + 1, 1.6);
  ctx.closePath();
  ctx.fill();

  // Ohr
  ctx.fillStyle = C.skin as string;
  ctx.beginPath();
  ctx.ellipse(-3.6, -1.2, 1.7, 2.4, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Augen - bei viel Promille haengen die Lider
  const droop = clamp(p.drunk, 0, 1);
  const eyes: readonly [number, number][] = [
    [5.4, -3.4],
    [0.9, -3.6],
  ];
  for (let i = 0; i < eyes.length; i++) {
    const e = eyes[i] as [number, number];
    const r = i === 0 ? 1.65 : 1.4;
    ctx.fillStyle = "#10131c";
    ctx.beginPath();
    ctx.ellipse(e[0], e[1], r, r * (1 - droop * 0.45), 0, 0, Math.PI * 2);
    ctx.fill();
    if (droop > 0.25) {
      ctx.fillStyle = C.skinLit as string;
      ctx.beginPath();
      ctx.rect(e[0] - r - 0.4, e[1] - r - 0.6, r * 2 + 0.8, (r + 0.6) * droop * 0.9);
      ctx.fill();
    }
  }

  // Brauen
  ctx.strokeStyle = C.hair as string;
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(3.6, -6.4 + droop * 1.1);
  ctx.lineTo(6.8, -5.9 + droop * 0.5);
  ctx.moveTo(-0.4, -6.6 + droop * 1.1);
  ctx.lineTo(2.2, -6.4 + droop * 0.8);
  ctx.stroke();

  // Mund - haengt offen, wenn es spaet ist
  const mouthOpen = 0.4 + droop * 1.4 + (p.state === "eating" ? Math.sin(p.stateT * 7) + 1 : 0);
  ctx.fillStyle = "#20151a";
  ctx.beginPath();
  ctx.ellipse(5.2, 4.6, 1.9, Math.max(0.35, mouthOpen * 0.7), 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
