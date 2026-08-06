# Code Atlas — Redesign: Terminal-Liste statt Ring-Geometrie — Design

## Problem / Ziel

Der bestehende Code Atlas (Spec `2026-08-05-code-atlas-design.md`, umgesetzt,
Pilot mit `sql-agent` gelaufen) zeigt Architektur als konzentrische Ringe um
den aktiven Planeten: Kamerafahrt hinein, drei Reglerstufen, Layer als Ringe,
Module als Punkte darauf. Marcos Bewertung nach dem Pilot: **die Darstellung
ist zu unübersichtlich** — bei sechs Layern und bis zu acht Modulen pro Layer
wird der äußerste Ring auch im breiten Viewport eng, Punkte liegen dicht
beieinander, Labels kollidieren. Die Grundmetapher ("in den Planeten
reinzoomen") ist dabei ausdrücklich nicht gesetzt — offen für eine andere
Darstellung, solange sie im Projektfenster verankert bleibt.

Ziel dieser Spec: die Ring-Geometrie durch eine lesbare, dem Rest der Seite
entsprechende Darstellung ersetzen — und zusätzlich die Rohdaten aus
Understand-Anything vor der Darstellung so weit vereinfachen, dass sie zum
neuen Format passen (Anstoß aus der Diskussion mit Marco: nicht nur die
*Struktur*-Kappung des Generators reicht, auch die *Text*-Dichte der
Summaries braucht eine eigene Regel).

Nicht-Ziel: die Datenpipeline (`tools/gen-atlas.mjs`, `atlas-normalize.mjs`,
`atlas-reduce.mjs`, Rohschema, Attribution) ändert sich strukturell nicht.
Diese Spec ersetzt ausschließlich die **Darstellungsschicht** und ergänzt den
Generator um eine **Text-Kürzungsregel**.

## Was von der alten Spec bleibt

- Reduziertes Schema (`layers[]`, `modules[]` mit `deps[]`, `source`-Feld) —
  unverändert. Siehe `2026-08-05-code-atlas-design.md`, Abschnitt „Reduziertes
  Schema".
- Struktur-Kappung im Generator: max. 6 Layer, max. 8 Module pro Layer,
  Überschuss als ein Sammelknoten „+N weitere" pro Layer. Auswahlheuristik
  (eingehende Abhängigkeiten absteigend, dann ausgehende, dann Dateipfad
  alphabetisch) unverändert — bleibt deterministisch.
- Override-Datei `tools/atlas-overrides/<id>.json` mit `pin`/`hide`/`labels`
  — unverändert, siehe unten für die Erweiterung.
- `assets/js/atlas-data.js` (Lazy-Load, `isValidAtlas`, Cache) — unverändert,
  da das Datenformat gleich bleibt.
- Attribution an den drei vorgesehenen Stellen (Atlas-JSON, Projektfenster,
  README) — unverändert, gleicher Text.
- Fehlerbehandlung-Leitlinie „die Szene darf nie kaputtgehen" — unverändert,
  siehe Abschnitt 3 unten für die angepassten Fälle.

## Was ersetzt wird

Komplett entfällt: `assets/js/atlas-layout.js` (Ring-Geometrie,
`computeAtlasLayout`, `maxLevelFor`, `ATLAS_MIN_VIEWPORT`), der
Regler (`<input type="range">` im Projektfenster), die Kamerafahrt
(`stageScale()`-Boost 1.35×, Transform-Origin-Wanderung auf die
Planetenposition), `atlasTipPos()`, sämtliche SVG-Renderblöcke für
Atlas-Ringe/-Knoten/-Kanten in `index.html`, sowie die drei nummerierten
Reglerstufen als State-Konzept (`atlasLevel`).

Damit entfallen auch alle vier in `CLAUDE.md` dokumentierten Runtime-Fallen,
soweit sie am Atlas hingen: der Schmalviewport-Geometriezweig, die
1000px-Sichtbarkeitsschwelle, die Transform-Origin-Klemmung, die
Gegenskalierung des Hinweiskastens. Der Atlas lebt nach diesem Redesign
ausschließlich als Inhalt *innerhalb* des Projektfensters, nie auf der
Bühne selbst — es gibt keine Bühnengeometrie mehr, die brechen könnte.

## 1. Darstellung: Terminal-Liste

**Vorbild im eigenen Repo:** der bestehende Tech-Stack-Umschalter im
Projektfenster (`index.html:411`, State `tech`, `toggleTech`,
`grid-template-rows: 0fr → 1fr`-Übergang). Gleiches Muster, zweifach
verschachtelt:

- **Äußerer Toggle** — Button „Architektur anzeigen" / „Architektur
  verbergen" im Projektfenster, ersetzt den heutigen Regler-Block
  (`atlasAvailable`-Bedingung bleibt als Sichtbarkeits-Gate, siehe unten).
  Öffnet/schließt die gesamte Atlas-Sektion.
- **Innere Toggles** — pro Layer ein eigener Button mit Pfeil-Marker (▸/▾)
  und Layer-Label + Modulzahl (z. B. „▸ Agenten-Kern (7)"). Mehrere Layer
  gleichzeitig aufklappbar, kein Akkordeon-Zwang auf „nur einer offen".
  Aufgeklappt zeigt jeder Layer seine Module als Karten: Label (Dateiname),
  gekürzte Summary (siehe Abschnitt 2), Dep-Tags als reiner Text („nutzt:
  guardrails.py, llm.py"). Der Sammelknoten „+N weitere" ist eine
  nicht-interaktive Textzeile am Ende der Kartenliste.

**Kein Canvas, kein SVG, keine Koordinatenberechnung.** Die gesamte Atlas-
Darstellung ist HTML im Template-Block, genau wie die Tech-Stack-Liste.
Farbgebung: Layer-Label und Rahmen der Modul-Karten in `activeAccent` (die
Cluster-Farbe des Projekts) — dieselbe Farbzuordnung wie heute, nur ohne
räumliche Punkte.

**Sichtbarkeits-Gate.** `atlasAvailable` bleibt als Bedingung (Projekt hat
einen Atlas laut `index.json`), verliert aber die Viewport-Prüfung
vollständig — die Liste funktioniert bei jeder Breite, da sie kein Rendering-
Kollisionsrisiko mehr hat. Das ist eine echte Verbesserung gegenüber der alten
Spec: mobile Besucher (< 1000px) sahen den Atlas bisher nie, jetzt sehen sie
ihn wie jeden anderen Fensterinhalt.

**Laden.** Weiterhin lazy — jetzt ausgelöst durch den ersten Klick auf den
äußeren Toggle statt durch einen Reglerwechsel auf Stufe 2. Gleiches
Cache-Verhalten (`atlas-data.js`, pro Projekt einmal).

## 2. Text-Vereinfachung im Generator

Zwei unabhängige, kombinierte Maßnahmen — Ergebnis der Diskussion mit Marco:
die reine Struktur-Kappung (6/8) begrenzt die *Breite*, sagt aber nichts über
die *Dichte* der einzelnen Summary-Texte, die im neuen Kartenformat direkt als
Fließtext erscheinen.

### 2a. Automatische Summary-Kürzung (`gen-atlas.mjs`)

Neue, deterministische Regel, angewendet auf `layer.summary` und
`module.summary` beim Schreiben von `data/atlas/<id>.json`:

1. Ersten Satz extrahieren (Trennzeichen: `. ` gefolgt von Großbuchstabe, um
   Abkürzungen nicht als Satzende zu werten).
2. Ist der erste Satz länger als 140 Zeichen, an der letzten Wortgrenze vor
   Zeichen 140 abschneiden und mit `…` markieren.
3. Ist der erste Satz kürzer oder gleich 140 Zeichen, unverändert übernehmen
   (kein künstliches Auffüllen oder Anhängen).

Deterministisch und unit-testbar wie die bestehende Auswahlheuristik — reine
Textfunktion, keine LLM-Erneutanalyse nötig. Die volle Understand-Anything-
Summary geht dabei verloren; das ist akzeptiert (Anzeige-Zweck, nicht
Archiv-Zweck — das vollständige Rohgraph-Ergebnis bleibt ohnehin lokal in
`.ua/`, siehe alte Spec, Abschnitt „Bewusst weggelassen").

### 2b. Redaktionelle Highlights (Override-Erweiterung)

`tools/atlas-overrides/<id>.json` bekommt ein neues optionales Feld:

```json
{ "pin": [...], "hide": [...], "labels": {...}, "highlights": ["…", "…"] }
```

`highlights` ist ein Array von 1-3 Sätzen (freie Länge, redaktionell
verfasst — keine 140-Zeichen-Regel, das ist von Hand kuratiert). Vorhanden,
erscheint es als Teaser-Absatz direkt unter dem äußeren Toggle, noch bevor
irgendein Layer aufgeklappt wird. Fehlt das Feld oder die Datei, entfällt der
Teaser ersatzlos — kein Platzhaltertext. Gleiches Muster wie `pin`/`hide`:
optional, additiv, ohne Override-Datei verhält sich der Generator wie zuvor.

### Struktur-Kappung — unverändert

6 Layer, 8 Module pro Layer bleiben. Diskutiert und von Marco bestätigt: die
Zwänge hinter beiden Zahlen sind mit dem Formatwechsel unterschiedlich
geworden (Kollisionsvermeidung → Scroll-Länge), aber mit der Summary-Kürzung
aus 2a sind Kartenlisten kurz genug, dass die bestehenden Zahlen weiter
vertretbar sind. Keine Änderung an `atlas-reduce.mjs` nötig.

## 3. Fehlerbehandlung

| Fall | Verhalten |
| --- | --- |
| Projekt hat keinen Atlas | Toggle erscheint nicht. Kein Fehler, kein Hinweis. |
| `fetch` der Atlas-Datei schlägt fehl | Toggle bleibt sichtbar und bedienbar, aber aufgeklappt erscheint eine ruhige Zeile „Architekturdaten gerade nicht verfügbar" statt der Layer-Liste. Szene und übriges Fenster bleiben intakt. |
| Atlas-JSON kaputt / Schema passt nicht | Wie oben — `isValidAtlas` fängt es beim Laden ab, unverändert. |
| Atlas verweist auf falsche `id` | Vom Generator abgefangen (Abbruch mit Meldung), nicht zur Laufzeit — unverändert. |
| Zu viele Layer/Module | Kann zur Laufzeit nicht auftreten — im Generator gekappt, unverändert. |
| Schmaler Viewport | Kein Sonderfall mehr — die Liste ist responsiv wie jeder andere Fensterinhalt. |

Kein Zustand mehr, der einen Kamera-Reset oder eine Fokus-Wiederherstellung
braucht (`atlasHover`-Reset-Logik, Fix-Runde 5 der alten Spec) — es gibt
keine Kamera mehr, die zurückgesetzt werden müsste.

## 4. Tests

- `gen-atlas.mjs`-Tests (Kappung, Determinismus, Override-Datei) bleiben
  gültig, erweitert um: Summary-Kürzungsregel (Satzende-Erkennung,
  140-Zeichen-Grenze, Wortgrenzen-Schnitt, Fälle mit und ohne `highlights`
  in der Override-Datei).
- `atlas-layout.js`-Tests entfallen ersatzlos mit der Datei.
- `atlas-data.js`-Tests (Validierung, Cache, `hasAtlas`) bleiben unverändert
  gültig — Datenformat und Lade-Logik ändern sich nicht.
- Neu keine eigene Layout-Testdatei nötig, da die Darstellung reines HTML im
  Template-Block ist (gleiche Testabdeckung wie der bestehende, ungetestete
  Tech-Stack-Toggle in v3 — konsistent mit dem Rest von v3, siehe `CLAUDE.md`).
- Manuell im Browser: Toggle-Verhalten bei 375px und 1280px, mehrere Layer
  gleichzeitig offen, Fehlerzeile bei simuliertem Fetch-Fehler, Highlights-
  Teaser mit und ohne Override-Datei.

## Migration

Bereits committete Atlas-Daten (`data/atlas/sql-agent.json`,
`data/atlas/index.json`) bleiben strukturell gültig — nur `gen-atlas.mjs`
läuft erneut, um die gekürzten Summaries zu erzeugen. Kein manueller
Dateneingriff nötig, kein Schema-Bruch.

## Definition of Done

1. `assets/js/atlas-layout.js` und zugehörige Tests entfernt.
2. Regler, Kamerafahrt, SVG-Renderblöcke für den Atlas aus `index.html`
   entfernt.
3. Neuer Toggle + verschachtelte Layer-Akkordeons im Projektfenster
   implementiert, Farbgebung über `activeAccent`.
4. `gen-atlas.mjs` um Summary-Kürzungsregel erweitert, unit-getestet.
5. Override-Schema um optionales `highlights`-Feld erweitert, dokumentiert.
6. `sql-agent.json` mit dem aktualisierten Generator neu erzeugt.
7. Funktioniert ohne Viewport-Sonderfall bei 375px und 1280px, verifiziert.
8. Fehlerzeile bei simuliertem Fetch-Fehler verifiziert.
9. `npm test` grün.
10. `CLAUDE.md`-Abschnitt „Code Atlas" auf die neue Darstellung aktualisiert
    (Regler-Sprache raus, Toggle/Akkordeon-Sprache rein, 1000px-Schwelle als
    überholt markiert).
