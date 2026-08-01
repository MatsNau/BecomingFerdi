import "./style.css";
import { GameAudio } from "./core/audio.ts";
import { Input } from "./core/input.ts";
import { Screen } from "./core/screen.ts";
import { Act1 } from "./game/act1.ts";
import { PostFX } from "./render/postfx.ts";

function need<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`HTML-Grundgeruest fehlt: ${selector}`);
  return el;
}

const canvas = need<HTMLCanvasElement>("#game");
const touchRoot = need<HTMLElement>("#touch");
const rotateHint = need<HTMLElement>("#rotate");

const screen = new Screen(canvas);
const input = new Input(touchRoot);
const audio = new GameAudio();
const post = new PostFX();
const act = new Act1(audio);

const FIXED = 1 / 60;
const MAX_STEPS = 5;
let accumulator = 0;
let last = performance.now();

function updateRotateHint(): void {
  const portrait = screen.isPortrait && input.touchVisible;
  rotateHint.hidden = !portrait;
  touchRoot.hidden = !input.touchVisible || portrait;
}

function onResize(): void {
  screen.resize();
  updateRotateHint();
}

window.addEventListener("resize", onResize);
window.addEventListener("orientationchange", () => window.setTimeout(onResize, 120));
document.addEventListener("visibilitychange", () => {
  last = performance.now();
  accumulator = 0;
});

function frame(now: number): void {
  requestAnimationFrame(frame);

  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;

  if (document.hidden) return;
  updateRotateHint();
  screen.resize();
  screen.beginFrame();

  const view = { w: screen.viewW, h: screen.viewH };
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED && steps < MAX_STEPS) {
    act.update(FIXED, input, view);
    accumulator -= FIXED;
    steps++;
  }
  if (steps === MAX_STEPS) accumulator = 0;

  act.render(screen, post, input);
}

onResize();
requestAnimationFrame(frame);
