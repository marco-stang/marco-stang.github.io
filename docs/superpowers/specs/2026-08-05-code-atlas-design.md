# Code Atlas — Tiefen-Regler in den Planeten hinein — Design

## Problem / Ziel

Ein Planet in MARCO.OS zeigt heute die *Außenansicht* eines Projekts:
Beschreibung, Tags, Stats, Demo-Link, Repo-Link. Wer wissen will, **wie**
das Projekt gebaut ist, muss die Szene verlassen und auf GitHub Code lesen.
Genau das tut ein Recruiter nicht, und ein technischer Interviewer tut es
erst, wenn ihn etwas neugierig gemacht hat.

Ziel: einen Tiefen-Regler pro Planet, der die Architektur des jeweiligen
Repos **innerhalb der Szene** sichtbar macht — der Planet öffnet sich zu
seinem eigenen System aus Layern und Modulen. Die Metapher bleibt dieselbe,
nur eine Ebene tiefer.

Nicht-Ziel dieser Spec: der seitenweite Persona-Schalter (HR/Dev). Der ist
als eigenes Backlog-Item vorgesehen und baut auf den hier definierten Stufen
auf (Voreinstellung HR = Stufe 1, Dev = Stufe 3). Siehe „Bewusst
weggelassen".

## Datenquelle: Understand-Anything

[Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)
(Egonex-AI, MIT) analysiert ein Repo hybrid: Tree-sitter zieht deterministisch
die Struktur (Imports, Funktionen, Klassen), LLM-Agenten legen die semantische
Schicht darüber (Summaries, Architektur-Layer, Business-Domänen). Ergebnis ist
eine `.ua/knowledge-graph.json`.

**Es wird ausschließlich als Datenquelle genutzt, nie als UI.** Zwei Gründe:

1. Ihr Dashboard/Viewer ist ein Node-Prozess (`npx …`, Node ≥ 18, laufender
   Server). marco-os liegt auf GitHub Pages — statisch, kein Build-Step, kein
   Backend. Das ist technisch nicht einbettbar.
2. Selbst wenn es ginge, hätte es eine fremde Designsprache. Die Szene *ist*
   die Seite (siehe `PRODUCT.md`, Produktprinzip 1) — ein iframe mit fremdem
   Dashboard wäre der Fremdkörper, den dieses Projekt konsequent vermeidet.

Die Aufteilung ist damit sauber: **Understand-Anything liefert den Rohgraph,
die Reduktion und die Darstellung sind Eigenleistung.**

### Attribution — verbindlich

Der Atlas muss an drei Stellen kenntlich machen, woher der Rohgraph kommt:
im Atlas-JSON (`source`-Feld), sichtbar im Projektfenster bei aktivem Regler
(eine Zeile, z. B. „Graph-Extraktion: Understand-Anything (MIT) · Reduktion
und Darstellung: eigene Pipeline"), und im README des Repos. Das ist keine
Formalie, sondern folgt direkt aus Produktprinzip 2 („Jede Aussage auf der
Seite ist echt und prüfbar"). Fremde Analyse als eigene Leistung erscheinen
zu lassen, würde genau das Prinzip verletzen, das die Seite trägt.

## Architektur-Kontext (vor dem Anfassen lesen)

- Die Planeten-Geometrie liegt **nicht** in `assets/js/sky-v3.js` — das ist
  Canvas-Hintergrund (Nebel, Sterne, Sternschnuppen). Sie liegt in der
  Methode `layout(D)` im `<script type="text/x-dc">`-Block von `index.html`
  (Zeile 796–876), aufgerufen aus `renderVals` (Zeile 909). Die Kamera ist
  `stageTransform()` (Zeile 691–696), die den Buehnen-Transform liefert.
- Dieser Template-Block ist normaler App-Code und darf bearbeitet werden.
  `assets/js/dc-support.js` ist die generierte Runtime mit „do not edit" im
  Header und **wird nicht angefasst**.
- Vorhandene Mechanik, an die angedockt wird statt sie neu zu bauen:
  - `state.active` — aktives Projekt, treibt schon die Dimm-Logik über
    `focusId` (index.html:872).
  - `state.zoom` / `zoomIn` / `zoomOut` — Zoom existiert bereits.
  - `variant: "orbit" | "karte"` mit Tab-Umschalter (index.html:888–889) —
    Präzedenz für einen Ansichts-Zustand im State.
  - `moon: true` (index.html:846–855) — Trabanten um einen Knoten sind kein
    Neuland.
- Präzedenz für Generator-Skripte: `tools/gen-nebula.mjs`,
  `tools/gen-diagram.mjs`.

### Die vier dokumentierten Fallen dieser Runtime

Aus `CLAUDE.md`, alle bereits einmal passiert, alle leicht wieder
einzubauen — besonders Nr. 2 und 3 sind für diese Arbeit akut:

1. Dynamisches `import()` im Template-Block löst relativ zu `dc-support.js`
   auf, nicht zum Dokument. `new URL(name, document.baseURI)` benutzen.
   Absolute `/assets/…`-Pfade brechen auch, weil Pages unter `/marco-os/`
   ausliefert. **Betrifft diese Arbeit direkt**, weil die Atlas-Dateien per
   `fetch` nachgeladen werden.
2. `const`-Helfer, die in `componentDidMount` benutzt werden, müssen vor
   ihrer ersten Verwendung deklariert sein — der Template-Block ist ein
   einziger Scope.
3. Geometrie braucht einen Schmal-Zweig (`w < 760`). Ohne den wurde `maxRx`
   negativ, SVG verwarf die Ellipsen und alle Planeten fielen auf die Sonne.
   **Betrifft diese Arbeit direkt**, weil neue Ringe hinzukommen.
4. Mobile-Chrome läuft über `@media (max-width: 760px)` mit `!important`,
   weil die Elemente Inline-Styles tragen.

## 1. Pipeline & Datenformat

```
 [Projekt-Repo]                 [marco-os]                    [Browser]
      │                              │                             │
 /understand                         │                             │
      │                              │                             │
      ▼                              │                             │
 .ua/knowledge-graph.json ──► tools/gen-atlas.mjs ──► data/atlas/<id>.json
   (MB, bleibt im Repo)          (Reduktion)          (< 50 KB, committed)
                                                              │
                                                     lazy fetch bei Stufe ≥ 2
```

**Schritt 1 — `/understand` im jeweiligen Projekt-Repo.** Erzeugt
`.ua/knowledge-graph.json`. Die Rohdatei bleibt dort und wandert dort in die
`.gitignore`; sie wird **nicht** nach marco-os kopiert.

**Schritt 2 — `tools/gen-atlas.mjs`** (Eigenleistung, unit-getestet):

```bash
node tools/gen-atlas.mjs <pfad-zum-repo> <projekt-id>
# liest  <pfad-zum-repo>/.ua/knowledge-graph.json
# schreibt data/atlas/<projekt-id>.json  und aktualisiert data/atlas/index.json
```

**Schritt 3 — Lazy Load im Browser.** `data/atlas/index.json` (wenige hundert
Byte) wird beim Start mitgeladen und sagt der Szene nur, *welche* Projekte
einen Atlas haben — davon hängt ab, ob der Regler überhaupt erscheint. Die
eigentliche Atlas-Datei wird erst geholt, wenn der Regler auf Stufe 2 geht,
und pro Projekt genau einmal gecacht. Dasselbe Muster wie
`assets/js/github-activity.js`, aus demselben Grund: die Startseite darf
nicht langsamer werden.

### Reduziertes Schema

```js
{
  id: "sql-agent",                    // muss zu data/projects.js passen
  repo: "sql-copilot",
  generatedAt: "2026-08-05",
  source: { tool: "understand-anything", version: "…", license: "MIT" },
  layers: [                            // Stufe 2 → Ringe um den Planeten
    { id: "ui",     label: "Oberfläche",  summary: "…", count: 3 },
    { id: "agent",  label: "Agent-Logik", summary: "…", count: 7 }
  ],
  modules: [                           // Stufe 3 → Knoten auf den Ringen
    { id: "app",    layerId: "ui",    label: "app.py",
      file: "src/app.py", summary: "…", deps: ["graph"] }
  ]
}
```

`count` ist die **wahre** Anzahl im Layer, auch wenn nur ein Teil der Module
ausgeliefert wird — damit die Szene ehrlich „7 Module, 5 gezeigt" anzeigen
kann statt eine gekappte Zahl als Gesamtzahl auszugeben.

### Kappung — im Generator, nicht zur Laufzeit

Grenzen: max. 6 Layer, max. 8 Module pro Layer. Was wegfällt, wird pro Layer
zu **einem** Sammelknoten „+14 weitere" zusammengefasst, damit die Kappung
sichtbar bleibt statt Module stillschweigend zu verschlucken.

Auswahlheuristik: absteigend nach Anzahl eingehender Abhängigkeiten (ein
Modul, von dem viel abhängt, ist architektonisch aussagekräftiger als eins,
das nur konsumiert). Bei Gleichstand entscheidet die Anzahl ausgehender
Abhängigkeiten, danach der Dateipfad alphabetisch — damit der Generator
**deterministisch** ist und ein erneuter Lauf ohne Code-Änderung kein Diff
erzeugt.

**Override pro Repo** (optional): `tools/atlas-overrides/<projekt-id>.json`
mit `{ pin: ["modul-id", …], hide: ["modul-id", …] }`. `pin` erzwingt
Aufnahme, `hide` erzwingt Ausschluss, alles andere füllt die Heuristik auf.
Existiert die Datei nicht, ist der Lauf rein automatisch. Begründung: welche
8 Module ein Layer repräsentieren, ist eine **redaktionelle** Entscheidung,
keine technische — bei einem Portfolio-Projekt willst du gelegentlich genau
das Modul zeigen, das die interessante Designentscheidung enthält, auch wenn
wenig davon abhängt.

> Entscheidung ohne Rückfrage getroffen (2026-08-05): Kappung automatisch mit
> optionaler Override-Datei, statt rein automatisch. Kostet im Generator
> wenig und ist später schwer nachzurüsten, wenn das Schema steht.

## 2. Szene & Interaktion

### Die drei Stufen

| Stufe | Was zu sehen ist | Datenquelle |
| --- | --- | --- |
| 1 | Heutiger Zustand: Planet im Cluster-Ring, Projektfenster offen | `data/projects.js` |
| 2 | Kamera auf dem Planeten, er ist das Zentrum, Layer als Ringe | `layers[]` |
| 3 | Zusätzlich Module als Knoten auf ihren Layer-Ringen, Kanten = `deps` | `modules[]` |

### Kamerafahrt (Ansatz A)

Beim Wechsel 1 → 2 wird der aktive Planet zum Ursprung der Layout-Berechnung:
`layout(D)` bekommt einen zweiten Modus, in dem die Ringe um die
Planetenposition statt um die Bildschirmmitte liegen und aus `layers[]` statt
aus den Clustern kommen. Die restliche Szene (Sonne, andere Planeten,
Cluster-Ringe) bleibt gerendert, dimmt aber stark ab — der vorhandene
`focusId`-Dimm-Pfad (index.html:872) wird dafür erweitert, nicht ersetzt.

Die Kamerafahrt selbst braucht **keine eigene Animations-Engine**: der
Skalierungsursprung der Bühne (`transform-origin`) wandert von der Mitte auf
die Planetenposition, und der vorhandene Zoomfaktor in `stageTransform()`
(index.html:691–696) wird angehoben. Dadurch bleibt der Planet beim Hochregeln
stehen, während die Szene um ihn herum wächst — das liest sich als Hineinfliegen
und läuft über dieselbe `transform`-Transition, die der Zoom schon benutzt.

Bei `prefers-reduced-motion` entfällt der Flug und die Stufe wechselt als
harter Schnitt — konsistent mit Boot-Sequenz und Starfield, die das schon so
handhaben.

Zurück: Regler runter, `Esc`, oder Fenster schließen → zurück auf Stufe 1 und
in die Ausgangsansicht. Es gibt keinen Zustand, aus dem der Besucher nicht mit
einem Klick herauskommt.

### Der Regler

- Erscheint **nur**, wenn ein Projekt aktiv ist *und* in `index.json` einen
  Atlas hat *und* der Viewport ≥ 760 px breit ist. Kein ausgegrauter Regler
  bei Projekten ohne Atlas oder auf schmalem Viewport — er ist dann schlicht
  nicht da. Ein deaktiviertes Bedienelement wirft die Frage auf, warum es
  nicht geht; ein fehlendes wirft sie nicht auf. (Die 760-px-Grenze ist eine
  spätere Korrektur — siehe „Korrektur nach Umsetzung" unten; ursprünglich
  war hier eine reduzierte Zwei-Stufen-Variante vorgesehen.)
- Sitzt im Projektfenster, nicht in der globalen Leiste — er gilt für *dieses*
  Projekt. (Der spätere Persona-Schalter ist der globale, das darf sich
  visuell nicht vermischen.)
- Drei Rastpositionen mit Beschriftung („Projekt / Struktur / Code"), nicht
  stufenlos. Ein stufenloser Regler verspricht Zwischenwerte, die es nicht
  gibt.
- Bedienbar per Tastatur (Pfeiltasten, wie ein `<input type=range>`), da die
  Szene sonst rein maus-getrieben wäre.

### Neue Knotentypen

Layer-Knoten und Modul-Knoten brauchen eine eigene visuelle Sprache, die sie
klar von Projekt-Planeten trennt — sonst liest man den Atlas als „noch mehr
Projekte". Vorschlag: Layer als beschriftete Ringe ohne eigenen Knotenkörper,
Module als kleine, einfarbige Punkte in der Cluster-Farbe des Projekts (keine
Planeten-Bilder). Der Sammelknoten „+14 weitere" ist visuell offensichtlich
anders (gestrichelt/hohl) und **nicht klickbar**.

Hover auf einem Modul zeigt dessen `summary` im vorhandenen Tooltip-Pfad
(`tipText`, index.html:998).

## 3. Fehlerbehandlung

Leitlinie: **die Szene darf nie kaputtgehen.** Sie ist die ganze Seite — ein
Fehler im Atlas darf nicht die Startseite kosten. Muster ist bereits im Repo
vorhanden (`try { this.measureLabelsBody(); } catch` — index.html:545).

| Fall | Verhalten |
| --- | --- |
| Projekt hat keinen Atlas | Regler erscheint nicht. Kein Fehler, kein Hinweis. |
| `fetch` der Atlas-Datei schlägt fehl | Regler springt auf Stufe 1 zurück, eine ruhige Zeile im Fenster („Architekturdaten gerade nicht verfügbar"). Szene bleibt intakt. |
| Atlas-JSON ist kaputt / Schema passt nicht | Wie oben. Validierung beim Laden, nicht Vertrauen auf Wohlgeformtheit. |
| Atlas verweist auf `id`, die es in `projects.js` nicht gibt | Vom Generator abgefangen (Abbruch mit klarer Meldung), nicht zur Laufzeit. |
| Zu viele Knoten | Kann zur Laufzeit nicht auftreten — im Generator gekappt. |
| Schmaler Viewport (`w < 760`) | Eigener Zweig in der Layout-Funktion, siehe Falle 3. Unterhalb 760 px **erscheint der Regler gar nicht** — nicht zwei Stufen wie ursprünglich hier geplant. Begründung siehe Korrektur unten. |

## 4. Tests

Das Repo testet mit `node --test` (`npm test`, 78 Tests) und verifiziert
Visuelles manuell im Browser bei 375 px und 1280 px. Diese Aufteilung wird
übernommen:

**Unit-getestet (`tests/*.test.js`):**

- `tools/gen-atlas.mjs` — Reduktionslogik gegen eine Fixture-
  `knowledge-graph.json`: Kappung bei > 6 Layern und > 8 Modulen, korrekter
  `count` trotz Kappung, Sammelknoten-Erzeugung, Determinismus (zweimal
  laufen lassen → identisches Ergebnis), Override-Datei (`pin`/`hide`),
  fehlende/leere Felder im Rohgraph, unbekannte `id`.
- Die Atlas-Layout-Funktion — als **reine, DOM-freie Funktion in einer
  eigenen Datei**, nicht im Template-Block. `assets/js/graph-layout.js` macht
  genau das für das Legacy-Frontend vor. Getestet wird: alle Knoten innerhalb
  des Viewports, keine negativen Radien bei `w < 760` (Falle 3), stabile
  Reihenfolge, korrekte Zuordnung Modul → Layer-Ring.

Das ist die Sicherung, die Ansatz A überhaupt vertretbar macht: der riskante
Teil ist testbar, *bevor* er die Szene anfasst.

**Manuell im Browser:** Kamerafahrt und Übergänge, Lesbarkeit von Stufe 3 bei
375 px und 1280 px, `prefers-reduced-motion`, Tastaturbedienung des Reglers,
Rückweg aus jeder Stufe.

## 5. Umfang

**Pilot zuerst, dann Fließband.** Zwei Repos zum Start:

- `sql-copilot` — die reichste Architektur-Story (LangGraph-Agent, Guardrails,
  Korrektur-Loop, DB-Zugriff). Wenn der Atlas *hier* nichts Interessantes
  zeigt, taugt die Idee nicht, und das merkt man am billigsten hier.
- `marco-os` selbst — der Graph zeigt die Seite, auf der er läuft. Das ist
  der selbstreferenzielle Moment, der im Interview hängenbleibt.

Erst wenn beide stehen und sich in echt bewährt haben, kommen die übrigen
Repos dazu — dann ist es reine Wiederholung derselben zwei Befehle.

> Entscheidung ohne Rückfrage getroffen (2026-08-05): Pilot mit 2 Repos statt
> alle 9 auf einmal. Grund: `/understand` kostet pro Repo LLM-Zeit, und die
> Qualität des Rohgraphen ist vorab unbekannt — das will man an zwei Repos
> herausfinden, nicht an neun.

### Eigener Planet

„Code Atlas" wird ein eigener Eintrag in `data/projects.js`, aber **erst
nachdem der Pilot läuft** — ein Planet für etwas, das noch nicht funktioniert,
verletzt Produktprinzip 2. Der Eintrag beschreibt ehrlich, was Eigenleistung
ist (Reduktions-Pipeline, Layout, Szenen-Integration) und was zugekauft
(Graph-Extraktion via Understand-Anything, MIT).

> Arbeitstitel „Code Atlas" — ohne Rückfrage gesetzt, jederzeit änderbar,
> solange es vor dem `projects.js`-Eintrag passiert (die `id` dort ist ein
> interner Schlüssel und muss ohnehin nicht dem Ordnernamen entsprechen).

### Bewusst weggelassen

- **Seitenweiter Persona-Schalter (HR/Dev)** — eigenes Backlog-Item, baut auf
  diesen Stufen auf (HR = 1, Dev = 3). Braucht zusätzlich zwei Textvarianten
  pro Projekt und ist damit eher Content- als Code-Arbeit.
- **Suche im Graph, Diff-Impact-Analyse, geführte Tours** — kann ihr
  Dashboard, wir nicht. Nachbauen hieße, ein Tool zu klonen statt ein
  Portfolio zu bauen.
- **Automatische Aktualisierung bei jedem Commit** (ihr Post-Commit-Hook) —
  der Atlas wird manuell neu erzeugt, wenn sich ein Repo wesentlich ändert.
  Ein Portfolio-Repo ändert sich selten genug, dass Automatisierung hier
  Aufwand ohne Nutzen wäre.
- **Rohgraph im Repo** — nur die reduzierte Fassung wird committed. Die
  `.ua/`-Rohdaten bleiben lokal.
## Erledigt: Sprache der Summaries

Die Seite ist durchgängig deutsch (Produktprinzip 4). Diese Spec hatte offen
gelassen, wie die Summaries dorthin kommen, weil das README Deutsch nicht
unter den unterstützten Ausgabesprachen listet (nur en, zh, zh-TW, ja, ko, ru)
und ohne echte Daten nicht entscheidbar war, wie brauchbar englische Summaries
wären.

**Am Pilot beantwortet (2026-08-05): es ist nichts zu tun.** `.ua/config.json`
trägt `{"outputLanguage": "de"}`, und der erzeugte Graph ist durchgängig
deutsch — Layer heißen „Agenten-Kern", „Datenebene", „Präsentationsebene", die
Modul-Summaries sind ausformuliertes Deutsch. Undokumentiert, aber funktionierend.

Weder ein Übersetzungsschritt im Generator noch handgesetzte Layer-Labels sind
nötig. Der Override-Weg (`labels` in `tools/atlas-overrides/<id>.json`) bleibt
als Rückfallebene bestehen, falls ein späteres Repo doch englisch herauskommt.

## Korrektur nach Umsetzung: Regler unter 760 px

Diese Spec sah unter 760 px ursprünglich eine reduzierte Zwei-Stufen-Variante
des Reglers vor („Projekt / Struktur", Stufe 3 abgeschaltet). In der
Umsetzung (Fix-Runde 3) hat sich das als nicht haltbar erwiesen: bei 375 px
Breite deckt das Projektfenster fast die gesamte Bildschirmbreite ab —
gemessen blieben 55 px frei —, sodass selbst der Atlas auf Stufe 2 komplett
hinter dem Fenster läge und für den Besucher nicht sichtbar wäre. Ein Regler,
der nachweislich keine sichtbare Stufe erreicht, ist unehrlich.

Marcos Entscheidung auf Basis dieser Messung: der Regler erscheint unterhalb
760 px gar nicht. `maxLevelFor()` in `assets/js/atlas-layout.js` liefert dort
Stufe 1, und `atlasAvailable` in `index.html` verlangt zusätzlich, dass mehr
als eine Stufe erreichbar ist. Alle Stellen oben, die noch von „zwei Stufen
unter 760 px" sprechen, sind durch diese Entscheidung überholt.

## Definition of Done

1. `tools/gen-atlas.mjs` existiert, ist deterministisch und unit-getestet.
2. Atlas-Layout-Funktion liegt als reine Datei vor und ist unit-getestet.
3. `data/atlas/` enthält `index.json` plus die zwei Pilot-Atlanten.
4. Der Regler funktioniert in `index.html` über alle drei Stufen, hin und
   zurück, mit Tastatur, bei 375 px und 1280 px verifiziert.
5. `prefers-reduced-motion` respektiert.
6. Attribution an allen drei vorgesehenen Stellen vorhanden.
7. `npm test` grün (bestehende 78 Tests plus neue).
8. `CLAUDE.md` um den Atlas-Abschnitt ergänzt (Pipeline, wo was liegt, wie
   man einen Atlas neu erzeugt).
9. Erst danach: Entscheidung über den eigenen `projects.js`-Eintrag.
