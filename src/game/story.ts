/**
 * Alle Texte an einer Stelle - hier kann man das Spiel persoenlich machen,
 * ohne im Code zu suchen. Insider gehoeren genau hierhin.
 */

/** Steht auf dem Ortsschild kurz hinter dem Festplatz. */
export const VILLAGE = "Ferdisheim";

export const TITLE = {
  game: "BECOMING FERDI",
  act: "AKT 1",
  subtitle: "Der Heimweg",
  hintTouch: "Tippen zum Starten",
  hintKeys: "Leertaste oder Tippen zum Starten",
  controlsTouch: "◀ ▶ laufen   ·   ▲ springen   ·   RENN halten zum Rennen",
  controlsKeys: "A / D laufen   ·   Leertaste springen   ·   Shift rennen",
};

export const END = {
  act: "AKT 1",
  line: "Heimweg geschafft.",
  next: "Akt 2 — Der Garten",
  nextNote: "folgt",
  retryTouch: "Tippen für nochmal",
  retryKeys: "Leertaste für nochmal",
};

/** Einblendungen am unteren Bildrand, ausgeloest bei einer Welt-X-Position. */
export const BEATS: readonly { x: number; text: string; seconds?: number }[] = [
  { x: 0, text: "03:41 Uhr. Die Zeltdisco macht dicht.", seconds: 4.5 },
  { x: 520, text: "Nach Hause sind es zwanzig Minuten. Nüchtern.", seconds: 4.5 },
  { x: 1560, text: "Beim Dönermann brennt noch Licht.", seconds: 4 },
  { x: 2050, text: "Ab hier ist nur noch Feld.", seconds: 3.5 },
  { x: 3160, text: "Kühe. Natürlich Kühe.", seconds: 3.5 },
  { x: 4460, text: "Kein Muh. Sauber.", seconds: 3.5 },
  { x: 4960, text: "Da hinten. Küchenlicht ist noch an.", seconds: 4 },
];

export const HINTS = {
  doner: "Stehenbleiben zum Bestellen",
  donerDone: "Sofort ein anderer Mensch.",
  donerMissed: "Vorbei. Auch gut.",
  cows: "Hebt eine Kuh den Kopf: stehenbleiben.",
  stampede: "Zu laut.",
  stampedeAgain: "Nicht rennen. Warten.",
  soberedByFright: "Der Schreck macht erstaunlich nüchtern.",
  ditch: "Nasse Schuhe.",
};

export const HUD = {
  drunk: "TORKELN",
};
