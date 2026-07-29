export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Rahmenratenunabhaengiges Nachziehen: t=0 haelt fest, t=1 springt sofort. */
export function damp(a: number, b: number, rate: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-rate * dt));
}

export function approach(cur: number, target: number, maxDelta: number): number {
  if (cur < target) return Math.min(cur + maxDelta, target);
  return Math.max(cur - maxDelta, target);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Faellt von 1 (bei x=inner) auf 0 (bei x=outer) ab. */
export function falloff(x: number, inner: number, outer: number): number {
  return 1 - smoothstep(inner, outer, x);
}

/** Kleiner, deterministischer PRNG - gleiche Seed, gleiche Welt. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length] as T;
}

/**
 * Weiches 1D-Value-Noise im Bereich [-1, 1]. Wird fuer Gelaende, Torkeln
 * und Wind benutzt - immer gleich, nie zufaellig zuckend.
 */
export function makeNoise1D(seed: number): (x: number) => number {
  const size = 512;
  const rng = mulberry32(seed);
  const table = new Float32Array(size);
  for (let i = 0; i < size; i++) table[i] = rng() * 2 - 1;

  return (x: number): number => {
    const xi = Math.floor(x);
    const f = x - xi;
    const i0 = ((xi % size) + size) % size;
    const i1 = (i0 + 1) % size;
    const a = table[i0] as number;
    const b = table[i1] as number;
    const t = f * f * (3 - 2 * f);
    return a + (b - a) * t;
  };
}

/** Mischt zwei "#rrggbb"-Farben. */
export function mixHex(a: string, b: string, t: number): string {
  const k = clamp(t, 0, 1);
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

export function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
