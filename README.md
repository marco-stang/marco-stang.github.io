# marco-os

Ein KI-Portfolio als fiktives Betriebssystem: die Seite präsentiert sich als
"MARCO.OS"-Desktop, dessen Hintergrund ein lebendiges Netz aus Projekten ist —
Marco im Zentrum, jedes Projekt ein Planet auf seinem Cluster-Orbit. Ein Klick
öffnet ein Terminal-Fenster mit Projektdetails und der Live-Demo.

**Live: https://marco-stang.github.io/**

## Zwei Frontends im selben Repo

Seit dem 03.08.2026 ist die Startseite das **v3-Redesign**. Die vorherige
Fassung liegt unverändert daneben:

| | Datei | erreichbar unter |
| --- | --- | --- |
| **v3** (live) | `index.html` | `/` |
| Vorgänger | `index-legacy.html` | [`/index-legacy.html`](https://marco-stang.github.io/index-legacy.html) |

v3 kam als fertiges Paket von außen und rendert über `assets/js/dc-support.js`
— eine generierte Mini-React-Laufzeit, die als "do not edit" markiert ist. Die
Legacy-Seite ist handgeschriebenes Vanilla-JS aus ES-Modulen. Beide teilen sich
sämtliche Inhalte (siehe unten) und die Analytics.

Der Umstieg steckt in genau einem Commit (`2a5b063`), damit ein einzelnes
`git revert` die alte Startseite zurückholt.

## Lokal ausprobieren

Kein Build-Schritt, aber ein lokaler HTTP-Server ist nötig — `index.html`
direkt per Doppelklick zu öffnen funktioniert **nicht**, weil Browser
ES-Module unter `file://` blockieren.

```bash
start-local.bat          # Windows: Server auf Port 8000 + Browser
python -m http.server 8000   # alle anderen, dann http://localhost:8000/
```

**Falle:** `http.server` schickt keine Cache-Header. Nach Änderungen an JS oder
CSS hart neu laden (Strg+Shift+R), sonst siehst du den alten Stand.

## Tests

```bash
npm test
```

Läuft über Node's eingebauten Test-Runner, keine Abhängigkeiten. 101 Tests über
`graph-layout`, `state` (inkl. Zoom-Clamping), `projects`, `resume`,
`html-utils`, `focus-target`, `face-constellation`, `terminal-commands`
(Legacy-Parser, Tour-Schrittdaten, GitHub-Datumsformatierung) und
`terminal-v3` (v3-Parser plus die aus `data/` abgeleiteten Daten).

`node --test tests/` mit Verzeichnis funktioniert auf diesem Node-Build
**nicht** — `npm test` oder `node --test "tests/*.test.js"` benutzen.

Getestet sind die Legacy-Module, die geteilten Daten und der v3-Terminal-Parser.
Was eine Bühne braucht — Orbit-Layout, Label-Kollisionen, Boot-Ablauf, Fenster —
wird im Browser verifiziert (375 px und 1280 px+).

## Inhalte pflegen

Alles Inhaltliche liegt in `data/` und wird von **beiden** Frontends gelesen —
nichts ist doppelt zu pflegen:

| Datei | Inhalt |
| --- | --- |
| `data/projects.js` | Projekte (`id`, `title`, `summary`, `description`, `tags`, `demoUrl`, `repoUrl`, `status`, `cluster`, optional `stats`, `orbitsCenter`, `shortTitle`) |
| `data/resume.js` | Lebenslauf, PDF- und LinkedIn-Adresse |
| `data/tour.js` | Schritte der geführten Tour |
| `data/boot.js` | ASCII-Logo und Boot-Zeilen |

Ein neues Projekt braucht nur einen Eintrag in `data/projects.js` — die
Position im Graphen wird zur Laufzeit berechnet, keine Koordinatenpflege.

**Drei Dinge, die überraschen können:** Die Reihenfolge in `data/projects.js`
bestimmt die Anordnung der Planeten, ein Umsortieren verschiebt also die Live-Seite.
`orbitsCenter: true` heißt "umkreist Marco statt eines Cluster-Rings" — v3 nennt
dasselbe Feld intern `moon`. Und `shortTitle` ist das Knoten-Label unter 760 px
Breite; ohne diese Kurzform überlappen sich lange Titel auf dem Handy.

## Struktur

**Geteilt von beiden Frontends**

- `data/` — alle Inhalte (siehe oben)
- `assets/js/analytics.js` — GoatCounter, cookielos: Besucherzählung und
  Demo-Start-Events
- `assets/fonts/` — self-gehostete Webfonts (Space Grotesk + JetBrains Mono,
  kein Google-Fonts-CDN → DSGVO-sicher)
- `assets/img/planets/` — Planeten-, Sonnen- und Mond-Grafiken

**Nur v3 (`index.html`, live)**

- `assets/js/dc-support.js` — generierte Laufzeit, **nicht von Hand ändern**
- `assets/js/portfolio-data-v3.js` — Cluster-Farben, Planetenbilder,
  Boot-Farbgebung, Terminal-Parser
- `assets/js/sky-v3.js` — Canvas-Himmel: Nebel, Parallax-Sterne,
  Sternschnuppen, Gesichts-Sternbild

**Nur Legacy (`index-legacy.html`)**

- `assets/js/graph-layout.js` — reine Layout-Funktion (unit-getestet)
- `assets/js/state.js` — zentrales State-Modul (unit-getestet)
- `assets/js/scene.js`, `window-manager.js`, `taskbar.js`, `menubar.js`,
  `hud.js`, `boot.js`, `tour.js`, `router.js`, `starfield.js`
- `assets/js/terminal-commands.js`, `focus-target.js`, `html-utils.js`,
  `github-activity.js` — reine Funktionen, unit-getestet

**Sonstiges**

- `.github/workflows/keep-warm.yml` — prüft die Free-Tier-Demos täglich 7–22 Uhr
  und schlägt fehl, sobald eine schläft. Warmgehalten werden sie von einem
  externen Monitor: GitHub verwarf ~85 % der geplanten Läufe, damit war der
  Workflow als Warmhalter untauglich (Begründung im Kopf der Datei)
- `tools/` — `gen-nebula.mjs` (Nebel-Textur für den Hintergrund),
  `gen-diagram.mjs`, `gen-atlas.mjs` (Code Atlas, siehe unten),
  `portfolio_ui.py` (geteilte Streamlit-Bausteine)
- `data/atlas/` — reduzierte Architektur-Graphen fürs Reinzoomen in Planeten
- `docs/` — Specs, Pläne und Styleguides

## Code Atlas

Reinzoomen in einen Planeten zeigt dessen Architektur direkt in der Szene:
Layer als Ringe, Module als Knoten. Bisher ein Pilot (`sql-agent`), erzeugt
mit `node tools/gen-atlas.mjs ../sql-copilot sql-agent`.

Die Architekturansicht („Code Atlas") nutzt
[Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)
(Egonex-AI, MIT) zur Graph-Extraktion aus den Repos. Reduktions-Pipeline,
Layout und Szenen-Integration sind Eigenleistung.

## Weiterführend

- Arbeitsanweisungen für Claude Code: [CLAUDE.md](CLAUDE.md)
- Aktueller Übergabestand: [HANDOVER.md](HANDOVER.md)
- Offene Punkte: [TODO.md](TODO.md)
- Ursprüngliche Design-Entscheidungen:
  [docs/superpowers/specs/2026-07-28-marco-os-design.md](docs/superpowers/specs/2026-07-28-marco-os-design.md)
