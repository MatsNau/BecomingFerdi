export type Action = "left" | "right" | "jump" | "run";

const KEY_MAP: Record<string, Action> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "jump",
  ArrowUp: "jump",
  KeyW: "jump",
  ShiftLeft: "run",
  ShiftRight: "run",
};

/**
 * Tastatur + Touch in einem. Der Sprung wird gepuffert (jumpQueued), damit ein
 * Tipp kurz vor der Landung nicht verschluckt wird - das verzeiht Handytippen
 * und Restalkohol gleichermassen.
 */
export class Input {
  left = false;
  right = false;
  run = false;
  jumpHeld = false;

  /** Zeitstempel des letzten Sprungtipps, in Sekunden Spielzeit. */
  jumpPressedAt = -999;
  /** Irgendeine Eingabe seit dem letzten Abfragen - fuer Titel- und Endkarte. */
  private anyPress = false;

  private hasTouch = false;
  private readonly heldBy = new Map<number, Action>();
  private now = 0;

  constructor(private readonly touchRoot: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.releaseAll);
    window.addEventListener("pointerdown", this.onAnyPointer, { passive: true });

    for (const btn of Array.from(touchRoot.querySelectorAll<HTMLElement>(".btn"))) {
      const action = btn.dataset.act as Action | undefined;
      if (!action) continue;
      btn.addEventListener("pointerdown", (e) => this.onButtonDown(e, btn, action));
      btn.addEventListener("pointerup", (e) => this.onButtonUp(e, btn));
      btn.addEventListener("pointercancel", (e) => this.onButtonUp(e, btn));
      btn.addEventListener("lostpointercapture", (e) => this.onButtonUp(e, btn));
      btn.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    // Erst wenn wirklich mit dem Finger getippt wird, blenden wir die Knoepfe ein.
    window.addEventListener(
      "touchstart",
      () => {
        if (this.hasTouch) return;
        this.hasTouch = true;
        this.touchRoot.hidden = false;
      },
      { passive: true },
    );
    if (window.matchMedia("(pointer: coarse)").matches) {
      this.hasTouch = true;
      touchRoot.hidden = false;
    }
  }

  setTime(t: number): void {
    this.now = t;
  }

  get touchVisible(): boolean {
    return this.hasTouch;
  }

  /** Liefert true (und loescht das Flag), wenn seit dem letzten Aufruf getippt wurde. */
  consumeAnyPress(): boolean {
    const v = this.anyPress;
    this.anyPress = false;
    return v;
  }

  consumeJump(bufferSeconds: number): boolean {
    if (this.now - this.jumpPressedAt <= bufferSeconds) {
      this.jumpPressedAt = -999;
      return true;
    }
    return false;
  }

  private set(action: Action, down: boolean): void {
    switch (action) {
      case "left":
        this.left = down;
        break;
      case "right":
        this.right = down;
        break;
      case "run":
        this.run = down;
        break;
      case "jump":
        this.jumpHeld = down;
        if (down) this.jumpPressedAt = this.now;
        break;
    }
    if (down) this.anyPress = true;
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (!action) {
      if (e.code === "Enter" || e.code === "Escape") this.anyPress = true;
      return;
    }
    e.preventDefault();
    if (e.repeat) return;
    this.set(action, true);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    this.set(action, false);
  };

  private readonly onAnyPointer = (): void => {
    this.anyPress = true;
  };

  private onButtonDown(e: PointerEvent, btn: HTMLElement, action: Action): void {
    e.preventDefault();
    e.stopPropagation();
    btn.setPointerCapture?.(e.pointerId);
    btn.classList.add("is-down");
    this.heldBy.set(e.pointerId, action);
    this.set(action, true);
  }

  private onButtonUp(e: PointerEvent, btn: HTMLElement): void {
    const action = this.heldBy.get(e.pointerId);
    if (!action) return;
    e.preventDefault();
    this.heldBy.delete(e.pointerId);
    btn.classList.remove("is-down");
    this.set(action, false);
  }

  private readonly releaseAll = (): void => {
    this.left = this.right = this.run = this.jumpHeld = false;
    this.heldBy.clear();
    for (const btn of Array.from(this.touchRoot.querySelectorAll(".btn"))) {
      btn.classList.remove("is-down");
    }
  };
}
