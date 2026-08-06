# Code Atlas Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Code Atlas's ring-geometry/camera-fly UI with a toggle + accordion list inside the project window, and simplify the underlying summary text so the new list format stays scannable.

**Architecture:** `tools/atlas-reduce.mjs` gains a deterministic summary-truncation rule and an optional `highlights` passthrough from the override file — the reduced JSON schema otherwise stays identical. `index.html`'s v3 template drops all ring/camera code (`assets/js/atlas-layout.js`, `stageScale()`'s atlas boost, `stageTransform()`'s atlas branch, `atlasTipPos()`, the SVG ring/node blocks) and replaces the range-input regler with a toggle button + nested per-layer accordions, mirroring the existing `toggleTech` pattern already in this file.

**Tech Stack:** Vanilla JS (ES modules), `node --test` for units, the project's `dc-support.js` template runtime for `index.html` (no test coverage there — same as the rest of v3).

## Global Constraints

- Full design/rationale lives in `docs/superpowers/specs/2026-08-06-code-atlas-redesign-design.md` — read it if a task here feels underspecified.
- `assets/js/dc-support.js` is generated, "do not edit" — never touch it.
- `npm test` must stay green after every task (`node --test` via the npm script — do NOT pass a directory to `node --test` directly, it doesn't discover files on this Node build).
- No new dependencies. No build step.
- German copy throughout (Produktprinzip 4) — every user-facing string added here is German.
- Struktur-Kappung in `atlas-reduce.mjs` (`MAX_LAYERS = 6`, `MAX_MODULES_PER_LAYER = 8`) stays unchanged — do not touch those constants.

---

## Task 1: Summary-Kürzung in `tools/atlas-reduce.mjs`

**Files:**
- Modify: `tools/atlas-reduce.mjs`
- Test: `tests/atlas-reduce.test.js`

**Interfaces:**
- Produces: `export function truncateSummary(text, maxChars = MAX_SUMMARY_CHARS)` and `export const MAX_SUMMARY_CHARS = 140` from `tools/atlas-reduce.mjs`. `reduceGraph()`'s output `layers[].summary` and `modules[].summary` are now truncated through this function — Task 3's `index.html` accordion renders these fields as-is and relies on them already being short.

- [ ] **Step 1: Write the failing tests**

Append to `tests/atlas-reduce.test.js` (extend the existing import line to also pull in `truncateSummary` and `MAX_SUMMARY_CHARS`; add these tests anywhere in the file — order doesn't matter for `node:test`):

```js
import { reduceGraph, MAX_LAYERS, MAX_MODULES_PER_LAYER, truncateSummary, MAX_SUMMARY_CHARS } from "../tools/atlas-reduce.mjs";
```

```js
// --- Summary-Kuerzung -------------------------------------------------------

test("truncateSummary: leerer String bleibt leer", () => {
  assert.equal(truncateSummary(""), "");
});

test("truncateSummary: kurzer Text ohne Satzende bleibt unveraendert", () => {
  assert.equal(truncateSummary("kurzer Text ohne Punkt"), "kurzer Text ohne Punkt");
});

test("truncateSummary: kuerzt auf den ersten Satz", () => {
  assert.equal(
    truncateSummary("Erster Satz hier. Zweiter Satz, der wegfaellt."),
    "Erster Satz hier."
  );
});

test("truncateSummary: laesst Abkuerzungen wie 'z.B.' nicht als Satzende gelten", () => {
  // "z.B." hat keinen Leerraum zwischen Punkt und Grossbuchstabe -- die Regel
  // (Punkt, DANN Leerraum, DANN Grossbuchstabe) darf hier nicht zuschlagen.
  assert.equal(
    truncateSummary("Nutzt Tools wie z.B. LangChain fuer die Anbindung."),
    "Nutzt Tools wie z.B. LangChain fuer die Anbindung."
  );
});

test("truncateSummary: schneidet einen langen ersten Satz an einer Wortgrenze und haengt … an", () => {
  const long = `Dies ist ein sehr langer erster Satz ohne fruehen Punkt der ${"immer weiter geht ".repeat(6)}und schliesslich endet.`;
  const result = truncateSummary(long);
  assert.ok(result.length <= MAX_SUMMARY_CHARS + 1, "Ergebnis darf die Grenze plus Ellipse nicht ueberschreiten");
  assert.ok(result.endsWith("…"));
  assert.ok(!result.slice(0, -1).endsWith(" "), "kein Leerzeichen direkt vor der Ellipse");
});

test("reduceGraph kuerzt Modul-Summaries im Ergebnis", () => {
  const long = `Dies ist ein sehr langer erster Satz ohne fruehen Punkt der ${"immer weiter geht ".repeat(6)}und endet. Ein zweiter Satz faellt weg.`;
  const nodes = fanIn("ui", 1);
  nodes[0].summary = long;
  const atlas = reduceGraph(nodes, OPTS);
  const modul = atlas.modules.find((m) => m.id === "ui-0");
  assert.ok(modul.summary.length < long.length);
  assert.ok(!modul.summary.includes("zweiter Satz"));
});

test("reduceGraph kuerzt Layer-Summaries im Ergebnis", () => {
  const long = `Dies ist ein sehr langer erster Satz ohne fruehen Punkt der ${"immer weiter geht ".repeat(6)}und endet. Ein zweiter Satz faellt weg.`;
  const atlas = reduceGraph(fanIn("ui", 1), {
    ...OPTS,
    layerMeta: [{ id: "ui", label: "Oberflaeche", summary: long }]
  });
  const layer = atlas.layers.find((l) => l.id === "ui");
  assert.ok(layer.summary.length < long.length);
  assert.ok(!layer.summary.includes("zweiter Satz"));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `truncateSummary` is not exported from `tools/atlas-reduce.mjs`.

- [ ] **Step 3: Implement `truncateSummary` and wire it into `reduceGraph`**

In `tools/atlas-reduce.mjs`, add right after the existing `export const MAX_MODULES_PER_LAYER = 8;` line:

```js
// Kartenlisten (Task: Code-Atlas-Redesign) zeigen Summaries als Fliesstext.
// Die rohen Understand-Anything-Summaries sind oft mehrsaetzig und dicht --
// diese Regel kappt auf den ersten Satz, mit einer Zeichenobergrenze als
// Fallback fuer besonders lange Einzelsaetze. Deterministisch, keine
// erneute LLM-Analyse noetig.
export const MAX_SUMMARY_CHARS = 140;

// Satzende: Punkt/Ausruf/Frage, gefolgt von Leerraum und einem Grossbuchstaben
// (inkl. Umlaute). Das Leerraum-Erfordernis laesst deutsche Abkuerzungen wie
// "z.B." oder "bzw." unangetastet, weil dort kein Leerzeichen zwischen Punkt
// und naechstem Buchstaben steht.
const SENTENCE_END = /[.!?]\s+(?=[A-ZÄÖÜ])/;

export function truncateSummary(text, maxChars = MAX_SUMMARY_CHARS) {
  if (!text) return "";
  const match = SENTENCE_END.exec(text);
  const firstSentence = match ? text.slice(0, match.index + 1) : text;
  if (firstSentence.length <= maxChars) return firstSentence;
  const cut = firstSentence.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed}…`;
}
```

Then, inside `reduceGraph()`, find this line (part of the `layers.push({...})` call):

```js
      summary: meta?.summary ?? chosen[0]?.summary ?? "",
```

Replace it with:

```js
      summary: truncateSummary(meta?.summary ?? chosen[0]?.summary ?? ""),
```

And find this line (part of the `layerModules` map):

```js
      id: n.id, layerId: key, label: n.label, file: n.file,
      summary: n.summary, deps: n.deps
```

Replace it with:

```js
      id: n.id, layerId: key, label: n.label, file: n.file,
      summary: truncateSummary(n.summary), deps: n.deps
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/atlas-reduce.test.js` and the full suite green.

- [ ] **Step 5: Commit**

```bash
git add tools/atlas-reduce.mjs tests/atlas-reduce.test.js
git commit -m "feat: kuerze Atlas-Summaries auf den ersten Satz"
```

---

## Task 2: Redaktionelle `highlights` in der Override-Datei

**Files:**
- Modify: `tools/atlas-reduce.mjs`
- Test: `tests/atlas-reduce.test.js`, `tests/gen-atlas.test.js`

**Interfaces:**
- Consumes: nothing new — `tools/gen-atlas.mjs` already passes the full parsed override JSON as `overrides` into `reduceGraph()` (see existing `pin`/`hide`/`labels` handling), so no change is needed in `gen-atlas.mjs` itself.
- Produces: `reduceGraph()`'s returned object now carries an optional `highlights: string[]` field — present only when the override file has at least one valid entry. Task 3's `index.html` reads `this.state.atlas?.highlights` — treat a missing field the same as an empty array.

- [ ] **Step 1: Write the failing tests**

Append to `tests/atlas-reduce.test.js`:

```js
// --- highlights (redaktionelle Teaser-Saetze) --------------------------------

test("uebernimmt highlights aus der Override-Datei", () => {
  const atlas = reduceGraph(fanIn("ui", 1), {
    ...OPTS,
    overrides: { highlights: ["Erster Punkt.", "Zweiter Punkt."] }
  });
  assert.deepEqual(atlas.highlights, ["Erster Punkt.", "Zweiter Punkt."]);
});

test("ohne highlights-Feld fehlt highlights im Ergebnis ganz", () => {
  const atlas = reduceGraph(fanIn("ui", 1), OPTS);
  assert.equal("highlights" in atlas, false);
});

test("leeres highlights-Array fehlt im Ergebnis ganz", () => {
  const atlas = reduceGraph(fanIn("ui", 1), { ...OPTS, overrides: { highlights: [] } });
  assert.equal("highlights" in atlas, false);
});

test("nicht-String-Eintraege in highlights werden verworfen", () => {
  const atlas = reduceGraph(fanIn("ui", 1), {
    ...OPTS,
    overrides: { highlights: ["gueltig", 42, "", null, "auch gueltig"] }
  });
  assert.deepEqual(atlas.highlights, ["gueltig", "auch gueltig"]);
});
```

Append to `tests/gen-atlas.test.js` (in the "Override-Datei" section, after the existing `hide`/`labels` test):

```js
test("laedt highlights aus der Override-Datei", () => {
  const outDir = neuesVerzeichnis("out");
  const overridesDir = neuesVerzeichnis("overrides");
  writeFileSync(join(overridesDir, "sql-agent.json"), JSON.stringify({
    highlights: ["Guardrails pruefen jede generierte SQL vor der Ausfuehrung."]
  }));

  assert.equal(lauf(repoMitGraph(), "sql-agent", { outDir, overridesDir }).status, 0);
  const atlas = lies(outDir, "sql-agent.json");
  assert.deepEqual(atlas.highlights, ["Guardrails pruefen jede generierte SQL vor der Ausfuehrung."]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `atlas.highlights` is `undefined` where the new tests expect an array.

- [ ] **Step 3: Implement in `reduceGraph()`**

In `tools/atlas-reduce.mjs`, inside `reduceGraph()`, find:

```js
  const pin = new Set(overrides?.pin ?? []);
  const hide = new Set(overrides?.hide ?? []);
  const labels = overrides?.labels ?? {};
```

Replace with:

```js
  const pin = new Set(overrides?.pin ?? []);
  const hide = new Set(overrides?.hide ?? []);
  const labels = overrides?.labels ?? {};
  // Redaktionelle Teaser-Saetze, zusaetzlich zur automatischen Kuerzung
  // (Marcos Entscheidung, siehe Design-Spec): frei formuliert, keine
  // Laengengrenze. Nur nicht-leere Strings zaehlen.
  const highlights = Array.isArray(overrides?.highlights)
    ? overrides.highlights.filter((h) => typeof h === "string" && h.length > 0)
    : [];
```

Then find the function's `return` statement:

```js
  return { id, repo, generatedAt, source, layers, modules };
```

Replace with:

```js
  return { id, repo, generatedAt, source, layers, modules, ...(highlights.length > 0 ? { highlights } : {}) };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — full suite green.

- [ ] **Step 5: Commit**

```bash
git add tools/atlas-reduce.mjs tests/atlas-reduce.test.js tests/gen-atlas.test.js
git commit -m "feat: optionale redaktionelle highlights aus der Atlas-Override-Datei"
```

---

## Task 3: `index.html` — Regler und Kamerafahrt raus, Toggle und Akkordeon rein

This is one task, not several: the file is only in a working state once every edit below is applied together (removing the camera code while the template still references it, or vice versa, breaks the page). Do all steps in order, then verify once at the end.

**Files:**
- Delete: `assets/js/atlas-layout.js`
- Delete: `tests/atlas-layout.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `atlas-data.js`'s existing exports (`loadAtlasIndex`, `loadAtlas`, `hasAtlas`) — unchanged, still imported the same way.
- Produces: nothing consumed elsewhere — this is leaf UI code.

### Part A — delete the ring-geometry module and its test

- [ ] **Step 1: Delete the files**

```bash
git rm assets/js/atlas-layout.js tests/atlas-layout.test.js
```

### Part B — `index.html`: state, lifecycle, camera methods

- [ ] **Step 2: Replace the `state` initializer**

Find (inside `class Component extends DCLogic { state = { ... } }`):

```js
    tipIndex: 0, visitors: null, chatStalled: false,
    // Code Atlas: Stufe 1 = heutige Ansicht, 2 = Layer-Ringe, 3 = Modulknoten.
    atlasLevel: 1, atlasIndex: null, atlas: null, atlasError: false, atlasHover: null
  };
```

Replace with:

```js
    tipIndex: 0, visitors: null, chatStalled: false,
    // Code Atlas: atlasOpen zeigt/versteckt die gesamte Sektion, atlasExpanded
    // haelt pro Layer-id, ob er aufgeklappt ist (mehrere gleichzeitig moeglich).
    atlasOpen: false, atlasExpanded: {}, atlasIndex: null, atlas: null, atlasError: false
  };
```

- [ ] **Step 3: Simplify the `componentDidMount` atlas import chain**

Find:

```js
    // Nur der Index (wenige hundert Byte) kommt beim Start mit; er entscheidet
    // lediglich, ob der Regler ueberhaupt erscheint. Die Atlas-Dateien selbst
    // werden erst beim Wechsel auf Stufe 2 geholt. atlas-layout.js kommt in
    // derselben Kette und wird VOR atlasIndex gesetzt, damit garantiert ist:
    // sobald atlasIndex im State steht, existiert auch this._atlasLayout.
    import(modUrl("atlas-data.js")).then((m) => {
      this._atlas = m;
      return import(modUrl("atlas-layout.js"));
    }).then((layout) => {
      this._atlasLayout = layout;
      return this._atlas.loadAtlasIndex(new URL("./", document.baseURI).href);
    }).then((index) => this.setState({ atlasIndex: index })).catch(() => {});
```

Replace with:

```js
    // Nur der Index (wenige hundert Byte) kommt beim Start mit; er entscheidet
    // lediglich, ob der Toggle ueberhaupt erscheint. Die Atlas-Datei eines
    // Projekts selbst wird erst beim ersten Klick auf den Toggle geholt.
    import(modUrl("atlas-data.js")).then((m) => {
      this._atlas = m;
      return m.loadAtlasIndex(new URL("./", document.baseURI).href);
    }).then((index) => this.setState({ atlasIndex: index })).catch(() => {});
```

- [ ] **Step 4: Simplify `measure()`**

Find:

```js
  measure = () => {
    const el = this._scene; if (!el) return;
    const r = el.getBoundingClientRect();
    // atlasHover mit zuruecksetzen (Fix-Runde 5, Critical): eine tatsaechliche
    // Groessenaenderung aendert Panelbreite, Kamera-Rahmung und Ring-Radius
    // (siehe freeArea()) -- ein gehoverter Modulknoten kann dabei verschwinden
    // (z.B. faellt w unter ATLAS_MIN_VIEWPORT, wo _atlasHost null wird) oder an
    // eine andere Stelle wandern, ohne dass ein mouseleave feuert. Bewusst
    // NUR im if-Zweig, nicht bei jedem Aufruf: measure() laeuft auch
    // periodisch ohne tatsaechliche Groessenaenderung.
    if (Math.abs(r.width - this.state.w) > 2 || Math.abs(r.height - this.state.h) > 2) {
      this.setState({ w: r.width, h: r.height, atlasHover: null });
    }
  };
```

Replace with:

```js
  measure = () => {
    const el = this._scene; if (!el) return;
    const r = el.getBoundingClientRect();
    if (Math.abs(r.width - this.state.w) > 2 || Math.abs(r.height - this.state.h) > 2) {
      this.setState({ w: r.width, h: r.height });
    }
  };
```

- [ ] **Step 5: Drop the `[data-atlas-node]` exception from the scene click handler**

Find (inside `setScene`):

```js
    // Klick ins Leere schliesst das Fenster -- dasselbe Verhalten wie in
    // scene.js der Legacy-Seite. Knoten und Links sind <button>/<a> im
    // Inneren, die duerfen nicht mitschliessen, sonst waere jeder Klick auf
    // einen Planeten sofort wieder ein Schliessen.
    // Abschlusspruefung 1a: die Atlas-Modulknoten sind <g><circle>, also
    // WEDER button noch a -- ein Klick auf einen Modulpunkt hat bislang das
    // ganze Projektfenster geschlossen und damit Regler und Atlas mitgerissen.
    // "Kein Klickziel" heisst hier ausdruecklich NICHT "Hintergrund".
    // Ringe und Kanten sind ueber pointer-events:none entschaerft (siehe
    // oben im Template), die Modulknoten koennen das nicht, weil sie ihren
    // Hover brauchen -- daher die Ausnahme hier.
    el.addEventListener("click", (e) => {
      if (e.target.closest("button, a, [data-atlas-node]")) return;
      if (!this.state.active) return;
      this.stopTour();
      this.close();
    });
```

Replace with:

```js
    // Klick ins Leere schliesst das Fenster -- dasselbe Verhalten wie in
    // scene.js der Legacy-Seite. Knoten und Links sind <button>/<a> im
    // Inneren, die duerfen nicht mitschliessen, sonst waere jeder Klick auf
    // einen Planeten sofort wieder ein Schliessen. Der Code Atlas lebt seit
    // dem Redesign vollstaendig im Projektfenster als <button>-Akkordeon,
    // braucht also keine eigene Ausnahme mehr.
    el.addEventListener("click", (e) => {
      if (e.target.closest("button, a")) return;
      if (!this.state.active) return;
      this.stopTour();
      this.close();
    });
```

- [ ] **Step 6: Simplify `applyZoom()`**

Find:

```js
  applyZoom() {
    if (this._stage) this._stage.style.transform = this.stageTransform();
    this._sky && null;
    // Fix-Runde 5 (Critical): applyZoom schreibt bewusst direkt aufs DOM statt
    // ueber setState (Kommentar oben) -- der Hinweiskasten ist aber Kind der
    // Buehne und skaliert dadurch WAEHREND des Zoomens automatisch mit,
    // waehrend seine berechnete Gegenskalierung (atlasTipPos(), Runde 3/4)
    // eingefroren bleibt, bis der naechste reguläre Render sie neu berechnet
    // -- die Groessen-Garantie ist fuer die Dauer des Scrollens ausgehebelt.
    // Ehrliche Aufloesung: der Kasten verschwindet waehrend des Zoomens,
    // statt kurzzeitig falsch (zu gross/klein) dazustehen. Nur wenn
    // tatsaechlich etwas gehovert ist -- sonst wuerde jede einzelne
    // Mausrad-Raste einen State-Update ausloesen, genau das Ruckeln, das der
    // direkte DOM-Weg oben vermeiden soll.
    if (this.state.atlasHover) this.setState({ atlasHover: null });
  }
```

Replace with:

```js
  applyZoom() {
    if (this._stage) this._stage.style.transform = this.stageTransform();
    this._sky && null;
  }
```

- [ ] **Step 7: Remove `atlasMaxLevel()`/`atlasLevelEff()`**

Find:

```js
  // Einzige Quelle fuer die tatsaechlich darstellbare Atlas-Stufe. Der State
  // darf ueber dem Maximum stehen (Fenster wurde nach dem Ziehen verkleinert);
  // gerendert wird immer die geklemmte Stufe. Absichtlich ohne setState: wird
  // das Fenster wieder breit, kommt die gewaehlte Tiefe zurueck.
  atlasMaxLevel() { return this._atlasLayout ? this._atlasLayout.maxLevelFor(this.state.w) : 1; }
  atlasLevelEff() { return Math.min(this.state.atlasLevel, this.atlasMaxLevel()); }
  // Eine Quelle fuer Panelbreite (Fix-Runde 2): die Kamerarechnung braucht
  // die Zahl, das <aside>-Layout den clamp()-String. Beides aus denselben
  // drei Werten, damit sie nie auseinanderlaufen koennen. isChat ist bei
  // Atlas-Aufrufen immer false — der Atlas erscheint nur an einem
  // Projekt-Host (this.state.active === echte Projekt-id), nie am Chat.
  panelWidth(isChat) {
```

Replace with:

```js
  // Eine Quelle fuer Panelbreite: die <aside>-Breite haengt nur von isChat
  // und der Buehnenbreite ab. Der Code Atlas lebt seit dem Redesign als
  // normaler Fensterinhalt ohne eigene Kamerarechnung, braucht also keine
  // Sonderbehandlung mehr hier.
  panelWidth(isChat) {
```

- [ ] **Step 8: Remove `freeArea()` and simplify `stageScale()`**

Find:

```js
  // Freie Flaeche links vom Projektfenster (Fix-Runde 5, Important): dieselbe
  // Groesse wurde bislang an drei Stellen einzeln ausgerechnet
  // (stageTransform() fuer die Kamera-Rahmung, layout() fuer die Ring-
  // Obergrenze, atlasTipPos() fuer die Kasten-Klemmung) -- bislang immer
  // konsistent, aber index.html hat keine Testabdeckung, ein Auseinander-
  // laufen der drei Kopien wuerde niemand bemerken, bis die Rahmung sichtbar
  // kaputt ist. Aus demselben Grund, aus dem panelWidth() und stageScale()
  // schon eigene Methoden sind: eine Quelle statt dreier Kopien.
  freeArea() {
    const freeWidth = this.state.w - this.panelWidth(false).px;
    return { freeWidth, freeCenterX: freeWidth / 2, freeCenterY: this.state.h / 2 };
  }
  // Buehnenskalierung: Basis (Fokus-Boost + Mausrad-Zoom) und zusaetzlicher
  // Atlas-Faktor. layout() (Ring-Obergrenze) und stageTransform() (Kamera)
  // muessen exakt denselben Wert sehen, sonst laufen Ring-Clamping und
  // Kamerarahmung auseinander — deshalb eine Methode statt zweimal derselben
  // Formel (Fix-Runde 2).
  stageScale() {
    const D = this.state.D, act = this.state.active;
    const focused = !!act && act !== D?.TERM_ID;
    const baseScale = focused ? this._zoom * 1.25 : this._zoom;
    const atlasBoost = this.atlasLevelEff() > 1 && this._atlasHost ? 1.35 : 1;
    return { baseScale, atlasBoost, scale: baseScale * atlasBoost };
  }
```

Replace with:

```js
  // Buehnenskalierung: Fokus-Boost (Projektfenster offen) mal Mausrad-Zoom.
  // Der fruehere Atlas-Boost-Faktor ist mit der Kamerafahrt des alten Reglers
  // entfallen -- der Code Atlas lebt jetzt im Fenster, nicht mehr auf der
  // Buehne.
  stageScale() {
    const D = this.state.D, act = this.state.active;
    const focused = !!act && act !== D?.TERM_ID;
    return { scale: focused ? this._zoom * 1.25 : this._zoom };
  }
```

- [ ] **Step 9: Simplify `stageTransform()` and delete `atlasTipPos()`**

Find (this spans from `stageTransform()` through the end of `atlasTipPos()`, right up to `zoomIn`):

```js
  stageTransform() {
    const D = this.state.D, act = this.state.active;
    const shift = act && act !== D?.TERM_ID ? -Math.min(230, this.state.w * 0.16) : 0;
    // Kamerafahrt, Fix-Runde 1 (Task-8-Review): transform-origin bleibt fest
    // in der Buehnenmitte (CSS-Default "50% 50%", siehe sceneTransform) statt
    // auf dem Planeten zu liegen. Origin UND Scale gleichzeitig zu animieren
    // liess den Planeten selbst mitwandern (gemessen: 97.7px Schwenk waehrend
    // der 0.42s), weil ein wandernder Ursprung jeden Bildpunkt um sich herum
    // mitzieht -- auch den, der eigentlich stehen bleiben soll. Stattdessen
    // haelt ein berechnetes Translate T den Planeten dort, wo er hin soll.
    //
    // Fix-Runde 2 (Playwright-Messung, Marcos Entscheidung): "Host bleibt
    // exakt stehen" (Runde 1) verdeckte den Atlas hinter dem Projektfenster —
    // 21 von 24 Modulknoten lagen unterm <aside>, weil sql-agent rechts liegt
    // und der 1.35x-Atlas-Zoom genau dorthin waechst. Der Planet wandert jetzt
    // bewusst EINMALIG in die Mitte der freien Flaeche links vom Fenster —
    // das IST die Kamerafahrt. Mechanismus unveraendert (fester Ursprung c,
    // berechnetes Translate T), nur das Ziel aendert sich. Mit demselben
    // Modell wie Runde 1 (p_screen = c + T + S*(p - c), c = Buehnenmitte
    // (w/2, h/2)) gesucht: T, sodass p_screen(host) in der Mitte der freien
    // Flaeche landet:
    //   freeWidth   = w - panelPx      (panelPx exakt wie <aside>, siehe panelWidth())
    //   freeCenterX = freeWidth / 2
    //   freeCenterY = h / 2            (senkrecht bleibt es die Buehnenmitte)
    //   Tx = freeCenterX - c.x - S * (host.x - c.x)
    //   Ty = freeCenterY - c.y - S * (host.y - c.y)
    // Ersetzt shift UND das E aus Runde 1 vollstaendig (nicht addiert) — shift
    // war ohnehin nur eine grobe Naeherung fuer "Platz fuers Fenster lassen",
    // die hier direkt und exakt in Tx steckt. Ohne Atlas-Host (atlasBoost===1)
    // bleibt alles exakt wie vor Runde 1: translate(shift, 0).
    //
    // Fix-Runde 3: der eigene Schmalviewport-Sonderfall aus Runde 2 (Host
    // unterhalb ATLAS_MIN_VIEWPORT ortsfest halten statt zu rahmen) ist raus.
    // Seit maxLevelFor() unter ATLAS_MIN_VIEWPORT nur noch Stufe 1 erlaubt (siehe
    // atlas-layout.js) und der Regler dort per atlasAvailable gar nicht mehr
    // erscheint, kann atlasBoost dort nie mehr != 1 werden — der Zweig war
    // unerreichbar toter Code mit einer Begruendung, die nicht mehr gilt.
    const { atlasBoost, scale } = this.stageScale();
    let tx = shift, ty = 0;
    if (atlasBoost !== 1) {
      const cx = this.state.w / 2, cy = this.state.h / 2;
      const { freeCenterX, freeCenterY } = this.freeArea();
      tx = freeCenterX - cx - scale * (this._atlasHost.x - cx);
      ty = freeCenterY - cy - scale * (this._atlasHost.y - cy);
    }
    return `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(3)})`;
  }
  // Position + Gegenskalierung fuer den Hinweiskasten im Atlas-Modus
  // (Fix-Runde 3). Der Kasten liegt weiterhin im selben Element wie beim
  // normalen Planeten-Hover, innerhalb der skalierten Buehne -- soll aber in
  // natuerlicher Bildschirmgroesse erscheinen (bei Skalierung 1.69 waere er
  // sonst ueberdimensioniert und liefe unters Panel). Da left/top dieses Divs
  // durch denselben Kamera-Transform laufen wie alles andere in der Buehne,
  // wird der gewuenschte BILDSCHIRM-Ankerpunkt zuerst gegen die freie Flaeche
  // geklemmt (dieselbe Quelle wie stageTransform()/layout(), panelWidth(),
  // nicht neu berechnet) und dann durch Umkehrung des Kamera-Transforms
  // zurueck in Buehneneinheiten uebersetzt. Weil stageTransform() den Host
  // exakt auf freeCenterX/Y abbildet (siehe dort), kuerzen sich Ursprung c
  // und Translate T in der Differenz zum Host heraus -- es bleibt eine simple
  // Skalierung um den Host als Bezugspunkt.
  atlasTipPos(hoverX, hoverY) {
    const host = this._atlasHost;
    const { scale } = this.stageScale();
    const { freeWidth, freeCenterX, freeCenterY } = this.freeArea();
    const rawX = freeCenterX + scale * (hoverX - host.x);
    // +58 in Bildschirm-px (nicht Buehneneinheiten!), damit die Luecke
    // zwischen Modulpunkt und Kasten unabhaengig vom Zoom/Atlas-Boost gleich
    // gross bleibt -- derselbe Abstand wie beim Planeten-Hover (tipTop unten),
    // nur bewusst VOR statt nach der Skalierung angewendet.
    const rawY = freeCenterY + scale * (hoverY - host.y) + 58;
    // Boxmasse in natuerlichen Bildschirm-px, gemessen (nicht geschaetzt):
    // 250x193px bei der laengsten Modulbeschreibung im Datensatz (Kicker
    // 10px + Fliesstext 12.5px). Eine fruehere Schaetzung von HALF_H=61 war
    // deutlich zu klein -- der Kasten waere unten aus dem Bild gelaufen.
    const BOX_W = 250, BOX_H = 193, MARGIN = 16;
    // Horizontal symmetrisch: translate(-50%,0) zentriert die Box auf den
    // Ankerpunkt, also darf sie in beide Richtungen gleich weit ausladen.
    const halfW = BOX_W / 2 + MARGIN;
    const clampedX = Math.max(halfW, Math.min(freeWidth - halfW, rawX));
    // Vertikal NICHT symmetrisch: transform-origin ist "50% 0%" (oben), die
    // Box klappt vom Ankerpunkt aus nach UNTEN auf. Sie darf also fast bis an
    // den oberen Rand heranreichen (nur MARGIN), muss aber ihre volle Hoehe
    // BOX_H nach unten frei haben.
    const clampedY = Math.max(MARGIN, Math.min(this.state.h - BOX_H - MARGIN, rawY));
    return {
      left: host.x + (clampedX - freeCenterX) / scale,
      top: host.y + (clampedY - freeCenterY) / scale,
      counterScale: 1 / scale
    };
  }
```

Replace with:

```js
  stageTransform() {
    const D = this.state.D, act = this.state.active;
    const shift = act && act !== D?.TERM_ID ? -Math.min(230, this.state.w * 0.16) : 0;
    const { scale } = this.stageScale();
    return `translate(${shift.toFixed(2)}px, 0px) scale(${scale.toFixed(3)})`;
  }
```

- [ ] **Step 10: Replace `setAtlasLevel` with `toggleAtlas`/`toggleAtlasLayer`**

Find:

```js
  setAtlasLevel = (level) => {
    const id = this.state.active;
    // Fix-Runde 5 (Critical): JEDER Stufenwechsel setzt atlasHover zurueck,
    // nicht nur der Zweig auf Stufe 1. Grund: die Modulknoten aus der
    // vorigen Stufe verschwinden ohne mouseleave aus dem DOM (kein Event
    // fuer entfernte Elemente), sobald eine andere Stufe gerendert wird --
    // atlasHover haengt dann an einem Modul, das gar nicht mehr existiert,
    // und blieb bislang bis zur naechsten Maus-Bewegung so stehen (sichtbar:
    // der Kasten beschreibt ein nicht mehr gezeichnetes Modul; im schlimmsten
    // Fall reisst ein spaeter folgender Resize unter ATLAS_MIN_VIEWPORT dann die
    // Seite weg, siehe atlasTipPos()).
    if (level <= 1) { this.setState({ atlasLevel: 1, atlasError: false, atlasHover: null }); return; }
    if (!id || !this._atlas) return;
    // Sofort schalten: der Regler darf nicht auf das Netz warten. Die Szene
    // rendert Stufe 2 leer, bis die Daten da sind — das ist ein Sekundenbruchteil
    // aus dem Cache und faellt bei Fehlschlag auf Stufe 1 zurueck.
    this.setState({ atlasLevel: level, atlasError: false, atlasHover: null });
    this._atlas.loadAtlas(id, new URL("./", document.baseURI).href).then((atlas) => {
      if (this.state.active !== id) return;   // inzwischen anderes Projekt offen
      if (!atlas) { this.setState({ atlasLevel: 1, atlas: null, atlasError: true }); return; }
      this.setState({ atlas });
    });
  };
```

Replace with:

```js
  // Oeffnet/schliesst die gesamte Atlas-Sektion. Erst beim ersten Oeffnen wird
  // die Atlas-Datei des aktiven Projekts geholt (Lazy Load) und danach
  // gecacht (siehe atlas-data.js) -- ein erneutes Oeffnen loest keinen
  // zweiten fetch aus.
  toggleAtlas = () => {
    const id = this.state.active;
    if (this.state.atlasOpen) { this.setState({ atlasOpen: false }); return; }
    if (!id || !this._atlas) return;
    this.setState({ atlasOpen: true, atlasError: false });
    if (this.state.atlas) return;
    this._atlas.loadAtlas(id, new URL("./", document.baseURI).href).then((atlas) => {
      if (this.state.active !== id) return;   // inzwischen anderes Projekt offen
      if (!atlas) { this.setState({ atlasError: true }); return; }
      this.setState({ atlas });
    });
  };
  // Klappt einen einzelnen Layer auf/zu. Mehrere Layer duerfen gleichzeitig
  // offen sein -- kein Akkordeon-Zwang auf "nur einer".
  toggleAtlasLayer = (layerId) => {
    this.setState((s) => ({ atlasExpanded: { ...s.atlasExpanded, [layerId]: !s.atlasExpanded[layerId] } }));
  };
```

- [ ] **Step 11: Update `open()` and `close()`**

Find:

```js
  open = (id) => {
    this.setState({ active: id, tech: false, hist: false, atlasLevel: 1, atlas: null, atlasError: false, atlasHover: null });
```

Replace with:

```js
  open = (id) => {
    this.setState({ active: id, tech: false, hist: false, atlasOpen: false, atlasExpanded: {}, atlas: null, atlasError: false });
```

Find:

```js
  close = () => { this.setState({ active: null, atlasLevel: 1, atlas: null, atlasError: false, atlasHover: null }); this.syncHash(null); };
```

Replace with:

```js
  close = () => { this.setState({ active: null, atlasOpen: false, atlasExpanded: {}, atlas: null, atlasError: false }); this.syncHash(null); };
```

### Part C — `index.html`: `layout(D)`

- [ ] **Step 12: Revert ring opacity and edge dimming to their pre-atlas values, and drop the Code Atlas block**

Find (inside `layout(D)`, the ring push for the "orbit" variant):

```js
        rings.push({ cx: ox, cy: oy, rx, ry, color: D.CLUSTERS[c].color,
          opacity: this.atlasLevelEff() > 1 ? 0.04 : this.state.active ? 0.09 : 0.22 });
```

Replace with:

```js
        rings.push({ cx: ox, cy: oy, rx, ry, color: D.CLUSTERS[c].color,
          opacity: this.state.active ? 0.09 : 0.22 });
```

Find (the edges loop just below):

```js
      const dim = focusId && focusId !== (n.p ? n.p.id : "center");
      const atlasDim = this.atlasLevelEff() > 1;
      edges.push({ d, color: hexA(color, atlasDim ? 0.03 : dim ? 0.07 : 0.2), flowColor: color,
        flowOpacity: atlasDim || dim ? 0 : 0.85, delay: `${(i * 0.62).toFixed(2)}s` });
    });
```

Replace with:

```js
      const dim = focusId && focusId !== (n.p ? n.p.id : "center");
      edges.push({ d, color: hexA(color, dim ? 0.07 : 0.2), flowColor: color,
        flowOpacity: dim ? 0 : 0.85, delay: `${(i * 0.62).toFixed(2)}s` });
    });
```

Find the entire Code Atlas block plus the `layout(D)` return statement:

```js
    // --- Code Atlas -------------------------------------------------------
    // Die Layer-/Modulringe liegen um den AKTIVEN Planeten, nicht um die Sonne.
    // Die Hauptszene bleibt gerendert und dimmt lediglich staerker ab — der
    // Besucher soll sehen, wo im System er sich befindet.
    // _atlasHost merkt sich den Planeten fuer stageTransform(): dort wird die
    // Kamera so gerahmt, dass genau dieser Punkt sichtbar bleibt (siehe
    // Herleitung an stageTransform(), Fix-Runde 2).
    let atlasRings = [], atlasNodes = [], atlasEdges = [];
    this._atlasHost = null;
    if (this.atlasLevelEff() > 1 && this.state.atlas && this._atlasLayout) {
      const host = nodes.find((n) => n.p && n.p.id === this.state.active);
      if (host) {
        this._atlasHost = host;
        // Ring-Obergrenze, Fix-Runde 2 (Playwright-Messung): ohne sie wuchs
        // der aeusserste Ring bei 1280px auf ~425px Bildschirmradius, waehrend
        // links vom Fenster nur ~360px frei sind — 21 von 24 Modulknoten lagen
        // unterm <aside>. maxRadius ist in Buehneneinheiten, deshalb durch
        // dieselbe Skalierung geteilt, die stageTransform() fuers Framing
        // benutzt (this.stageScale()), sonst koennten Ring-Clamp und Kamera
        // auseinanderlaufen.
        // Fix-Runde 3: der Schmalviewport-Sonderfall (kein maxRadius unterhalb
        // ATLAS_MIN_VIEWPORT) ist raus — seit maxLevelFor() dort nur noch Stufe 1
        // erlaubt, wird dieser Zweig nie mehr mit einem Atlas-Host erreicht.
        // Fix-Runde 5: freeArea() statt eigener Inline-Formel, dieselbe Quelle
        // wie stageTransform() und atlasTipPos() (siehe dort).
        const { freeWidth } = this.freeArea();
        const maxRadius = (freeWidth / 2 - 24) / this.stageScale().scale;
        const out = this._atlasLayout.computeAtlasLayout(this.state.atlas, {
          level: this.atlasLevelEff(), cx: host.x, cy: host.y, w, h, maxRadius
        });
        atlasRings = out.rings; atlasNodes = out.nodes; atlasEdges = out.edges;
      }
    }
    return { nodes, edges, rings, focusId, atlasRings, atlasNodes, atlasEdges };
  }
```

Replace with:

```js
    return { nodes, edges, rings, focusId };
  }
```

### Part D — `index.html`: `renderVals()`

- [ ] **Step 13: Update the `layout(D)` destructure**

Find:

```js
    const { nodes, edges, rings, focusId, atlasRings, atlasNodes, atlasEdges } = this.layout(D);
```

Replace with:

```js
    const { nodes, edges, rings, focusId } = this.layout(D);
```

- [ ] **Step 14: Remove the atlas ring/node view-model computation**

Find (everything between the `reduceMotion` line and the `activeP` line):

```js
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const atlasNodeVals = (atlasNodes ?? []).map((n) => ({
      x: n.x, y: n.y, label: n.label,
      radius: n.more ? 5 : 4.5,
      fill: n.more ? "transparent" : "#b48cf5",
      dash: n.more ? "2 3" : "none",
      labelY: n.y + 15,
      // Der Sammelknoten "+N weitere" ist bewusst gar nicht interaktiv: er
      // steht fuer weggekappte Module, zu denen es nichts anzuzeigen gibt.
      // Den Cursor setzt das Template fest auf default (siehe dort) -- kein
      // Modulknoten hat eine Klickaktion, auch die echten nicht.
      // atlasHover ist ein Objekt (nicht nur der Text), weil der Hinweiskasten
      // Position UND Layer-Zugehoerigkeit braucht — hoverNode existiert im
      // Atlas-Modus nicht (das ist ein Planetenknoten), also muss der Modul-
      // knoten seine eigenen Koordinaten mitliefern.
      onEnter: n.more ? () => {} : () => this.setState({
        atlasHover: { text: n.summary || n.label, x: n.x, y: n.y, layerId: n.layerId }
      }),
      onLeave: n.more ? () => {} : () => this.setState({ atlasHover: null })
    }));
    // Beschriftung der Layer-Ringe (Abschlusspruefung 1b). Kein neuer
    // Datenweg: label und count kommen unveraendert aus atlasRings, die Zahl
    // der tatsaechlich gezeichneten Module wird aus atlasNodes gezaehlt.
    const atlasShownPerLayer = new Map();
    for (const n of atlasNodes ?? []) {
      // Der Sammelknoten "+N weitere" ist selbst kein gezeigtes Modul --
      // ihn mitzuzaehlen wuerde die Kappung genau um eins schoenrechnen.
      if (n.more) continue;
      atlasShownPerLayer.set(n.layerId, (atlasShownPerLayer.get(n.layerId) ?? 0) + 1);
    }
    const atlasRingLabels = (atlasRings ?? []).map((r) => {
      const count = Number(r.count) || 0;
      const shown = atlasShownPerLayer.get(r.layerId) ?? 0;
      // Singular/Plural im Deutschen: "1 Modul", sonst "N Module".
      const menge = count === 1 ? "1 Modul" : `${count} Module`;
      // Kappung ehrlich benennen -- aber nur, wenn ueberhaupt Modulpunkte
      // gezeichnet sind. Auf Stufe 2 gibt es per Definition keine (das ist
      // die Stufe der reinen Layer-Ringe); dort waere "7 Module, 0 gezeigt"
      // kein ehrlicher Hinweis, sondern eine Falschaussage ueber die Stufe.
      return {
        // Scheitelpunkt des eigenen Rings (siehe Begruendung im Template).
        x: Math.round(r.cx),
        y: Math.round(r.cy - r.ry),
        label: r.label,
        meta: shown > 0 && count > shown ? `${menge}, ${shown} gezeigt` : menge
      };
    });
    const activeP = D.PROJECTS.find((p) => p.id === active) || (active === D.CHAT_ID ? D.PROJECTS.find((p) => p.moon) : null);
```

Replace with:

```js
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const activeP = D.PROJECTS.find((p) => p.id === active) || (active === D.CHAT_ID ? D.PROJECTS.find((p) => p.moon) : null);
```

- [ ] **Step 15: Remove the atlas hover/tip computation**

Find:

```js
    const hoverNode = nodes.find((n) => (n.p ? n.p.id : "center") === hover);
    const hoverP = hoverNode && hoverNode.p;
    // Layer-Label fuer den Hinweiskasten im Atlas-Modus: atlasRings traegt
    // layerId + label unveraendert aus atlas-layout.js durch.
    const atlasHoverLayer = this.state.atlasHover
      ? (atlasRings ?? []).find((r) => r.layerId === this.state.atlasHover.layerId)
      : null;
    // Bildschirmgerechte Position + Gegenskalierung, Fix-Runde 3 (siehe
    // atlasTipPos()). null ausserhalb des Atlas-Hovers -- dort bleibt tipLeft/
    // tipTop/tipScale exakt das bisherige, unveraenderte Verhalten.
    // Fix-Runde 5 (Critical): zusaetzlich this._atlasHost pruefen, nicht nur
    // atlasHover. atlasHover haengt an einem DOM-Element (dem Modulpunkt),
    // das ohne mouseleave verschwinden kann (Stufenwechsel, Resize,
    // Mausrad-Zoom entfernen/verschieben die Modulknoten, siehe die drei
    // Reset-Stellen unten) -- atlasHover kann dadurch kurzzeitig verwaisen,
    // bevor der Reset greift. atlasTipPos() liest this._atlasHost.x ohne
    // eigene Pruefung; ohne diesen Wächter reisst ein null-Host die gesamte
    // Seite weg (Root.renderVals(): Cannot read properties of null). Guertel
    // UND Hosentraeger: die drei Reset-Pfade sollten das verhindern, aber der
    // Schadensfall (Totalausfall) rechtfertigt die zusaetzliche Pruefung hier.
    const atlasTip = (this.state.atlasHover && this._atlasHost)
      ? this.atlasTipPos(this.state.atlasHover.x, this.state.atlasHover.y) : null;
    const demoUrl = isChat ? null : activeP ? activeP.demoUrl : null;
```

Replace with:

```js
    const hoverNode = nodes.find((n) => (n.p ? n.p.id : "center") === hover);
    const hoverP = hoverNode && hoverNode.p;
    const demoUrl = isChat ? null : activeP ? activeP.demoUrl : null;
```

- [ ] **Step 16: Revert the `tip*` return fields to planet-hover-only**

Find:

```js
      // Im Atlas-Modus ist immer ein Projekt offen (active), das den Kasten
      // sonst unterdrueckt (die Regel gilt fuer den Planeten-Hover: bei
      // offenem Fenster sieht man dessen Inhalt bereits). Ein gesetzter
      // atlasHover zeigt den Kasten deshalb unabhaengig von active.
      tip: (!!hoverP && !active) || !!this.state.atlasHover,
      tipLeft: atlasTip
        ? Math.round(atlasTip.left)
        : hoverNode ? Math.round(Math.max(140, Math.min(w - 140, hoverNode.x))) : 0,
      tipTop: atlasTip
        ? Math.round(atlasTip.top)
        : hoverNode ? Math.round(hoverNode.y + 58) : 0,
      // Gegenskalierung, Fix-Runde 3: 1 ausserhalb des Atlas-Hovers, macht
      // scale({{ tipScale }}) im Template zu einem Neutralelement -- das
      // bestehende Planeten-Hover-Verhalten bleibt dadurch unangetastet.
      tipScale: atlasTip ? atlasTip.counterScale : 1,
      tipText: this.state.atlasHover ? this.state.atlasHover.text : (hoverP ? hoverP.summary : ""),
      tipCluster: this.state.atlasHover ? (atlasHoverLayer ? atlasHoverLayer.label : "") : (hoverP ? D.CLUSTERS[hoverP.cluster].label : ""),
      tipAccent: this.state.atlasHover ? "#b48cf5" : (hoverP ? D.CLUSTERS[hoverP.cluster].color : "#b48cf5"),
```

Replace with:

```js
      tip: !!hoverP && !active,
      tipLeft: hoverNode ? Math.round(Math.max(140, Math.min(w - 140, hoverNode.x))) : 0,
      tipTop: hoverNode ? Math.round(hoverNode.y + 58) : 0,
      tipScale: 1,
      tipText: hoverP ? hoverP.summary : "",
      tipCluster: hoverP ? D.CLUSTERS[hoverP.cluster].label : "",
      tipAccent: hoverP ? D.CLUSTERS[hoverP.cluster].color : "#b48cf5",
```

- [ ] **Step 17: Drop the atlas fields from the `nodes`/`edges`/`rings` return line**

Find:

```js
      ...base, nodes: nodeVals, edges, rings,
      atlasRings: atlasRings ?? [], atlasEdges: atlasEdges ?? [], atlasNodes: atlasNodeVals,
      atlasRingLabels,
      leaders: this.state.leaders || [],
```

Replace with:

```js
      ...base, nodes: nodeVals, edges, rings,
      leaders: this.state.leaders || [],
```

- [ ] **Step 18: Replace the regler render values with the toggle/accordion ones**

Find:

```js
      // Fix-Runde 3: unter ATLAS_MIN_VIEWPORT liefert atlasMaxLevel() nur noch 1
      // (siehe atlas-layout.js) -- ein Regler, der nachweislich nichts
      // bewirkt (keine Stufe ausser der aktuellen erreichbar), waere unehrlich.
      // Deshalb erscheint er dort gar nicht erst, statt als wirkungsloser
      // Ein-Stufen-Regler.
      atlasAvailable: Boolean(
        this.atlasMaxLevel() > 1 && this.state.atlasIndex && activeP && this._atlas?.hasAtlas(this.state.atlasIndex, activeP.id)
      ),
      atlasLevel: this.atlasLevelEff(),
      atlasMaxLevel: this.atlasMaxLevel(),
      atlasLevelLabel: ["", "Projekt", "Struktur", "Code"][this.atlasLevelEff()] || "Projekt",
      // Abschlusspruefung 2b: die Attribution steht jetzt IMMER, wenn der
      // Regler sichtbar ist. Der Fehlerfall bekommt eine eigene Zeile
      // darueber (siehe Template) statt die Attribution zu verdraengen.
      atlasError: this.state.atlasError,
      atlasHint: "Graph-Extraktion: Understand-Anything (MIT) · Reduktion und Darstellung: eigene Pipeline",
      setAtlasLevelFromInput: (e) => this.setAtlasLevel(Number(e.target.value)),
```

Replace with:

```js
      // Der Toggle erscheint nur, wenn das aktive Projekt laut index.json
      // ueberhaupt einen Atlas hat -- kein Viewport-Gate mehr noetig, die
      // Akkordeon-Liste ist bei jeder Breite lesbar (anders als die
      // fruehere Ring-Geometrie).
      atlasAvailable: Boolean(this.state.atlasIndex && activeP && this._atlas?.hasAtlas(this.state.atlasIndex, activeP.id)),
      atlasOpen: this.state.atlasOpen,
      atlasLabel: this.state.atlasOpen ? "▾ Architektur verbergen" : "▸ Architektur anzeigen",
      atlasRows: this.state.atlasOpen ? "1fr" : "0fr",
      toggleAtlas: this.toggleAtlas,
      atlasHighlights: this.state.atlas?.highlights ?? [],
      atlasHasHighlights: (this.state.atlas?.highlights ?? []).length > 0,
      atlasLayers: (this.state.atlas?.layers ?? []).map((layer) => {
        const expanded = !!this.state.atlasExpanded[layer.id];
        const allModules = this.state.atlas.modules ?? [];
        const modules = allModules.filter((m) => m.layerId === layer.id);
        return {
          id: layer.id,
          label: `${expanded ? "▾" : "▸"} ${layer.label} (${layer.count})`,
          toggle: () => this.toggleAtlasLayer(layer.id),
          rows: expanded ? "1fr" : "0fr", opacity: expanded ? 1 : 0,
          modules: modules.map((m) => ({
            id: m.id, label: m.label, summary: m.summary,
            deps: (m.deps ?? []).length
              ? `nutzt: ${m.deps.map((depId) => allModules.find((x) => x.id === depId)?.label).filter(Boolean).join(", ")}`
              : ""
          }))
        };
      }),
      atlasError: this.state.atlasError,
      atlasHint: "Graph-Extraktion: Understand-Anything (MIT) · Reduktion und Darstellung: eigene Pipeline",
```

### Part E — `index.html`: template

- [ ] **Step 19: Remove the SVG atlas render blocks (rings, edges, module circles) and the ring/module label `<div>`s**

Find (this spans from right after the `leaders` `sc-for`'s closing tag through the blank line right before `<sc-for list="{{ nodes }}" as="n" ...>`):

```html
        <!-- pointer-events:none auf Ringen und Kanten (Abschlusspruefung 1a):
             beide sind reine Grafik ohne Hover und ohne Klickziel. Ohne die
             Regel trifft ein Klick genau auf die gestrichelte Linie (SVG
             zeichnet nur das Gemalte, aber der Strich IST gemalt) den
             Szenen-Klickhandler weiter unten -- und der schliesst alles, was
             kein <button>/<a> ist. Ergebnis waere: Klick auf einen Layer-Ring
             reisst das Projektfenster samt Atlas zu. -->
        <sc-for list="{{ atlasRings }}" as="ar" hint-placeholder-count="3">
          <ellipse cx="{{ ar.cx }}" cy="{{ ar.cy }}" rx="{{ ar.rx }}" ry="{{ ar.ry }}" fill="none"
                   stroke="#b48cf5" stroke-width="1" stroke-dasharray="3 6" opacity=".34"
                   pointer-events="none"></ellipse>
        </sc-for>
        <sc-for list="{{ atlasEdges }}" as="ae" hint-placeholder-count="4">
          <path d="{{ ae.d }}" fill="none" stroke="#b48cf5" stroke-width="1" opacity=".22"
                pointer-events="none"></path>
        </sc-for>
        <!-- Modulknoten brauchen ihre Zeigerereignisse (Hover zeigt die
             summary), duerfen den Klick aber NICHT ans Schliessen
             durchreichen -- deshalb das data-atlas-node, auf das der
             Szenen-Klickhandler prueft.
             cursor:default, NICHT pointer: ein Modulknoten hat keine
             Klickaktion, er zeigt seine Beschreibung beim Hovern. Der
             Zeigefinger versprach bisher eine Aktion und lieferte das
             Zerreissen der Ansicht. Wer ihn "aus Symmetrie zu den Planeten"
             zurueckstellt, baut genau dieses falsche Versprechen wieder ein.
             Der Sammelknoten "+N weitere" traegt aus demselben Grund schon
             immer default. -->
        <sc-for list="{{ atlasNodes }}" as="an" hint-placeholder-count="8">
          <g data-atlas-node="1" style="cursor:default"
             onMouseEnter="{{ an.onEnter }}" onMouseLeave="{{ an.onLeave }}">
            <circle cx="{{ an.x }}" cy="{{ an.y }}" r="{{ an.radius }}"
                    fill="{{ an.fill }}" stroke="#b48cf5" stroke-width="1"
                    stroke-dasharray="{{ an.dash }}"></circle>
          </g>
        </sc-for>
      </svg>

      <!-- Fix-Runde 3, fuenfte Runtime-Falle dieser dc-Runtime (siehe
           CLAUDE.md): jede {{ }}-Interpolation wird als <span class="sc-interp">
           gerendert. In HTML ist das unsichtbar, aber ein HTML-<span> als Kind
           eines SVG-<text> zeichnet UEBERHAUPT NICHTS -- SVG akzeptiert dort
           nur echte Zeichendaten oder tspan/textPath. Gemessen: alle 24
           <text>-Elemente standen mit korrektem Inhalt und sichtbaren Styles
           im DOM, getBBox() lieferte trotzdem 0x0. Deshalb hier KEIN
           SVG-<text>, sondern absolut positioniertes HTML im selben Layer wie
           die Planeten-Buttons unten -- genau das Muster, das dieses Repo fuer
           Beschriftungen schon durchgaengig benutzt (siehe n.title). Der Layer
           liegt innerhalb derselben skalierten Buehne wie die Modulpunkte,
           wandert also mit ihnen mit; 9px Schriftgroesse werden bei
           Atlas-Skalierung (~1.69x) zu ~15px auf dem Schirm, lesbar.
           pointer-events:none ist Pflicht: sonst faengt das Label-Div den
           Hover vom Modulpunkt darunter ab, bevor die Maus ihn erreicht. -->
      <!-- Beschriftung der Layer-Ringe (Abschlusspruefung 1b). Bis hierher
           war Stufe "Struktur" wortlos: sechs gestrichelte Ellipsen ohne
           einen einzigen Text, obwohl atlas-layout.js label UND count
           laengst durchreicht.
           Auch hier KEIN SVG-<text>, aus exakt demselben Grund wie bei den
           Modul-Labels darunter (Falle 5 in CLAUDE.md): eine
           {{ }}-Interpolation wird als HTML-<span class="sc-interp">
           gerendert, und ein HTML-<span> im SVG-<text> zeichnet nichts.
           pointer-events:none ist Pflicht, sonst faengt das Ring-Label den
           Hover der Modulknoten ab, die genau auf diesem Ring sitzen.

           Sitz: mittig AUF dem Scheitelpunkt des eigenen Rings. Damit ist die
           Zuordnung Label -> Ring eindeutig; ein Label neben der Linie waere
           bei sechs Ringen nicht mehr sicher dem richtigen zuzuordnen. Der
           text-shadow ist der Ersatz fuer einen Kasten: er stanzt die Schrift
           aus der gestrichelten Linie heraus, ohne den Ring zu verdecken.
           Horizontal auf der Ringmitte -- und genau die rahmt
           stageTransform() in die Mitte der freien Flaeche neben dem
           Projektfenster (freeArea()), das Label kann also nicht darunter
           laufen.

           Schriftgroesse 7.5px ist gerechnet, nicht geraten: die Ringe
           stehen im engsten erlaubten Fall (1000px Viewport, sechs Layer)
           10.3 Buehneneinheiten auseinander, bei Atlas-Skalierung 1.6875
           also 17px auf dem Schirm. 7.5px werden dort zu 12.7px -- die
           Beschriftungen benachbarter Ringe beruehren sich damit nicht. Bei
           1280px sind es 30px Abstand und die Schrift steht frei. Sie ist
           bewusst kleiner als die Modul-Labels (9px): das ist die
           Platzgrenze, nicht die Wichtigkeit. -->
      <sc-for list="{{ atlasRingLabels }}" as="al" hint-placeholder-count="3">
        <div style="position:absolute;left:{{ al.x }}px;top:{{ al.y }}px;transform:translate(-50%,-50%);pointer-events:none;white-space:nowrap;font:600 7.5px/1.1 'JetBrains Mono',monospace;text-align:center;text-shadow:0 0 4px #06050e,0 0 4px #06050e,0 0 8px #06050e"><span style="color:#c9b6f5">{{ al.label }}</span><span style="color:#8a86a8"> · {{ al.meta }}</span></div>
      </sc-for>

      <sc-for list="{{ atlasNodes }}" as="an" hint-placeholder-count="8">
        <div style="position:absolute;left:{{ an.x }}px;top:{{ an.labelY }}px;transform:translate(-50%,0);pointer-events:none;font:500 9px/1 'JetBrains Mono',monospace;color:#8a86a8;white-space:nowrap">{{ an.label }}</div>
      </sc-for>

```

Replace with:

```html
      </svg>

```

- [ ] **Step 20: Replace the regler block with the toggle + accordion**

Find:

```html
            <sc-if value="{{ atlasAvailable }}" hint-placeholder-val="{{ true }}">
              <div style="margin:0 0 22px;padding:14px 16px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(160,140,230,.16)">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
                  <span style="font:600 10px/1 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:#8a86a8">Tiefe</span>
                  <span style="font:500 11.5px/1 'Space Grotesk',sans-serif;color:{{ activeAccent }}">{{ atlasLevelLabel }}</span>
                </div>
                <!-- aria-valuetext (Abschlusspruefung 2g): ein
                     <input type=range> laesst der Screenreader sonst als
                     "1", "2", "3" vor -- Zahlen, die auf der Seite nirgends
                     stehen. Die Stufen heissen "Projekt", "Struktur" und
                     "Code", und genau das liest aria-valuetext vor. Es
                     traegt denselben Wert wie das sichtbare Label rechts
                     oben im Kasten, beide aus atlasLevelLabel. -->
                <input type="range" min="1" max="{{ atlasMaxLevel }}" step="1" value="{{ atlasLevel }}"
                       onInput="{{ setAtlasLevelFromInput }}"
                       aria-label="Detailtiefe der Architekturansicht: Projekt, Struktur, Code"
                       aria-valuetext="{{ atlasLevelLabel }}"
                       style="width:100%;accent-color:#b48cf5;cursor:pointer">
                <!-- Abschlusspruefung 2b: Fehlerzeile UND Attribution, nicht
                     entweder/oder. Die Attribution ist laut Spec verbindlich,
                     solange der Regler sichtbar ist -- sie darf nicht
                     ausgerechnet dann verschwinden, wenn eine zweite Zeile
                     erscheint. Vorher hat die Fehlermeldung sie ersetzt. -->
                <sc-if value="{{ atlasError }}" hint-placeholder-val="{{ false }}">
                  <div style="margin-top:8px;font:400 10px/1.4 'JetBrains Mono',monospace;color:#f2b45c">Architekturdaten gerade nicht verfügbar</div>
                </sc-if>
                <div style="margin-top:8px;font:400 10px/1.4 'JetBrains Mono',monospace;color:#6f6a92">{{ atlasHint }}</div>
              </div>
            </sc-if>
```

Replace with:

```html
            <sc-if value="{{ atlasAvailable }}" hint-placeholder-val="{{ true }}">
              <div style="margin:0 0 22px">
                <button type="button" onClick="{{ toggleAtlas }}" style="background:none;border:0;padding:0 0 10px;cursor:pointer;font:500 12px/1 'JetBrains Mono',monospace;color:{{ activeAccent }}">{{ atlasLabel }}</button>
                <div style="display:grid;grid-template-rows:{{ atlasRows }};transition:grid-template-rows .45s cubic-bezier(.22,1,.3,1)">
                  <div style="min-height:0;overflow:hidden">
                    <div style="padding:14px 16px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(160,140,230,.16)">
                      <sc-if value="{{ atlasError }}" hint-placeholder-val="{{ false }}">
                        <div style="margin-bottom:10px;font:400 10px/1.4 'JetBrains Mono',monospace;color:#f2b45c">Architekturdaten gerade nicht verfügbar</div>
                      </sc-if>
                      <sc-if value="{{ atlasHasHighlights }}" hint-placeholder-val="{{ false }}">
                        <sc-for list="{{ atlasHighlights }}" as="hl" hint-placeholder-count="2">
                          <p style="margin:0 0 8px;font:400 12.5px/1.6 'Space Grotesk',sans-serif;color:#c9c5e8">{{ hl }}</p>
                        </sc-for>
                      </sc-if>
                      <sc-for list="{{ atlasLayers }}" as="ly" hint-placeholder-count="4">
                        <div style="margin-bottom:4px">
                          <button type="button" onClick="{{ ly.toggle }}" style="display:block;width:100%;text-align:left;background:none;border:0;padding:7px 0;cursor:pointer;font:500 12px/1.4 'JetBrains Mono',monospace;color:#c9c5e8">{{ ly.label }}</button>
                          <div style="display:grid;grid-template-rows:{{ ly.rows }};opacity:{{ ly.opacity }};transition:grid-template-rows .35s cubic-bezier(.22,1,.3,1), opacity .25s;padding-left:14px">
                            <div style="min-height:0;overflow:hidden">
                              <sc-for list="{{ ly.modules }}" as="md" hint-placeholder-count="4">
                                <div style="margin:6px 0;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.025);border:1px solid rgba(160,140,230,.1)">
                                  <div style="font:500 11.5px/1.3 'JetBrains Mono',monospace;color:{{ activeAccent }}">{{ md.label }}</div>
                                  <div style="margin-top:3px;font:400 11.5px/1.5 'Space Grotesk',sans-serif;color:#a9a3d2">{{ md.summary }}</div>
                                  <div style="margin-top:3px;font:400 10px/1.4 'JetBrains Mono',monospace;color:#6f6a92">{{ md.deps }}</div>
                                </div>
                              </sc-for>
                            </div>
                          </div>
                        </div>
                      </sc-for>
                      <div style="margin-top:8px;font:400 10px/1.4 'JetBrains Mono',monospace;color:#6f6a92">{{ atlasHint }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </sc-if>
```

### Part F — verify

- [ ] **Step 21: Run the automated suite**

Run: `npm test`
Expected: PASS — full suite green (this only proves the deleted/changed unit-tested files are consistent; `index.html` itself has no automated coverage, same as the rest of v3).

- [ ] **Step 22: Manual browser verification**

Start the local server (`start-local.bat` or `python -m http.server 8000`), hard-refresh (Ctrl+Shift+R — stale cache is a known trap here), open `sql-agent`'s project window, and check:

1. "▸ Architektur anzeigen" button appears under the tech-stack toggle. Click it — it animates open (same easing as "Technische Details"), label flips to "▾ Architektur verbergen".
2. Each layer row shows `▸ <Name> (<Zahl>)`. Click one — **this is the one part of this task without a proven precedent in this codebase (nested `sc-for`, layer → its modules): if the module cards under a layer do not appear at all when clicked**, that means nested `sc-for` isn't supported by this runtime. Fallback if so: split `atlasLayers` into two flat top-level arrays instead of one nested structure — `atlasLayers` (headers only) and `atlasModuleRows` (all modules from all layers, pre-filtered in `renderVals()` to only the currently-expanded ones via `this.state.atlasExpanded`) — and render them as two independent `sc-for` blocks one after another, same pattern as the existing `rings`/`edges` split earlier in the template.
3. Module cards show label, a short (one-sentence) summary, and — where applicable — a "nutzt: …" line.
4. Resize the window below 760px and above it — the accordion stays usable and readable at both sizes (this is the actual point of the redesign: no viewport gate anymore).
5. Close the project window and reopen it — the atlas resets to closed (`atlasOpen: false`).
6. Planet hover tooltip (unrelated projects, no atlas) still shows correctly — confirms Step 16's revert didn't break the ordinary hover tip.
7. Zoom (mouse wheel) and pan while a project window is open — no camera jump (confirms `stageTransform()` no longer has an atlas branch to misbehave).

If Step 22.2's fallback was needed, apply it now, re-run `npm test`, and re-check 22.2–22.3 before moving on.

- [ ] **Step 23: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Code Atlas als Toggle+Akkordeon statt Regler+Kamerafahrt

Ersetzt die Ring-Geometrie und Kamerafahrt des Code Atlas durch eine
Terminal-Liste im Projektfenster (Layer-Akkordeon, Modul-Karten). Kein
Viewport-Gate mehr noetig -- die Liste ist bei jeder Breite lesbar.
EOF
)"
```

---

## Task 4: `sql-agent.json` mit dem erweiterten Generator neu erzeugen

This regenerates the one committed pilot atlas so its summaries go through Task 1's truncation. It requires the raw `.ua/knowledge-graph.json` from the sibling `sql-copilot` repo, which is gitignored there and may not exist in every checkout — this step is conditional.

**Files:**
- Modify: `data/atlas/sql-agent.json`, `data/atlas/index.json`

- [ ] **Step 1: Check whether the raw graph is available**

Run: `ls ../sql-copilot/.ua/knowledge-graph.json` (adjust the path if `sql-copilot` isn't a sibling directory of `marco-os` in this checkout)

If the file does NOT exist: stop here, skip the rest of this task, and tell Marco to run Step 2 himself later from a machine where the `sql-copilot` repo (with a completed `/understand` run) is checked out.

- [ ] **Step 2: Regenerate (only if Step 1 found the file)**

Run: `node tools/gen-atlas.mjs ../sql-copilot sql-agent`
Expected: console output like `gen-atlas: sql-agent — <N> Layer, <M> Module, <X> KB`, and `data/atlas/sql-agent.json` / `data/atlas/index.json` updated on disk.

- [ ] **Step 3: Spot-check the diff**

Run: `git diff data/atlas/sql-agent.json`
Expected: only `summary` fields change (shorter than before); `id`, `layers[].id`, `modules[].id`, `deps` arrays stay identical — a change anywhere else means something in Task 1/2 behaves unexpectedly and needs investigation before committing.

- [ ] **Step 4: Commit**

```bash
git add data/atlas/sql-agent.json data/atlas/index.json
git commit -m "chore: sql-agent-Atlas mit gekuerzten Summaries neu erzeugt"
```

---

## Task 5: `CLAUDE.md` — Code-Atlas-Abschnitt aktualisieren

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the "Code Atlas" section**

In `CLAUDE.md`, find the `## Code Atlas (data/atlas/)` section. Replace the second paragraph (the one starting "Reinzoomen in einen Planeten zeigt die Architektur..." through "...statt als ein Regler zu erscheinen, der nachweislich nichts bewirkt oder nur einen Klumpen erzeugt.") and the "Nicht verwechseln" paragraph right after it with:

```markdown
Ein Projektfenster mit hinterlegtem Atlas zeigt einen Toggle
("▸ Architektur anzeigen"). Aufgeklappt listet er die Layer des Repos als
eigene Akkordeon-Abschnitte (`▸ <Name> (<Anzahl>)`); ein Klick auf einen Layer
zeigt dessen Module als Karten (Name, gekürzte Summary, ggf. "nutzt: …").
Kein Canvas, keine Kamerafahrt, kein Viewport-Gate mehr — die Liste
funktioniert bei jeder Breite. Ursprünglich (Pilot-Version) war das eine
Ring-Geometrie mit Kamerafahrt und einem dreistufigen Regler; das erwies sich
nach dem Pilot als zu unübersichtlich und wurde durch dieses Redesign
ersetzt (siehe `docs/superpowers/specs/2026-08-06-code-atlas-redesign-design.md`).
```

Then find the paragraph about `tools/gen-atlas.mjs` capping/summaries (the one explaining `atlas-reduce.mjs`) and, in the table listing `tools/atlas-reduce.mjs`, update its description to mention the new truncation rule. Find:

```markdown
| `tools/atlas-reduce.mjs` | Kappung (6 Layer, 8 Module/Layer), deterministisch |
```

Replace with:

```markdown
| `tools/atlas-reduce.mjs` | Kappung (6 Layer, 8 Module/Layer) plus Summary-Kürzung auf den ersten Satz (`truncateSummary`, `MAX_SUMMARY_CHARS = 140`), deterministisch |
```

Also update the `tools/atlas-overrides/<id>.json` row to mention `highlights`:

Find:

```markdown
| `tools/atlas-overrides/<id>.json` | optional: `pin`/`hide`/`labels` (u.a. deutsche Layer-Namen) |
```

Replace with:

```markdown
| `tools/atlas-overrides/<id>.json` | optional: `pin`/`hide`/`labels` (u.a. deutsche Layer-Namen), `highlights` (redaktioneller Teaser, 1-3 Sätze, vor dem ersten Layer-Klick sichtbar) |
```

Finally, `assets/js/atlas-layout.js` is deleted (Task 3) — find its row in the table:

```markdown
| `assets/js/atlas-layout.js` | reine Layout-Funktion, DOM-frei, unit-getestet |
```

Delete that row entirely (it no longer exists).

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: Code-Atlas-Abschnitt in CLAUDE.md auf das Redesign aktualisiert"
```
