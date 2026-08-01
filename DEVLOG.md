# DEVLOG — Becoming Ferdi

Arbeitsprotokoll für die Weiterarbeit. Geschrieben als Kontextdokument für eine
KI-Sitzung, die dieses Repo ohne Vorwissen aufmacht: dichte Fakten, konkrete
Zahlen, Begründungen für Design-Entscheidungen, offene Punkte.

**Stand:** 2026-07-29 · Akt 1 implementiert und gebaut, **noch nie im Browser
gesehen** (siehe [Nicht verifiziert](#nicht-verifiziert)).

---

## 1. Was das Projekt ist

Ein Geschenk-Spiel für den Bruder der Freundin des Nutzers. Drei Akte, die
Stationen aus Ferdis Leben referenzieren. Browser-basiert, **muss auf dem Handy
mit Touch spielbar sein**. Optik: nächtlich, atmosphärisch, in Richtung Limbo /
Inside — **aber ausdrücklich keine reinen Silhouetten**, die Figur soll als
Person erkennbar sein. Das war eine explizite Korrektur des Nutzers.

### Die drei Akte

| Akt | Inhalt | Status |
|-----|--------|--------|
| 1 | Nachts von der Zeltdisco durchs Dorf und über die Felder nach Hause | **implementiert** |
| 2 | Nach der Party: dringend aufs Klo, Bad besetzt → vom Balkon aus die Blumen gießen, Bohnenranke wächst, daran runterklettern | nur Konzept |
| 3 | Familienessen kochen, Stress-Minispiel, am Ende sitzen alle glücklich am Tisch | nur Konzept |

Akt 2 referenziert eine echte Familien-Legende (Ferdi hat als Kind vom Balkon
gepinkelt). Der Nutzer hat für Akt 2 und 3 noch keine finalen Entscheidungen
getroffen — die Vorschläge in Abschnitt 8 sind bislang unbestätigt.

---

## 2. Technik-Stack und Befehle

- **Vite 6 + TypeScript 5.7 + Canvas2D**, kein Framework, keine Game-Engine.
- Kein Spritesheet, keine Sounddateien, keine externen Assets: **alles wird zur
  Laufzeit prozedural gezeichnet bzw. per WebAudio synthetisiert.** Das ganze
  Spiel ist ~50 kB JS (18 kB gzip).
- `base: "./"` in `vite.config.ts`, damit ein Build auch in einem Unterordner
  (GitHub Pages) läuft. `server.host: true` für Handy-Tests im WLAN.

```
npm install
npm run dev      # http://localhost:5173/ + Netzwerk-URL fürs Handy
npm run build    # tsc --noEmit && vite build   -> dist/
npm run preview
```

**tsconfig:** `strict`, `noUnusedLocals`, `noUnusedParameters` sind an.
`noUncheckedIndexedAccess` wurde bewusst **ausgeschaltet** — bei den engen
Render- und Terrain-Schleifen kostet es nur Zeremonie.

---

## 3. Dateikarte

```
index.html            Canvas + Touch-Buttons (DOM-Overlay) + Querformat-Hinweis
src/style.css         Vollbild-Layout, Touch-Buttons, safe-area-insets
src/main.ts           Bootstrap, fixe Zeitschritte (1/60, max 5), resize, rAF-Loop

src/core/math.ts      clamp lerp damp approach smoothstep falloff
                      mulberry32 (seeded PRNG), makeNoise1D (Value-Noise), mixHex, rgba
src/core/screen.ts    Virtuelle Auflösung, DPR, Offscreen-"scene"-Canvas
src/core/input.ts     Tastatur + Touch vereinheitlicht, Sprungpuffer
src/core/audio.ts     WebAudio-Synth: Zelt-Bass (Scheduler), Wind, alle Effekte

src/game/level.ts     Terrain, Kollisionskörper, Prop-Liste, Kuh-Spawns, Lichtquellen
src/game/player.ts    Physik, Torkeln, Lautstärke, Zustandsautomat der Figur
src/game/cows.ts      Cow + Herd: Wach-Zyklus, Aufmerksamkeit, Stampede
src/game/act1.ts      DER KERN: Modus-Automat, Kamera, Döner, Story-Trigger, Render-Reihenfolge
src/game/story.ts     ALLE TEXTE + VILLAGE-Name. Hier wird personalisiert.

src/render/palette.ts Farbkonstanten (PAL)
src/render/ferdi.ts   Die Figur, prozedural, mit Zwei-Knochen-IK
src/render/props.ts   Zelt, Dönerwagen, Haus, Laterne, Ballen, Zaun, Kuh, …
src/render/backdrop.ts Himmel, Sterne, Mond, Parallax-Ebenen, Boden, Nebel, Vordergrund
src/render/postfx.ts  Doppelbild, Drehung, Vignette, Filmkorn, Blende
src/render/hud.ts     Torkel-Anzeige, Untertitel, Bestell-Ring, Titel- und Endkarte
```

---

## 4. Architektur-Invarianten

Diese Punkte sind leicht zu brechen, wenn man sie nicht kennt:

1. **Zwei Canvas.** `screen.scene` (Offscreen) bekommt die Spielwelt,
   `screen.canvas` bekommt danach das Composite. Grund: Für das Doppelbild
   muss die fertige Szene zweimal versetzt gezeichnet werden.
   → **Das HUD wird erst NACH `post.composite()` auf `screen.ctx` gezeichnet**,
   sonst wäre es mitgedreht und doppelt sichtbar, also unlesbar.

2. **Drehung und Wackeln passieren ausschließlich in `postfx.ts`**, nicht in
   der Kamera. Deshalb muss dort `zoom = 1.06+` bleiben, sonst laufen bei der
   Drehung die Bildecken leer.

3. **Virtuelle Auflösung ist höhenbasiert**, nicht fix: `DESIGN_H = 500`,
   Breite ergibt sich aus dem Seitenverhältnis, geklemmt auf 720…1280
   (`core/screen.ts`). Dadurch gibt es auf keinem Handy schwarze Balken,
   breite Geräte sehen einfach mehr Feldweg.
   → **Nie mit einer festen Breite rechnen.** Immer `screen.viewW / viewH`
   bzw. das durchgereichte `View`-Objekt.

4. **Weltkoordinaten:** x läuft nach rechts, **y nach unten**. Der Boden liegt
   um `GROUND_BASE = 420`. `player.y` ist die **Fußposition**, nicht der
   Mittelpunkt. Im lokalen System von `drawFerdi` dagegen ist oben `-y` und
   vorne `+x` (der Kontext wird per `scale(facing, 1)` gespiegelt).

5. **Fixe Zeitschritte.** `act.update()` läuft immer mit `dt = 1/60`.
   `act.render()` einmal pro Frame. Keine Physik in `render()`.

6. **Determinismus.** Alle „zufälligen" Elemente (Sterne, Bäume, Kuhflecken,
   Filmkorn, Gelände) kommen aus `mulberry32`/`makeNoise1D` mit festem Seed.
   → **Niemals `Math.random()` in Zeichencode**, sonst flackert es. Einzige
   erlaubte Ausnahme: Bildschirmwackeln und Korn-Versatz in `postfx.ts`.

7. **Audio startet erst nach der ersten Nutzergeste** (`audio.unlock()` beim
   Verlassen des Titelbilds). Alles davor läuft ohne Ton, aber ohne Fehler.

---

## 5. Akt 1 im Detail

### 5.1 Levelaufbau (Welt-x, alle Werte in `game/level.ts`)

| x | Was |
|---|---|
| 100 | Festzelt (Ausgang rechts bei ~300) |
| **344** | `startX` — Ferdi startet vor dem Zelteingang |
| 830 | Ortsschild mit `VILLAGE` aus `story.ts` |
| 980 / 1450 | Straßenlaternen |
| 1210 | Bushaltestelle |
| **1786–1878** | `donerZone` — Bestellbereich am Fenster |
| 1830 | Dönerwagen |
| 2270 / 2960 / 3026 | Heuballen (74×58, fest) |
| **2572–2788** | Graben, Mitte 2680, Tiefe 86, Wasser bei `WATER_Y` |
| **3250** | `pastureIn` — Gatter, muss übersprungen werden (56 hoch) |
| 3306 | `checkpointX` — Rücksetzpunkt nach Stampede |
| 3440…4200 | 6 Kühe |
| 3900 | Wassertrog |
| **4400** | `pastureOut` — zweites Gatter |
| 4720 | Heuballen |
| **5250 / 5290** | `doorX` / Haus mit erleuchtetem Küchenfenster |

Das Gelände ist ein Float32Array-Höhenfeld (`STEP = 16`, x von −900 bis 6200),
erzeugt aus zwei Noise-Oktaven, danach werden Zonen per `flattenTo()` flach
gezogen und der Graben als glatte Mulde addiert. `groundY(x)` interpoliert
linear. **Es gibt keine Löcher im Boden** — der Graben ist eine Senke, kein
Abgrund. Man kann nicht herunterfallen, nur nass werden.

### 5.2 Physik (`game/player.ts`)

```
WALK_SPEED 132   RUN_SPEED 258   GRAVITY 1560   JUMP_VEL 492
Figur: HEIGHT 82, HALF_W 13
Sprunghöhe  = 492²/(2·1560) ≈ 77.6 px   -> über 58er Ballen und 56er Gatter
Flugzeit    = 2·492/1560 ≈ 0.63 s
Sprungweite ≈ 83 px gehend, ≈ 163 px rennend
Coyote-Zeit 0.11 s, Sprungpuffer 0.13 s, variable Sprunghöhe über JUMP_CUT
```

Kollision: erst x auflösen, dann y (`resolveHorizontal` / `resolveVertical`
gegen `SOLIDS`), danach Boden per `groundY`. Beim Seitwärts-Auflösen wird
`this.y <= s.y + 1` übersprungen, damit Stehen auf einem Ballen nicht als
Seitenkollision zählt.

### 5.3 Das Torkeln — Kernmechanik

`player.drunk` ∈ [0,1], Start **0.85**. Wirkt an vier Stellen gleichzeitig,
das ist Absicht — jede einzelne wäre zu schwach:

1. **Drift** (`player.ts`): zwei Noise-Oktaven × gelegentlicher `surge`-Puls,
   Amplitude `drunk · 58 px/s`. Wird auf die Zielgeschwindigkeit addiert —
   **auch wenn keine Taste gedrückt ist**. Das ist der Grund, warum Stillstehen
   betrunken nicht funktioniert, und damit die Verbindung zur Kuh-Mechanik.
2. **Trägheit**: `maxSpeed × (1 − drunk·0.14)`, `accel × (1 − drunk·0.25)`.
3. **Bild** (`postfx.ts`): Doppelbild per `globalCompositeOperation = "lighter"`
   mit zwei versetzten Kopien, plus Drehung `±drunk·0.035 rad`, plus stärkere
   Vignette und mehr Korn.
4. **Figur** (`ferdi.ts`): hängende Lider, offener Mund, Kopfneigung, fahrige
   Arme, Oberkörperneigung über `player.lean`.

**Abbau:** `−0.006/s` an der frischen Luft, aber nur bis zu `drunkFloor` in
`act1.ts`:

| Bedingung | Untergrenze |
|---|---|
| Standard | 0.42 |
| nach 2 Aufschrecken | 0.30 |
| nach 4 Aufschrecken | 0.20 |
| Döner gegessen | 0.06 |

Der Döner setzt `drunk` über 1.9 s auf **0.26** (smoothstep-Übergang, damit das
Doppelbild sichtbar zusammenläuft). Die sinkende Untergrenze nach mehrfachem
Scheitern ist die **Frust-Bremse**: Das Spiel wird von selbst leichter, mit
einem Witz kaschiert (`HINTS.soberedByFright`).

### 5.4 Der Döner als getarntes Tutorial

Der Wagen steht auf dem Weg, man kann ihn nicht übersehen. Aber: Man muss in
`donerZone` **stehen bleiben** (`|vx| < 28`, am Boden) und den Ring 1.4 s füllen.
Wer durchrennt, verpasst ihn (`donerMissed`, sobald x > Zone + 110).

Das ist bewusst so gebaut: **Stehenbleiben ist genau die Fähigkeit, die 1400
Einheiten später bei den Kühen gebraucht wird** — und durch die Drift ist es
schon hier spürbar schwer. Der Imbiss lehrt also die Kernmechanik des
Hindernisses und belohnt sie gleichzeitig mit der Erleichterung.

### 5.5 Die Kuhherde (`game/cows.ts`)

**Es gibt keine Kollision mit Kühen.** Die einzige Gefahr ist Lautstärke.

Jede Kuh hat einen Zyklus `period` (5.4–7.2 s), davon ist sie `awake`-Anteil
(0.30–0.35) mit erhobenem Kopf wach. Ablauf:

```
Kopf im Gras (taub)  →  Ohren zucken 0.75 s vorher (Vorwarnung)
                     →  Kopf hoch, hört zu  →  wieder runter
```

Aufmerksamkeit steigt mit `playerNoise × Nähe × head`:

```
Hörradius: voll bis 72 px, aus ab 195 px (falloff)
ALERT_RISE 1.55 /s     ALERT_FALL 0.72 /s
alert ≥ 1  ->  Herde stiebt auseinander
```

Ferdis Lautstärke (`player.noiseLevel`):

| Zustand | Wert |
|---|---|
| still (\|vx\| < 6 % von RUN) | 0 |
| Drift betrunken (~vx 25) | ~0.26 |
| Gehen | ~0.60 |
| Rennen | ~1.00 |
| Landung | 0.55 + Härte, klingt mit 2.2/s ab |

Daraus folgt das Zeitbudget bei voller Nähe und erhobenem Kopf: Rennen ≈ 0.65 s
bis zum Ausrasten, Gehen ≈ 1.1 s, reines Driften ≈ 2.5 s. Ein Wachfenster
dauert ~2 s. **Betrunken reicht die Drift allein fast zum Scheitern — genau
das ist der Grund, den Döner zu holen.**

Rückmeldung an den Spieler (mehrkanalig, weil es sonst unfair wirkt):
Ring über der Kuh (weiß → orange → rot + Ausrufezeichen), Warn-Muhen ab
alert > 0.4, roter Bildschirmrand (`drawAlertEdge`) ab 0.25.

`cow.depth` ∈ [−1,1] verschiebt die Kuh optisch nach hinten/vorne (y-Versatz
±15, Skalierung ±11 %). **Kühe mit `depth > 0.3` werden NACH Ferdi gezeichnet**,
verdecken ihn also — reine Tiefenwirkung, keine Spielrelevanz.

### 5.6 Modus-Automat in `act1.ts`

```
title ──(Tipp)──► play ──(x ≥ doorX−120)──► arriving ──(Blende)──► done ──(Tipp)──► reset
                   ▲                                                                   │
                   └──────────── stampede (2.0 s) ◄── alert ≥ 1                        │
                                    │ Reset auf checkpointX                            │
                                    └────────────────────────────────────────────► title
```

**Es gibt in Akt 1 keinen echten Game-Over-Zustand.** Die Stampede kostet
Fortschritt bis zum Weide-Eingang, sonst nichts. In den Graben fallen kostet
nur nasse Schuhe. Bewusste Entscheidung für ein Geschenkspiel.

### 5.7 Die Figur (`render/ferdi.ts`)

Vollständig prozedural, keine Grafikdateien:

- **Zwei-Knochen-IK** (`ik()`) für Beine und Arme, mit Reichweiten-Klemmung.
- Fußziele auf einer Ellipsenbahn: `fx = −cos(t)·stride`,
  `fy = sin(t) > 0 ? −sin(t)·lift : 0`. Halbe Periode Schwung (Fuß in der Luft,
  hinten → vorne), halbe Periode Standphase am Boden.
- Maße: Hüfte −39, Schulter −65, Kopf −77 (rx 9.6 / ry 11), Oberschenkel 20,
  Schienbein 19, Oberarm 15, Unterarm 14.
- **Gesicht im Halbprofil**: Nase als Teil der Kopf-Silhouette, zwei Augen
  (das hintere kleiner), Brauen, Mund, Ohr, kurze Haare mit Nackenansatz.
- **Kantenlicht** kaltes Mondlicht, das über `warmthAt(x)` in Richtung warm
  gemischt wird, wenn er unter Zelt-, Döner- oder Hauslicht steht
  (`mixHex()` mischt alle Körperfarben mit).
- Helle Sneaker sind der bewusste Kontrastanker gegen den dunklen Boden.
- Sonderposen: `eating` (Hand am Mund, Kaubewegung, Dönerform in der Hand),
  `down` (Ganzkörperdrehung −1.42 rad, liegt auf dem Rücken), `inWater`
  (Clipping-Rechteck schneidet die Waden ab).

### 5.8 Kamera

`act1.updateCamera`: Ferdi auf 42 % der Breite, 68 % der Höhe, mit
Blickrichtungs-Vorlauf (±40 px). Nachziehen per `damp` (4.2 / 3.0).
`camX` geklemmt auf −300 … `endX + 260 − viewW`. **`camY` ist nicht geklemmt** —
das Gelände wellt sich zu stark, als dass eine feste Grenze sinnvoll wäre.

---

## 6. Nicht verifiziert

**Wichtigster offener Punkt.** Der Code kompiliert (`tsc --noEmit` sauber) und
baut (`vite build`, 19 Module). Aber:

- Das Spiel wurde **nie im Browser dargestellt**. Browser-Werkzeuge waren in der
  Sitzung nicht verfügbar, ein Headless-Durchlauf wurde abgebrochen.
- **Alle Balance-Zahlen sind gerechnet, nicht gespielt.** Sprungweiten,
  Kuh-Timing, Driftstärke, Torkel-Intensität.
- Ungeprüft: ob die Figur auf dem Handy groß genug ist; ob das Doppelbild
  angenehm oder übelkeitserregend wirkt; ob die Bildrate auf einem Mittelklasse-
  Handy reicht (zwei Vollbild-`drawImage` plus Korn-Pattern pro Frame sind der
  wahrscheinlichste Engpass — falls es ruckelt, zuerst das Doppelbild bei
  `drunk < 0.2` ganz abschalten und die Korn-Deckkraft senken).
- Ungeprüft: ob `roundRect` und `ctx.letterSpacing` auf dem Zielgerät greifen.
  `letterSpacing` ist bereits weich angefasst (`SpacedCtx`), `roundRect` nicht.

**Erste Aufgabe der nächsten Sitzung: das Spiel tatsächlich starten und
ansehen, bevor irgendetwas Neues gebaut wird.**

---

## 7. Bekannte Baustellen

- `groundSlope()` in `level.ts` ist exportiert, wird aber nirgends benutzt —
  entweder für Steigungs-Verlangsamung nutzen oder entfernen.
- Prop-Kulling nutzt feste Ränder (520 für Zelt/Haus, 260 sonst). Bei größeren
  neuen Props anpassen.
- `PROPS`-Seeds 14 wurde beim Entfernen eines gestapelten Ballens frei — die
  Nummerierung hat eine Lücke, ist aber folgenlos.
- Die Zaun-Drähte links und rechts des Gatters sind rein optisch, nicht fest.
  Absicht (sie laufen perspektivisch ins Feld), könnte aber verwirren.
- Kein Speicherstand, kein Fortschritt zwischen Sitzungen. Für drei Akte
  spätestens dann nötig, wenn Akt 2 dazukommt (`localStorage` reicht).
- Keine Lautstärkeregelung / Stummschaltung im UI. `audio.setEnabled()` gibt es
  bereits, es fehlt nur der Knopf.

---

## 8. Nächste Schritte

**Zuerst:** Akt 1 im Browser und auf dem Handy ansehen, Balance nachziehen.
Der Nutzer wurde um Rückmeldung zu drei Punkten gebeten: Stärke des Torkelns,
Härte der Kühe, Größe der Figur.

**Dann Personalisierung.** `src/game/story.ts` ist der einzige Ort dafür:
`VILLAGE` steht aktuell auf dem Platzhalter `"Pattensen->"`, die `BEATS`-Texte
sind bewusst neutral. Der Nutzer wurde nach Ferdis Alter, Running Gags,
Haustier und dem Gericht beim Familienessen gefragt — **die Antworten stehen
noch aus.** Sobald sie da sind, gehören sie in `story.ts` und in einzelne Props.

**Danach Deployment**, damit der Nutzer den Link verschicken kann: statisch auf
GitHub Pages oder Netlify, `base: "./"` ist schon passend gesetzt.

**Erst dann Akt 2.** Empfehlung aus der Konzeptphase: Akt 2 sollte sich den
Physikkern mit Akt 1 teilen (Seitenansicht, Schwerkraft, Laufen/Springen) — der
Balkon ist dann ein Level, in dem eine wachsende Bohnenranke zur Leiter wird.
Vorgeschlagene Mechanik, **vom Nutzer noch nicht bestätigt**: Blase ist
gleichzeitig Munition und Timer, Halten baut Druck auf, Loslassen erzeugt eine
Wurfparabel, Wind verzieht sie; alle Blumentöpfe treffen lässt die Ranke
wachsen; Omas Wäscheleine, die Katze und der Nachbar dürfen nicht getroffen
werden.

Akt 3 soll bewusst **kein** Bewegungsspiel werden, sondern ein reines
Tap-Spiel auf einem Standbild (3–4 Kochstationen, Leisten roh → fertig →
verbrannt, Störungen durch die Familie). Damit bleiben es zwei Systeme statt
drei — das war die zentrale Scoping-Entscheidung des Projekts. Ebenfalls
vorgeschlagen und noch unbestätigt: **kein Game Over**, das Schlussbild
skaliert nur mit der Leistung.
