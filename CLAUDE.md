# Projektregeln: Frogger

Dieses Projekt wird gemeinsam mit einem zehnjährigen Kind entwickelt. Das ist die wichtigste Rahmenbedingung für die gesamte Arbeit an diesem Repo.

## Grundregeln

- **Lieber fragen als lange Texte verlangen.** Wenn eine Entscheidung ansteht (Design, Feature, Reihenfolge), stelle knappe Auswahlfragen (z. B. per AskUserQuestion mit 2-4 Optionen), statt zu erwarten, dass der Anwender viel Text schreibt oder frei formuliert antwortet.
- **Kleine, verständliche Schritte.** Keine großen Features auf einmal umsetzen. Eine Aufgabe = ein überschaubarer, nachvollziehbarer Schritt.
- **Einfacher, gut lesbarer Code.** Klare Namen, keine unnötige Abstraktion, keine cleveren Tricks. Der Code soll auch von einem Kind mit Anleitung nachvollzogen werden können.
- **Erklärende Kommentare erlaubt und erwünscht.** Abweichend vom sonstigen Standard ("keine Kommentare") dürfen hier kurze Kommentare stehen, die erklären, WAS ein Codeabschnitt macht und WARUM – das Projekt dient auch zum Lernen.
- **Konzepte kurz erklären.** Beim Einbauen von neuen Dingen (Schleifen, Funktionen, Canvas, Kollisionserkennung etc.) kurz und einfach erklären, was das ist – ohne Fachjargon-Overload.
- **Mitmachen ermöglichen.** Aufgaben so aufteilen, dass der/die Zehnjährige selbst etwas verändern/ausprobieren kann (z. B. Farben, Geschwindigkeit, Zahlen anpassen), statt nur zuzusehen.

## Praktisch für die Zusammenarbeit

- Bei neuen Features: erst kurz fragen, was genau gewünscht ist (mit Auswahlmöglichkeiten), dann umsetzen.
- Nach jedem größeren Schritt: kurz zeigen/testen, was sich geändert hat (z. B. Screenshot oder im Browser ausprobieren).
- Keine Build-Tools oder komplexen Abhängigkeiten einführen, wenn es nicht nötig ist – das Projekt bleibt bewusst einfach (reines HTML/CSS/JS).

## Workflow / Technisches

- **Direkt auf `main` committen und pushen.** `main` ist entgegen früherer Annahme nicht durch GitHub-Branch-Protection gesperrt – kein PR-Umweg nötig, einfach direkt auf `main` arbeiten (`git push origin main`).
- **Wünsche kommen oft als GitHub Issues** (z. B. "Setze #9 um" oder "Setze #12,#13 um"). Vorgehen: Issue-Text lesen, bei Unklarheiten kurz per AskUserQuestion nachfragen, umsetzen, im Commit `Closes #<Nummer>` referenzieren. Danach kurz prüfen, ob GitHub das Issue wirklich automatisch geschlossen hat.
- **Lokal testen** vor dem Commit: `python3 -m http.server 8123` starten und mit einem headless Browser (Playwright/Chromium) kurz durchklicken bzw. einen Screenshot machen, bevor gepusht wird. Für Funktionen, die schwer automatisiert auszulösen sind (z. B. ein Level gewinnen), hilft ein temporärer Debug-Hook (`window.__debugXyz = ...`), der vor dem Commit wieder restlos entfernt wird.
- **GitHub Pages** liefert `game.js`/`style.css` über ein CDN mit kurzem Cache – nach einem Push kann es ein paar Minuten dauern, bis Änderungen live sichtbar sind (Tab neu öffnen oder `?x=1` an die URL hängen hilft beim Testen).
- **Test-Artefakte nicht ins Repo committen.** Screenshots aus lokalen Tests landen im Scratchpad-Verzeichnis, nicht im Projektordner; falls doch mal eine Datei im Repo-Root landet, vor dem Commit löschen statt einchecken.
