import { clamp, falloff, lerp, makeNoise1D, smoothstep } from "../core/math.ts";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PropKind =
  | "tent"
  | "lamp"
  | "sign"
  | "busstop"
  | "doner"
  | "pole"
  | "bale"
  | "fence"
  | "trough"
  | "bush"
  | "home";

export interface Prop {
  kind: PropKind;
  x: number;
  seed: number;
}

export interface CowSpawn {
  x: number;
  depth: number;
  period: number;
  phase: number;
  awake: number;
}

export const GROUND_BASE = 420;

const X0 = -900;
const X1 = 6200;
const STEP = 16;
const COUNT = Math.ceil((X1 - X0) / STEP) + 1;

export const LEVEL = {
  startX: 344,
  tentX: 100,
  donerX: 1830,
  /** Der Bestellbereich am Fenster des Imbisswagens. */
  donerZone: { x0: 1786, x1: 1878 },
  ditch: { center: 2680, half: 108, depth: 86 },
  pastureIn: 3250,
  pastureOut: 4400,
  /** Hierhin geht es zurueck, wenn die Herde losrennt. */
  checkpointX: 3306,
  doorX: 5250,
  endX: 5300,
} as const;

function flattenTo(y: number, x: number, a: number, b: number, target: number, blend: number) {
  const w = smoothstep(a - blend, a, x) * (1 - smoothstep(b, b + blend, x));
  return lerp(y, target, w);
}

function buildTerrain(): Float32Array {
  const t = new Float32Array(COUNT);
  const rolling = makeNoise1D(1337);
  const bumps = makeNoise1D(9042);
  const d = LEVEL.ditch;

  for (let i = 0; i < COUNT; i++) {
    const x = X0 + i * STEP;
    let y = GROUND_BASE + rolling(x * 0.0017) * 24 + bumps(x * 0.0071) * 6;

    y = flattenTo(y, x, -900, 720, GROUND_BASE + 6, 130); // Festplatz
    y = flattenTo(y, x, 760, 1500, GROUND_BASE - 2, 130); // Dorfstrasse
    y = flattenTo(y, x, 1660, 2010, GROUND_BASE + 2, 110); // Imbiss-Parkplatz
    y = flattenTo(y, x, 3210, 4470, GROUND_BASE - 8, 150); // Weide
    y = flattenTo(y, x, 4980, 6200, GROUND_BASE + 4, 170); // Zuhause

    const k = clamp(1 - Math.abs(x - d.center) / d.half, 0, 1);
    y += d.depth * (k * k * (3 - 2 * k));

    t[i] = y;
  }
  return t;
}

const TERRAIN = buildTerrain();

export function groundY(x: number): number {
  const f = (clamp(x, X0, X1 - STEP) - X0) / STEP;
  const i = Math.floor(f);
  const a = TERRAIN[i] as number;
  const b = TERRAIN[i + 1] as number;
  return a + (b - a) * (f - i);
}

export function groundSlope(x: number): number {
  return (groundY(x + 8) - groundY(x - 8)) / 16;
}

/** Wasserspiegel im Graben - darunter wird gewatet statt gelaufen. */
export const WATER_Y = groundY(LEVEL.ditch.center) - 34;

export function inDitch(x: number): boolean {
  return Math.abs(x - LEVEL.ditch.center) < LEVEL.ditch.half;
}

// -------------------------------------------------------------- feste Koerper

export const BALE_W = 74;
export const BALE_H = 58;
export const GATE_H = 56;

function bale(x: number): Box {
  return { x: x - BALE_W / 2, y: groundY(x) - BALE_H, w: BALE_W, h: BALE_H };
}

function gate(x: number): Box {
  return { x: x - 7, y: groundY(x) - GATE_H, w: 14, h: GATE_H };
}

export const SOLIDS: readonly Box[] = [
  bale(2270),
  bale(2960),
  bale(3026),
  gate(LEVEL.pastureIn),
  gate(LEVEL.pastureOut),
  bale(4720),
];

// --------------------------------------------------------------------- Kulisse

export const PROPS: readonly Prop[] = [
  { kind: "tent", x: LEVEL.tentX, seed: 1 },
  { kind: "bush", x: 700, seed: 2 },
  { kind: "sign", x: 830, seed: 3 },
  { kind: "lamp", x: 980, seed: 4 },
  { kind: "busstop", x: 1210, seed: 5 },
  { kind: "lamp", x: 1450, seed: 6 },
  { kind: "doner", x: LEVEL.donerX, seed: 7 },
  { kind: "pole", x: 2140, seed: 8 },
  { kind: "bale", x: 2270, seed: 9 },
  { kind: "bush", x: 2450, seed: 10 },
  { kind: "pole", x: 2880, seed: 11 },
  { kind: "bale", x: 2960, seed: 12 },
  { kind: "bale", x: 3026, seed: 13 },
  { kind: "fence", x: LEVEL.pastureIn, seed: 15 },
  { kind: "trough", x: 3900, seed: 16 },
  { kind: "fence", x: LEVEL.pastureOut, seed: 17 },
  { kind: "pole", x: 4640, seed: 18 },
  { kind: "bale", x: 4720, seed: 19 },
  { kind: "bush", x: 4900, seed: 20 },
  { kind: "home", x: 5290, seed: 21 },
];

/** Die zweite Kuh steht bewusst dicht hinter der ersten - Rhythmus zum Lesen. */
export const COW_SPAWNS: readonly CowSpawn[] = [
  { x: 3440, depth: -0.35, period: 6.4, phase: 0.0, awake: 0.3 },
  { x: 3600, depth: 0.45, period: 5.8, phase: 0.42, awake: 0.32 },
  { x: 3760, depth: -0.15, period: 7.2, phase: 0.68, awake: 0.3 },
  { x: 3905, depth: 0.55, period: 6.0, phase: 0.2, awake: 0.34 },
  { x: 4060, depth: -0.45, period: 6.8, phase: 0.55, awake: 0.31 },
  { x: 4200, depth: 0.25, period: 5.4, phase: 0.08, awake: 0.35 },
];

// ----------------------------------------------------------------- Warmlichter

interface LightSource {
  x: number;
  reach: number;
  strength: number;
}

const LIGHTS: readonly LightSource[] = [
  { x: 300, reach: 520, strength: 1 },
  { x: 980, reach: 210, strength: 0.55 },
  { x: 1450, reach: 210, strength: 0.55 },
  { x: LEVEL.donerX, reach: 300, strength: 1 },
  { x: 5290, reach: 340, strength: 0.85 },
];

/** Wie warm eine Figur an Position x angeleuchtet wird (0..1). */
export function warmthAt(x: number): number {
  let w = 0;
  for (const l of LIGHTS) {
    w = Math.max(w, l.strength * falloff(Math.abs(x - l.x), l.reach * 0.25, l.reach));
  }
  return w;
}

/** Naehe zum Festzelt - steuert Bassdruck und Bildpulsieren. */
export function tentIntensity(x: number): number {
  return falloff(Math.abs(x - LEVEL.tentX), 180, 1450);
}
