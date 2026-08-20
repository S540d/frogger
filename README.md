# Frogger

Ein simples, arcadeartiges Browserspiel im Stil des Klassikers "Frogger" – gebaut mit reinem HTML5 Canvas, CSS und Vanilla JavaScript, ohne Build-Tools oder Abhängigkeiten.

## Spielen

👉 **[Jetzt im Browser spielen](https://s540d.github.io/frogger/)**

Alternativ lokal: Einfach `index.html` im Browser öffnen (oder lokal per `python3 -m http.server` servieren).

## Steuerung

- Pfeiltasten oder WASD zum Bewegen, auf dem Handy per Wischen
- Bring deine Spielfigur über die Straße und den Fluss (auf den Baumstämmen mitschwimmen!) sicher ans gegenüberliegende Ufer
- 3 Leben, Punkte für Vorwärtsbewegung und erreichte Ziele

## Spielfigur & Level

- **Spielfigur wählen** (⚙️-Button): Zur Auswahl stehen der Frosch (Startfigur) sowie alle Tiere, die man sich schon durch das Schaffen eines Levels verdient hat. Die Auswahl bleibt im Browser gespeichert.
- **Level wählen** (🚩-Button): Man kann jedes bereits erreichte Level erneut spielen.
- **5 Level** mit steigendem Tempo (Level 1 = 0,1, Level 5 = 0,4).
- **Endlos-Level** danach: Die Kamera scrollt mit, man kann unendlich weit laufen. Alle 15 Minuten Spielzeit gibt es ein weiteres Tier-Emoji, und der beste Punktestand wird als Rekord gespeichert.
- Nach jedem geschafften Level gibt es ein neues Tier-Emoji, das man dauerhaft als Spielfigur freischaltet.

## Dateien

- `index.html` – Grundgerüst und Canvas
- `style.css` – Styling
- `game.js` – Spiellogik (Bewegung, Kollisionen, Level, Steuerung)
