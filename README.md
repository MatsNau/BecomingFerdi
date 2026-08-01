# Becoming Ferdi

Ein kleines Browserspiel in drei Akten, das Stationen aus Ferdis Leben
nacherzählt. Läuft im Browser, ist mit dem Handy im Querformat spielbar.

Optik: nächtlich und atmosphärisch, in Richtung *Limbo* / *Inside* — aber
keine reinen Silhouetten. Die Figur soll als Person erkennbar bleiben.

```bash
npm install
npm run dev      # Network-URL im Terminal ist die fürs Handy
npm run build    # statischer Ordner dist/ zum Verschicken
```

Technische Details, Balancing-Zahlen und der Arbeitsstand stehen im
[DEVLOG.md](DEVLOG.md). Alle Texte des Spiels liegen gesammelt in
`src/game/story.ts` — dort wird personalisiert.

---

## Die drei Akte

Ein Tag im Zeitraffer, und gleichzeitig ein Reifebogen: vom Jungen, der nachts
heimkommt, zum Mann, der für die Familie kocht.

### Akt 1 — Der Heimweg ✅ *fertig*

Halb vier morgens, die Zeltdisco macht dicht. Ferdi muss durchs Dorf und über
die Felder nach Hause. Ein Jump'n'Run, dessen eigentliches Thema die
Betrunkenheit ist: Er driftet auch dann zur Seite, wenn man gar keine Taste
drückt, die Steuerung ist träge, das Bild schwankt und man sieht doppelt.

Unterwegs steht ein **Dönerwagen**. Wer dort stehen bleibt und bestellt,
bekommt einen kräftigen Dämpfer auf den Rausch — wer vorbeirennt, verpasst ihn.
Das Stehenbleiben ist dabei kein Zufall, sondern die Übung für das, was gleich
kommt.

Das Hindernis ist eine **Kuhherde** auf der Weide. Die Kühe reagieren nicht auf
Nähe, sondern auf Lärm. Jede döst im Wechsel: Kopf im Gras heißt taub, ein
Ohrenzucken kündigt an, dass gleich der Kopf hochgeht, und mit erhobenem Kopf
hört sie zu. Rennen ist am lautesten, Gehen mittel, Stillstehen lautlos — nur
kann man betrunken eben nicht stillstehen. Wird eine Kuh zu aufmerksam, stiebt
die Herde auseinander und es geht zurück zum Weidezaun.

Am Ende brennt das Küchenlicht. Ferdi geht rein.

*Es gibt in Akt 1 keinen Game Over. In den Graben fallen kostet nasse Schuhe,
die Kühe kosten Wegstrecke — mehr nicht.*


TODOS Akt 1: 
Mechanik:
- Am Anfang nicht zu schnell laufen, sonst übergibt man sich
- Die Pfütze zum Baggersee den man mit einem Floß überqueren muss
- Wird man nass ist man bei den Kühen lauter
- Bei den Kühen gibt es Kuhpfladen in die man nicht treten darf sonst wird es auch schwerer lauter und langsamer
- (Bonus: Schuhe nicht dreckig sonst gibt es einen Spruch von der Mutter)
Assets: 
- Startet IN Zeltdisco, mit "Pursuit of Happines" Faded out, Zeltdisco hat Strahllichter die in den Himmel scheinen
- Ferdi Asset durch richtiges 3d-Modell austauschen
- Diyaro mehr wie den echten Diyaro designen mit Logo
- Bäume und Kühe durch 3D Assets austauschen
- Das Haus durch das wirklich Haus austauschen
- REihenfolge sollte sein: Zeltdisco -> Diyaro -> Feld -> Baggersee -> Kuhwiese -> Pattensen
### Akt 2 — Der Garten 🔲 *geplant*

Referenziert die Familienlegende, dass Ferdi als Kind einmal vom Balkon
gepinkelt hat.

Er wacht nach der Party auf und muss dringend. Das Bad ist besetzt, Papa ist
drin, Tür zu. Also: Balkon. Seine offizielle Mission lautet, die Blumen zu
gießen.

Die Idee für die Mechanik: Die Blase ist gleichzeitig Munition und Timer.
Halten baut Druck auf, Loslassen erzeugt eine Wurfparabel, der Wind verzieht
sie. Alle Blumentöpfe zu treffen lässt eine Bohnenranke wachsen, an der er
später hinunterklettern kann. Omas Wäscheleine, die Katze und der Nachbar
sollten dabei besser trocken bleiben.

Akt 2 teilt sich den Physikkern mit Akt 1 — Seitenansicht, Schwerkraft,
Laufen und Springen.

### Akt 3 — Das Familienessen 🔲 *geplant*

Die finale Mission: Ferdi soll das Familienessen kochen. Sehr stressig.

Bewusst **kein** Bewegungsspiel, sondern ein reines Tipp-Spiel auf einem
Standbild: drei bis vier Kochstationen, jede mit einer Leiste von roh über
fertig bis verbrannt, dazu Störungen aus dem Nebenzimmer. Damit bleiben es im
ganzen Projekt zwei Systeme statt drei — das ist die zentrale Entscheidung,
damit das Spiel auch fertig wird.

Auch hier kein Game Over: Was anbrennt, kommt trotzdem auf den Tisch. Am Ende
sitzen alle glücklich da und essen — wie viel Verkohltes daneben steht, ist die
Note.

---

Die Mechaniken für Akt 2 und 3 sind Vorschläge und noch nicht final
entschieden.
