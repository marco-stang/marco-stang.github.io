# Code Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Tiefen-Regler pro Planet, der die Architektur des jeweiligen Repos innerhalb der MARCO.OS-Szene sichtbar macht — Stufe 1 Projekt, Stufe 2 Layer-Ringe, Stufe 3 Modul-Knoten.

**Architecture:** Understand-Anything erzeugt offline pro Repo eine `.ua/knowledge-graph.json`. Ein Generator (`tools/gen-atlas.mjs`) normalisiert und reduziert sie zu einer schlanken, committeten `data/atlas/<id>.json`. Der Browser lädt diese Datei lazy beim ersten Wechsel auf Stufe 2 und rendert sie über eine reine, unit-getestete Layout-Funktion in die bestehende Szene.

**Tech Stack:** Vanilla ES Modules, `node --test`, kein Bundler, keine Runtime-Dependencies. Understand-Anything (Egonex-AI, MIT) nur als Offline-Datenquelle.

**Spec:** [`docs/superpowers/specs/2026-08-05-code-atlas-design.md`](../specs/2026-08-05-code-atlas-design.md)

## Global Constraints

Diese gelten für **jede** Task, auch wenn sie dort nicht wiederholt werden:

- **Kein Build-Step, kein Bundler, keine Runtime-Dependencies.** `package.json` bleibt bei `{"type":"module"}` + Test-Script. Auch der Generator nutzt nur `node:`-Builtins.
- **`assets/js/dc-support.js` wird NICHT angefasst.** Das ist die generierte Runtime mit „do not edit" im Header.
- **Alle sichtbaren Texte sind deutsch** (Produktprinzip 4).
- **Dynamische Imports und Fetches im Template-Block von `index.html` müssen `new URL(pfad, document.baseURI)` benutzen.** Relative Pfade lösen gegen `dc-support.js` auf, absolute `/assets/…` brechen unter dem Pages-Unterpfad `/marco-os/`. Siehe `index.html:415-418`.
- **Geometrie braucht immer einen Schmal-Zweig `w < 760`.** Ohne ihn wurde `maxRx` schon einmal negativ und alle Planeten fielen auf die Sonne.
- **Unterhalb 760 px hat der Regler zwei Stufen** („Projekt / Struktur"), Stufe 3 wird dort nicht angeboten.
- **`prefers-reduced-motion` respektieren:** kein Kamera-Flug, harter Schnitt.
- **Kappungsgrenzen:** max. 6 Layer, max. 8 Module pro Layer, Zieldateigröße < 50 KB pro Atlas.
- **Der Generator muss deterministisch sein:** zweimal laufen ohne Code-/Datenänderung erzeugt ein identisches Byte-Ergebnis.
- **Die Szene darf nie kaputtgehen.** Jeder Atlas-Fehler fällt still auf Stufe 1 zurück. Muster: `try { … } catch` wie `index.html:545`.
- **Attribution:** „Understand-Anything (MIT)" muss im Atlas-JSON (`source`), im Projektfenster bei aktivem Regler und im README stehen.
- **Tests laufen mit `npm test`** (`node --test`, Discovery über `tests/*.test.js`). `node --test tests/` funktioniert auf diesem Node-Build **nicht**.
- **Commit-Stil:** deutsche Commit-Messages, wie im Repo üblich.

---

### Task 1: Rohgraph erzeugen und Schema festnageln (Erkundung, Gate)

Das Schema der `.ua/knowledge-graph.json` ist **nirgends öffentlich dokumentiert** — nicht im README, nicht in der Feature-Liste. Jeder Code, der darauf aufbaut, wäre bis hierher geraten. Diese Task erzeugt den echten Graphen und friert seine Struktur als Fixture ein. **Ohne abgeschlossene Task 1 darf Task 2 nicht beginnen.**

**Files:**
- Create: `tests/fixtures/knowledge-graph.sql-copilot.json` (echter, gekürzter Rohgraph)
- Create: `docs/superpowers/plans/2026-08-05-atlas-rohschema.md` (beobachtetes Schema)

**Interfaces:**
- Consumes: nichts
- Produces: die Fixture-Datei und das dokumentierte Rohschema, gegen das Task 2 den Adapter schreibt.

- [ ] **Step 1: Understand-Anything installieren**

In Claude Code:

```
/plugin marketplace add Egonex-AI/Understand-Anything
/plugin install understand-anything
```

- [ ] **Step 2: Analyse auf `sql-copilot` laufen lassen**

```bash
cd "c:/Users/Marco/02_Portfolio/sql-copilot"
```

Dann in Claude Code `/understand` ausführen. Das kostet LLM-Zeit (Minuten, nicht Sekunden). Ergebnis: `.ua/knowledge-graph.json`.

- [ ] **Step 3: `.ua/` im Projekt-Repo ignorieren**

Der Rohgraph gehört nicht ins Git — nur die reduzierte Fassung wird später in marco-os committed.

```bash
cd "c:/Users/Marco/02_Portfolio/sql-copilot"
echo ".ua/" >> .gitignore
git add .gitignore && git commit -m "Rohgraph von Understand-Anything nicht versionieren"
```

- [ ] **Step 4: Struktur inspizieren**

```bash
cd "c:/Users/Marco/02_Portfolio/sql-copilot"
node -e "const g=require('./.ua/knowledge-graph.json'); console.log('top-level keys:', Object.keys(g)); for (const k of Object.keys(g)) { const v=g[k]; console.log(k, Array.isArray(v)?`array[${v.length}]`:typeof v); } "
node -e "const g=require('./.ua/knowledge-graph.json'); const arr=Object.values(g).find(Array.isArray); console.log(JSON.stringify(arr[0],null,2)); "
```

Notiere: Wie heißt das Knoten-Array? Welche Felder hat ein Knoten? Wie sind Kanten abgelegt (eigenes Array vs. `deps`-Feld am Knoten)? Wo steht die Layer-/Architektur-Zuordnung? Wo die Summaries?

- [ ] **Step 5: Beobachtetes Schema dokumentieren**

Schreibe `docs/superpowers/plans/2026-08-05-atlas-rohschema.md` mit: Top-Level-Keys, einem vollständigen Beispielknoten, einer Beispielkante, der Gesamtgröße der Datei und der Knotenzahl. Das ist die Referenz, gegen die Task 2 gebaut wird — und die Erklärung für spätere Sessions, warum der Adapter aussieht, wie er aussieht.

- [ ] **Step 6: Fixture erzeugen (gekürzt, aber echt)**

Die volle Datei ist zu groß fürs Repo. Nimm die ersten 25 Knoten unter Beibehaltung der Originalstruktur:

```bash
cd "c:/Users/Marco/02_Portfolio/marco-os"
node -e "
const fs=require('node:fs');
const g=JSON.parse(fs.readFileSync('../sql-copilot/.ua/knowledge-graph.json','utf8'));
// NAME_DES_KNOTEN_ARRAYS aus Step 4 einsetzen:
const key=Object.keys(g).find(k=>Array.isArray(g[k])&&g[k].length>5);
const out={...g,[key]:g[key].slice(0,25)};
fs.mkdirSync('tests/fixtures',{recursive:true});
fs.writeFileSync('tests/fixtures/knowledge-graph.sql-copilot.json',JSON.stringify(out,null,2));
console.log('geschrieben, Knoten:',out[key].length);
"
```

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/Marco/02_Portfolio/marco-os"
git add tests/fixtures/knowledge-graph.sql-copilot.json docs/superpowers/plans/2026-08-05-atlas-rohschema.md
git commit -m "Atlas: echtes Rohschema von Understand-Anything als Fixture festgehalten"
```

---

### Task 2: Adapter `normalizeGraph` — Rohgraph auf ein stabiles Zwischenformat

Trennt das fremde, undokumentierte Schema vom eigenen Code. Ändert Understand-Anything sein Format, kostet das **nur diese Datei**.

**Files:**
- Create: `tools/atlas-normalize.mjs`
- Test: `tests/atlas-normalize.test.js`

**Interfaces:**
- Consumes: die Fixture aus Task 1.
- Produces:
  ```js
  export function normalizeGraph(raw): {
    nodes: Array<{
      id: string,        // stabil, eindeutig
      label: string,     // kurzer Anzeigename (Dateiname ohne Pfad)
      file: string,      // Pfad relativ zum Repo-Root
      layer: string,     // Layer-Schlüssel, "" wenn unbekannt
      summary: string,   // "" wenn nicht vorhanden
      deps: string[]     // ids, immer ein Array, nie undefined
    }>
  }
  ```

- [ ] **Step 1: Test schreiben**

Erstelle `tests/atlas-normalize.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeGraph } from "../tools/atlas-normalize.mjs";

const FIXTURE = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/knowledge-graph.sql-copilot.json", import.meta.url)), "utf8")
);

test("jeder normalisierte Knoten erfuellt den Vertrag", () => {
  const { nodes } = normalizeGraph(FIXTURE);
  assert.ok(nodes.length > 0, "Fixture muss Knoten liefern");
  for (const n of nodes) {
    assert.equal(typeof n.id, "string");
    assert.ok(n.id.length > 0, "id darf nicht leer sein");
    assert.equal(typeof n.label, "string");
    assert.equal(typeof n.file, "string");
    assert.equal(typeof n.layer, "string");
    assert.equal(typeof n.summary, "string");
    assert.ok(Array.isArray(n.deps), "deps ist immer ein Array");
    assert.ok(n.deps.every((d) => typeof d === "string"));
  }
});

test("ids sind eindeutig", () => {
  const { nodes } = normalizeGraph(FIXTURE);
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length);
});

test("deps verweisen nur auf existierende ids", () => {
  const { nodes } = normalizeGraph(FIXTURE);
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    for (const d of n.deps) assert.ok(ids.has(d), `dangling dep ${d} in ${n.id}`);
  }
});

test("label ist der Dateiname ohne Pfad", () => {
  const raw = { nodes: [{ id: "a", path: "src/deep/app.py" }] };
  const { nodes } = normalizeGraph(raw);
  assert.equal(nodes[0].label, "app.py");
});

test("fehlende Felder werden zu leeren Werten, nicht zu undefined", () => {
  const raw = { nodes: [{ id: "a" }] };
  const { nodes } = normalizeGraph(raw);
  assert.equal(nodes[0].summary, "");
  assert.equal(nodes[0].layer, "");
  assert.deepEqual(nodes[0].deps, []);
});

test("leerer oder kaputter Rohgraph wirft nicht, sondern liefert leere Knoten", () => {
  assert.deepEqual(normalizeGraph(null).nodes, []);
  assert.deepEqual(normalizeGraph({}).nodes, []);
  assert.deepEqual(normalizeGraph({ nodes: "kaputt" }).nodes, []);
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd "c:/Users/Marco/02_Portfolio/marco-os"
npm test
```

Erwartet: FAIL, `Cannot find module '../tools/atlas-normalize.mjs'`.

- [ ] **Step 3: Adapter implementieren**

Erstelle `tools/atlas-normalize.mjs`. **Die Feldnamen in `NODE_ARRAY_KEYS`, `pickPath`, `pickLayer`, `pickSummary` und `pickDeps` an das in Task 1 dokumentierte Schema anpassen** — die Tests prüfen den *Vertrag*, nicht die Zuordnung, also ändern sich nur diese Zeilen.

```js
// Adapter zwischen der undokumentierten .ua/knowledge-graph.json von
// Understand-Anything und unserem stabilen Zwischenformat. Alles, was vom
// fremden Schema abhaengt, steht in DIESER Datei — aendert das Tool sein
// Format, ist das hier die einzige Baustelle.
// Das beobachtete Rohschema steht in docs/superpowers/plans/2026-08-05-atlas-rohschema.md

// Reihenfolge = Priorität; der erste Treffer gewinnt.
const NODE_ARRAY_KEYS = ["nodes", "entities", "files", "symbols"];
const PATH_KEYS = ["path", "file", "filePath", "relativePath"];
const LAYER_KEYS = ["layer", "architecturalLayer", "category", "group"];
const SUMMARY_KEYS = ["summary", "description", "doc", "explanation"];
const DEPS_KEYS = ["deps", "dependencies", "imports", "requires"];

function firstString(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

function pickDeps(node) {
  for (const k of DEPS_KEYS) {
    const v = node?.[k];
    if (Array.isArray(v)) {
      return v
        .map((d) => (typeof d === "string" ? d : typeof d?.id === "string" ? d.id : typeof d?.target === "string" ? d.target : null))
        .filter(Boolean);
    }
  }
  return [];
}

function findNodeArray(raw) {
  for (const k of NODE_ARRAY_KEYS) {
    if (Array.isArray(raw?.[k])) return raw[k];
  }
  // Fallback: das laengste Array auf oberster Ebene, dessen Elemente eine id tragen.
  const candidates = Object.values(raw ?? {}).filter(
    (v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null
  );
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ?? [];
}

function basename(path) {
  const parts = String(path).split(/[/\\]/);
  return parts[parts.length - 1] || String(path);
}

export function normalizeGraph(raw) {
  const source = findNodeArray(raw);
  const seen = new Set();
  const nodes = [];

  for (const entry of source) {
    if (!entry || typeof entry !== "object") continue;
    const id = typeof entry.id === "string" && entry.id ? entry.id : firstString(entry, PATH_KEYS);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const file = firstString(entry, PATH_KEYS);
    nodes.push({
      id,
      label: file ? basename(file) : id,
      file,
      layer: firstString(entry, LAYER_KEYS),
      summary: firstString(entry, SUMMARY_KEYS),
      deps: pickDeps(entry)
    });
  }

  // Kanten ins Leere entfernen: die Szene wuerde sonst auf Knoten zeigen,
  // die es nach der Kappung (oder schon im Rohgraph) gar nicht gibt.
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) n.deps = n.deps.filter((d) => ids.has(d) && d !== n.id);

  return { nodes };
}
```

- [ ] **Step 4: Tests laufen lassen**

```bash
npm test
```

Erwartet: PASS. Schlägt einer der Fixture-Tests fehl, stimmt eine Feldzuordnung nicht — im dokumentierten Rohschema nachsehen und die `*_KEYS`-Listen korrigieren, **nicht** den Test aufweichen.

- [ ] **Step 5: Commit**

```bash
git add tools/atlas-normalize.mjs tests/atlas-normalize.test.js
git commit -m "Atlas: Adapter vom Understand-Anything-Rohgraph aufs Zwischenformat"
```

---

### Task 3: Reduktionskern `reduceGraph` — Kappung, Layer, Determinismus

**Files:**
- Create: `tools/atlas-reduce.mjs`
- Test: `tests/atlas-reduce.test.js`

**Interfaces:**
- Consumes: `normalizeGraph(raw).nodes` aus Task 2 (exakt der dort definierte Knoten-Vertrag).
- Produces:
  ```js
  export const MAX_LAYERS = 6;
  export const MAX_MODULES_PER_LAYER = 8;

  export function reduceGraph(nodes, options): Atlas
  // options: { id, repo, generatedAt, source, overrides? }
  // overrides: { pin?: string[], hide?: string[], labels?: Record<string,string> } | null
  // Atlas: { id, repo, generatedAt, source,
  //          layers:  [{ id, label, summary, count }],
  //          modules: [{ id, layerId, label, file, summary, deps, more? }] }
  ```
  `more: true` markiert den Sammelknoten „+N weitere".

- [ ] **Step 1: Test schreiben**

Erstelle `tests/atlas-reduce.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { reduceGraph, MAX_LAYERS, MAX_MODULES_PER_LAYER } from "../tools/atlas-reduce.mjs";

const OPTS = {
  id: "sql-agent",
  repo: "sql-copilot",
  generatedAt: "2026-08-05",
  source: { tool: "understand-anything", version: "1.0.0", license: "MIT" }
};

// n Knoten in einem Layer mit absteigendem Fan-in: Knoten i haengt von allen
// Knoten VOR ihm ab. Damit wird ${layer}-0 von n-1 anderen gebraucht, der
// letzte von keinem — genau die Rangfolge, nach der reduceGraph auswaehlt.
// (Richtung beachten: deps sind AUSgehende Kanten, der Fan-in entsteht als
// deren Kehrwert. Andersherum aufgebaut kippt die Rangfolge komplett.)
function fanIn(layer, n) {
  const nodes = Array.from({ length: n }, (_, i) => ({
    id: `${layer}-${i}`, label: `f${i}.py`, file: `src/${layer}/f${i}.py`,
    layer, summary: `summary ${i}`, deps: []
  }));
  nodes.forEach((node, i) => { node.deps = nodes.slice(0, i).map((t) => t.id); });
  return nodes;
}

test("erzeugt einen Layer je vorkommendem layer-Wert", () => {
  const atlas = reduceGraph([...fanIn("ui", 2), ...fanIn("db", 2)], OPTS);
  assert.deepEqual(atlas.layers.map((l) => l.id).sort(), ["db", "ui"]);
});

test("kappt auf MAX_LAYERS Layer", () => {
  const nodes = Array.from({ length: MAX_LAYERS + 3 }, (_, i) => fanIn(`l${i}`, 2)).flat();
  const atlas = reduceGraph(nodes, OPTS);
  assert.equal(atlas.layers.length, MAX_LAYERS);
});

test("kappt auf MAX_MODULES_PER_LAYER echte Module plus einen Sammelknoten", () => {
  const atlas = reduceGraph(fanIn("ui", MAX_MODULES_PER_LAYER + 5), OPTS);
  const inUi = atlas.modules.filter((m) => m.layerId === "ui");
  const echte = inUi.filter((m) => !m.more);
  const sammel = inUi.filter((m) => m.more);
  assert.equal(echte.length, MAX_MODULES_PER_LAYER);
  assert.equal(sammel.length, 1);
  assert.equal(sammel[0].label, "+5 weitere");
});

test("count nennt die WAHRE Anzahl im Layer, nicht die gekappte", () => {
  const atlas = reduceGraph(fanIn("ui", 20), OPTS);
  assert.equal(atlas.layers.find((l) => l.id === "ui").count, 20);
});

test("ohne Kappung entsteht kein Sammelknoten", () => {
  const atlas = reduceGraph(fanIn("ui", 3), OPTS);
  assert.equal(atlas.modules.filter((m) => m.more).length, 0);
});

test("waehlt Module nach eingehenden Abhaengigkeiten aus", () => {
  const atlas = reduceGraph(fanIn("ui", MAX_MODULES_PER_LAYER + 4), OPTS);
  const ids = atlas.modules.filter((m) => m.layerId === "ui" && !m.more).map((m) => m.id);
  // ui-0 hat den hoechsten Fan-in und muss dabei sein, das letzte nicht.
  assert.ok(ids.includes("ui-0"));
  assert.ok(!ids.includes(`ui-${MAX_MODULES_PER_LAYER + 3}`));
});

test("ist deterministisch", () => {
  const nodes = fanIn("ui", 30);
  assert.equal(
    JSON.stringify(reduceGraph(nodes, OPTS)),
    JSON.stringify(reduceGraph(nodes, OPTS))
  );
});

test("pin erzwingt Aufnahme eines sonst gekappten Moduls", () => {
  const last = `ui-${MAX_MODULES_PER_LAYER + 3}`;
  const atlas = reduceGraph(fanIn("ui", MAX_MODULES_PER_LAYER + 4), {
    ...OPTS, overrides: { pin: [last] }
  });
  const ids = atlas.modules.filter((m) => m.layerId === "ui" && !m.more).map((m) => m.id);
  assert.ok(ids.includes(last));
  assert.equal(ids.length, MAX_MODULES_PER_LAYER);
});

test("hide entfernt ein Modul trotz hohem Fan-in", () => {
  const atlas = reduceGraph(fanIn("ui", 5), { ...OPTS, overrides: { hide: ["ui-0"] } });
  assert.ok(!atlas.modules.some((m) => m.id === "ui-0"));
});

test("labels-Override setzt den Layer-Namen (fuer deutsche Beschriftung)", () => {
  const atlas = reduceGraph(fanIn("ui", 2), { ...OPTS, overrides: { labels: { ui: "Oberflaeche" } } });
  assert.equal(atlas.layers.find((l) => l.id === "ui").label, "Oberflaeche");
});

test("Knoten ohne layer landen im Sammel-Layer 'sonstiges'", () => {
  const atlas = reduceGraph([{ id: "x", label: "x.py", file: "x.py", layer: "", summary: "", deps: [] }], OPTS);
  assert.equal(atlas.layers[0].id, "sonstiges");
});

test("deps zeigen nach der Kappung nur auf ausgelieferte Module", () => {
  const atlas = reduceGraph(fanIn("ui", MAX_MODULES_PER_LAYER + 6), OPTS);
  const ids = new Set(atlas.modules.map((m) => m.id));
  for (const m of atlas.modules) for (const d of m.deps) assert.ok(ids.has(d));
});

test("uebernimmt Kopfdaten inklusive Attribution", () => {
  const atlas = reduceGraph(fanIn("ui", 2), OPTS);
  assert.equal(atlas.id, "sql-agent");
  assert.equal(atlas.repo, "sql-copilot");
  assert.equal(atlas.generatedAt, "2026-08-05");
  assert.equal(atlas.source.license, "MIT");
});

test("leere Eingabe liefert einen leeren, gueltigen Atlas", () => {
  const atlas = reduceGraph([], OPTS);
  assert.deepEqual(atlas.layers, []);
  assert.deepEqual(atlas.modules, []);
  assert.equal(atlas.id, "sql-agent");
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npm test
```

Erwartet: FAIL, `Cannot find module '../tools/atlas-reduce.mjs'`.

- [ ] **Step 3: Reduktionskern implementieren**

Erstelle `tools/atlas-reduce.mjs`:

```js
// Reduziert den normalisierten Graphen auf die Sicht, die die Szene rendern
// kann. Kappung passiert HIER, nicht zur Laufzeit — der Browser soll nie in
// die Lage kommen, 400 Knoten sortieren zu muessen.
// Reine Funktion, kein fs, kein Netz: darum unit-testbar.

export const MAX_LAYERS = 6;
export const MAX_MODULES_PER_LAYER = 8;
const FALLBACK_LAYER = "sonstiges";

// Deterministische Sortierung: Fan-in absteigend, dann Fan-out absteigend,
// dann Pfad, zuletzt id. Die id-Stufe ist nicht optional: `file` ist NICHT
// eindeutig — funktions- und klassengenaue Knoten teilen sich eine Datei.
// Ohne sie faellt die Sortierung bei Gleichstand auf die Eingabereihenfolge
// des Scanners zurueck, und ein erneuter Generatorlauf erzeugt grundlos ein
// Diff. Nur die id ist laut Eingabevertrag garantiert eindeutig.
function byRelevance(fanIn) {
  return (a, b) =>
    (fanIn.get(b.id) ?? 0) - (fanIn.get(a.id) ?? 0) ||
    b.deps.length - a.deps.length ||
    (a.file || a.id).localeCompare(b.file || b.id) ||
    a.id.localeCompare(b.id);
}

export function reduceGraph(nodes, options) {
  const { id, repo, generatedAt, source, overrides = null } = options;
  const pin = new Set(overrides?.pin ?? []);
  const hide = new Set(overrides?.hide ?? []);
  const labels = overrides?.labels ?? {};

  const visible = (nodes ?? []).filter((n) => !hide.has(n.id));

  const fanIn = new Map();
  for (const n of visible) for (const d of n.deps) fanIn.set(d, (fanIn.get(d) ?? 0) + 1);

  const byLayer = new Map();
  for (const n of visible) {
    const key = n.layer || FALLBACK_LAYER;
    if (!byLayer.has(key)) byLayer.set(key, []);
    byLayer.get(key).push(n);
  }

  // Layer-Kappung: die groessten Layer gewinnen, bei Gleichstand alphabetisch.
  const layerKeys = [...byLayer.keys()]
    .sort((a, b) => byLayer.get(b).length - byLayer.get(a).length || a.localeCompare(b))
    .slice(0, MAX_LAYERS);

  const layers = [];
  const modules = [];

  for (const key of layerKeys) {
    const all = byLayer.get(key);
    const sorted = [...all].sort(byRelevance(fanIn));
    // Gepinnte zuerst, dann nach Relevanz auffuellen.
    const pinned = sorted.filter((n) => pin.has(n.id));
    const rest = sorted.filter((n) => !pin.has(n.id));
    const chosen = [...pinned, ...rest].slice(0, MAX_MODULES_PER_LAYER);

    layers.push({
      id: key,
      label: labels[key] ?? key,
      summary: chosen[0]?.summary ?? "",
      count: all.length
    });

    for (const n of chosen) {
      modules.push({
        id: n.id, layerId: key, label: n.label, file: n.file,
        summary: n.summary, deps: n.deps
      });
    }

    const dropped = all.length - chosen.length;
    if (dropped > 0) {
      modules.push({
        id: `${key}__more`, layerId: key, label: `+${dropped} weitere`,
        file: "", summary: "", deps: [], more: true
      });
    }
  }

  // Kanten, deren Ziel weggekappt wurde, entfernen — sonst zeichnet die Szene
  // Linien ins Nichts.
  const kept = new Set(modules.map((m) => m.id));
  for (const m of modules) m.deps = m.deps.filter((d) => kept.has(d));

  return { id, repo, generatedAt, source, layers, modules };
}
```

- [ ] **Step 4: Tests laufen lassen**

```bash
npm test
```

Erwartet: PASS, alle Tests aus Step 1.

- [ ] **Step 5: Commit**

```bash
git add tools/atlas-reduce.mjs tests/atlas-reduce.test.js
git commit -m "Atlas: Reduktionskern mit Kappung, Overrides und Determinismus"
```

---

### Task 4: CLI `tools/gen-atlas.mjs`

**Files:**
- Create: `tools/gen-atlas.mjs`
- Create: `data/atlas/.gitkeep`

**Interfaces:**
- Consumes: `normalizeGraph` (Task 2), `reduceGraph` (Task 3).
- Produces: `data/atlas/<id>.json` und `data/atlas/index.json` mit der Form
  ```js
  { generatedAt: "2026-08-05", projects: { "sql-agent": { repo, layers, modules } } }
  ```
  `layers`/`modules` sind hier **Zahlen** (Anzahl), damit die Szene ohne Nachladen weiß, ob sich der Regler lohnt.

- [ ] **Step 1: CLI implementieren**

Erstelle `tools/gen-atlas.mjs`:

```js
// Erzeugt data/atlas/<id>.json aus der .ua/knowledge-graph.json eines Repos.
// Aufruf aus dem marco-os-Repo-Root:
//   node tools/gen-atlas.mjs ../sql-copilot sql-agent
// Die <id> MUSS einer id aus data/projects.js entsprechen — sonst faende die
// Szene den Atlas nie, und der Fehler wuerde erst im Browser auffallen.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeGraph } from "./atlas-normalize.mjs";
import { reduceGraph } from "./atlas-reduce.mjs";

const ATLAS_DIR = fileURLToPath(new URL("../data/atlas/", import.meta.url));
const PROJECTS_JS = fileURLToPath(new URL("../data/projects.js", import.meta.url));
const OVERRIDES_DIR = fileURLToPath(new URL("./atlas-overrides/", import.meta.url));

function fail(message) {
  console.error(`gen-atlas: ${message}`);
  process.exit(1);
}

const [repoPath, projectId] = process.argv.slice(2);
if (!repoPath || !projectId) fail("Aufruf: node tools/gen-atlas.mjs <pfad-zum-repo> <projekt-id>");

const { projects } = await import(new URL("../data/projects.js", import.meta.url));
if (!projects.some((p) => p.id === projectId)) {
  fail(`id "${projectId}" existiert nicht in data/projects.js. Vorhanden: ${projects.map((p) => p.id).join(", ")}`);
}

const graphPath = `${repoPath.replace(/[/\\]$/, "")}/.ua/knowledge-graph.json`;
if (!existsSync(graphPath)) fail(`${graphPath} nicht gefunden — erst /understand im Repo laufen lassen.`);

const raw = JSON.parse(readFileSync(graphPath, "utf8"));
const { nodes } = normalizeGraph(raw);
if (nodes.length === 0) fail("Rohgraph enthaelt keine verwertbaren Knoten — Rohschema pruefen.");

const overridePath = `${OVERRIDES_DIR}${projectId}.json`;
const overrides = existsSync(overridePath) ? JSON.parse(readFileSync(overridePath, "utf8")) : null;

const atlas = reduceGraph(nodes, {
  id: projectId,
  repo: repoPath.split(/[/\\]/).filter(Boolean).pop(),
  // Nur das Datum, nicht die Uhrzeit: sonst erzeugt jeder Lauf ein Diff,
  // obwohl sich inhaltlich nichts geaendert hat.
  generatedAt: new Date().toISOString().slice(0, 10),
  source: { tool: "understand-anything", version: raw?.version ?? "unbekannt", license: "MIT" },
  overrides
});

mkdirSync(ATLAS_DIR, { recursive: true });
writeFileSync(`${ATLAS_DIR}${projectId}.json`, JSON.stringify(atlas, null, 2) + "\n");

const indexPath = `${ATLAS_DIR}index.json`;
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : { projects: {} };
index.projects[projectId] = {
  repo: atlas.repo,
  layers: atlas.layers.length,
  modules: atlas.modules.filter((m) => !m.more).length
};
index.generatedAt = atlas.generatedAt;
// Schluessel sortieren: sonst haengt die Reihenfolge davon ab, in welcher
// Reihenfolge man die Repos zufaellig verarbeitet hat.
index.projects = Object.fromEntries(Object.entries(index.projects).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

const kb = (JSON.stringify(atlas).length / 1024).toFixed(1);
console.log(`gen-atlas: ${projectId} — ${atlas.layers.length} Layer, ${atlas.modules.length} Module, ${kb} KB`);
if (kb > 50) console.warn("gen-atlas: WARNUNG — ueber 50 KB, Kappungsgrenzen pruefen.");
```

- [ ] **Step 2: Verzeichnis anlegen und CLI-Fehlerpfade prüfen**

```bash
cd "c:/Users/Marco/02_Portfolio/marco-os"
mkdir -p data/atlas && touch data/atlas/.gitkeep
node tools/gen-atlas.mjs
node tools/gen-atlas.mjs ../sql-copilot gibt-es-nicht
```

Erwartet: erster Aufruf meldet die Aufrufsyntax, zweiter meldet die unbekannte id samt Liste der vorhandenen. Beide mit Exit-Code 1.

- [ ] **Step 3: Echten Lauf gegen `sql-copilot`**

```bash
node tools/gen-atlas.mjs ../sql-copilot sql-agent
```

Erwartet: Ausgabe mit Layer-/Modulzahl und Größe unter 50 KB.

- [ ] **Step 4: Determinismus in echt prüfen**

```bash
cp data/atlas/sql-agent.json /tmp/atlas-lauf1.json
node tools/gen-atlas.mjs ../sql-copilot sql-agent
diff /tmp/atlas-lauf1.json data/atlas/sql-agent.json && echo "DETERMINISTISCH"
```

Erwartet: `DETERMINISTISCH`, kein Diff.

- [ ] **Step 5: Commit**

```bash
git add tools/gen-atlas.mjs data/atlas/
git commit -m "Atlas: Generator-CLI inklusive index.json"
```

---

### Task 5: Layout-Funktion `assets/js/atlas-layout.js`

Der riskanteste Teil — deshalb als **reine, DOM-freie Funktion in eigener Datei**, exakt wie `assets/js/graph-layout.js` es für das Legacy-Frontend vormacht. Sie wird vollständig getestet, **bevor** die Szene sie benutzt.

**Files:**
- Create: `assets/js/atlas-layout.js`
- Test: `tests/atlas-layout.test.js`

**Interfaces:**
- Consumes: das Atlas-Objekt aus Task 3.
- Produces:
  ```js
  export const NARROW_VIEWPORT = 760;
  export function maxLevelFor(width): 2 | 3
  export function computeAtlasLayout(atlas, opts): {
    rings: Array<{ cx, cy, rx, ry, label, layerId, count }>,
    nodes: Array<{ id, layerId, label, summary, more: boolean, x, y }>,
    edges: Array<{ d: string, from: string, to: string }>
  }
  // opts: { level: 2|3, cx, cy, w, h }
  ```
  `level` wird intern gegen `maxLevelFor(w)` gedeckelt — Stufe 3 auf einem schmalen Viewport liefert dieselbe Ausgabe wie Stufe 2.

- [ ] **Step 1: Test schreiben**

Erstelle `tests/atlas-layout.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAtlasLayout, maxLevelFor, NARROW_VIEWPORT } from "../assets/js/atlas-layout.js";

const ATLAS = {
  id: "sql-agent", repo: "sql-copilot", generatedAt: "2026-08-05",
  source: { tool: "understand-anything", license: "MIT" },
  layers: [
    { id: "ui", label: "Oberflaeche", summary: "", count: 3 },
    { id: "agent", label: "Agent-Logik", summary: "", count: 7 }
  ],
  modules: [
    { id: "app", layerId: "ui", label: "app.py", file: "src/app.py", summary: "s", deps: ["graph"] },
    { id: "graph", layerId: "agent", label: "graph.py", file: "src/graph.py", summary: "s", deps: [] },
    { id: "agent__more", layerId: "agent", label: "+5 weitere", file: "", summary: "", deps: [], more: true }
  ]
};
const WIDE = { level: 3, cx: 640, cy: 350, w: 1280, h: 700 };

test("Stufe 2 zeigt Ringe, aber keine Modulknoten", () => {
  const { rings, nodes } = computeAtlasLayout(ATLAS, { ...WIDE, level: 2 });
  assert.equal(rings.length, 2);
  assert.equal(nodes.length, 0);
});

test("Stufe 3 zeigt einen Knoten je Modul", () => {
  const { nodes } = computeAtlasLayout(ATLAS, WIDE);
  assert.equal(nodes.length, 3);
  assert.deepEqual(nodes.map((n) => n.id).sort(), ["agent__more", "app", "graph"]);
});

test("ein Ring je Layer, in der Layer-Reihenfolge von innen nach aussen", () => {
  const { rings } = computeAtlasLayout(ATLAS, WIDE);
  assert.ok(rings[0].rx < rings[1].rx);
  assert.equal(rings[0].label, "Oberflaeche");
});

test("Ringe sind auf dem uebergebenen Mittelpunkt zentriert", () => {
  const { rings } = computeAtlasLayout(ATLAS, WIDE);
  for (const r of rings) { assert.equal(r.cx, 640); assert.equal(r.cy, 350); }
});

test("kein Radius wird null oder negativ — auch nicht bei 320 px", () => {
  const { rings } = computeAtlasLayout(ATLAS, { level: 2, cx: 160, cy: 300, w: 320, h: 600 });
  for (const r of rings) { assert.ok(r.rx > 0, `rx=${r.rx}`); assert.ok(r.ry > 0, `ry=${r.ry}`); }
});

test("alle Knoten liegen innerhalb des Viewports", () => {
  const { nodes } = computeAtlasLayout(ATLAS, WIDE);
  for (const n of nodes) {
    assert.ok(n.x >= 0 && n.x <= 1280, `x=${n.x}`);
    assert.ok(n.y >= 0 && n.y <= 700, `y=${n.y}`);
  }
});

test("Module sitzen auf dem Ring ihres Layers", () => {
  const { rings, nodes } = computeAtlasLayout(ATLAS, WIDE);
  const uiRing = rings[0];
  const app = nodes.find((n) => n.id === "app");
  const dx = (app.x - uiRing.cx) / uiRing.rx;
  const dy = (app.y - uiRing.cy) / uiRing.ry;
  assert.ok(Math.abs(Math.hypot(dx, dy) - 1) < 0.001, "Modul liegt nicht auf seiner Ellipse");
});

test("Kanten entstehen nur zwischen dargestellten Modulen", () => {
  const { edges } = computeAtlasLayout(ATLAS, WIDE);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].from, "app");
  assert.equal(edges[0].to, "graph");
  assert.ok(edges[0].d.startsWith("M"));
});

test("Stufe 2 erzeugt keine Kanten", () => {
  const { edges } = computeAtlasLayout(ATLAS, { ...WIDE, level: 2 });
  assert.equal(edges.length, 0);
});

test("der Sammelknoten wird als more markiert", () => {
  const { nodes } = computeAtlasLayout(ATLAS, WIDE);
  assert.equal(nodes.find((n) => n.id === "agent__more").more, true);
  assert.equal(nodes.find((n) => n.id === "app").more, false);
});

test("maxLevelFor erlaubt Stufe 3 erst ab NARROW_VIEWPORT", () => {
  assert.equal(maxLevelFor(NARROW_VIEWPORT - 1), 2);
  assert.equal(maxLevelFor(NARROW_VIEWPORT), 3);
  assert.equal(maxLevelFor(1280), 3);
});

test("Stufe 3 auf schmalem Viewport faellt auf Stufe 2 zurueck", () => {
  const { nodes } = computeAtlasLayout(ATLAS, { level: 3, cx: 160, cy: 300, w: 375, h: 700 });
  assert.equal(nodes.length, 0);
});

test("ist deterministisch", () => {
  assert.equal(
    JSON.stringify(computeAtlasLayout(ATLAS, WIDE)),
    JSON.stringify(computeAtlasLayout(ATLAS, WIDE))
  );
});

test("leerer Atlas liefert leere Listen statt zu werfen", () => {
  const leer = { ...ATLAS, layers: [], modules: [] };
  const out = computeAtlasLayout(leer, WIDE);
  assert.deepEqual(out.rings, []);
  assert.deepEqual(out.nodes, []);
  assert.deepEqual(out.edges, []);
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npm test
```

Erwartet: FAIL, `Cannot find module '../assets/js/atlas-layout.js'`.

- [ ] **Step 3: Layout-Funktion implementieren**

Erstelle `assets/js/atlas-layout.js`:

```js
// Layout der Atlas-Ansicht: Layer als konzentrische Ellipsen um den aktiven
// Planeten, Module als Punkte darauf. Reine Funktion, DOM-frei, kein Import
// aus dem Template-Block — genau wie graph-layout.js fuer das Legacy-Frontend.
// Der Grund fuer diese Trennung: die Geometrie ist der Teil, der in diesem
// Repo schon einmal die ganze Szene zerlegt hat (negativer Radius unter
// 400 px Breite). Sie muss testbar sein, bevor sie irgendetwas rendert.

export const NARROW_VIEWPORT = 760;

// Verhaeltnis Hoehe/Breite der Ringe — flacher als ein Kreis, passend zum
// breiten Viewport und konsistent mit den Cluster-Ringen der Hauptszene.
const ASPECT = 0.72;
const INNER_RX = 74;          // Abstand des ersten Rings zum Planetenkoerper
const RING_STEP = 46;         // Abstand zwischen zwei Layer-Ringen
const NARROW_INNER_RX = 52;
const NARROW_RING_STEP = 32;
// Startwinkel je Ring versetzt, damit Module benachbarter Ringe nicht auf
// derselben Speiche uebereinander liegen.
const RING_ANGLE_OFFSET_DEG = 37;

export function maxLevelFor(width) {
  return width < NARROW_VIEWPORT ? 2 : 3;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function computeAtlasLayout(atlas, opts) {
  const { cx, cy, w, h } = opts;
  const level = Math.min(opts.level, maxLevelFor(w));
  const layers = atlas?.layers ?? [];
  const modules = atlas?.modules ?? [];

  const narrow = w < NARROW_VIEWPORT;
  const innerRx = narrow ? NARROW_INNER_RX : INNER_RX;
  const step = narrow ? NARROW_RING_STEP : RING_STEP;

  // Der aeusserste Ring darf den Viewport nicht verlassen. Math.max haelt den
  // Radius auch dann positiv, wenn der Planet dicht am Rand sitzt — ein
  // negatives rx laesst den Browser die Ellipse verwerfen.
  const roomX = Math.max(innerRx, Math.min(cx, w - cx) - 12);
  const roomY = Math.max(innerRx * ASPECT, Math.min(cy, h - cy) - 12);
  const maxRx = Math.max(innerRx, Math.min(roomX, roomY / ASPECT));

  // Schrittweite aus der verfuegbaren Spanne ableiten statt fix zu setzen und
  // dann zu klemmen: bei MAX_LAYERS=6 auf 375px Breite fielen sonst die Ringe
  // 4-6 auf denselben Radius. Unter 760px ist Stufe 3 abgeschaltet, die Ringe
  // SIND dort die ganze Ansicht — drei ununterscheidbare Layer waeren der
  // komplette Informationsverlust. gapCount floort auf 1, damit ein
  // Ein-Layer-Atlas nicht durch null teilt.
  const gapCount = Math.max(layers.length - 1, 1);
  const effectiveStep = Math.min(step, (maxRx - innerRx) / gapCount);

  const rings = layers.map((layer, i) => {
    const rx = clamp(innerRx + i * effectiveStep, innerRx, maxRx);
    return { cx, cy, rx, ry: rx * ASPECT, label: layer.label, layerId: layer.id, count: layer.count };
  });

  if (level < 3) return { rings, nodes: [], edges: [] };

  const ringById = new Map(rings.map((r) => [r.layerId, r]));
  const nodes = [];

  for (const [ringIndex, layer] of layers.entries()) {
    const ring = ringById.get(layer.id);
    const members = modules.filter((m) => m.layerId === layer.id);
    members.forEach((m, i) => {
      const a =
        (2 * Math.PI * i) / Math.max(members.length, 1) +
        (ringIndex * RING_ANGLE_OFFSET_DEG * Math.PI) / 180;
      nodes.push({
        id: m.id,
        layerId: m.layerId,
        label: m.label,
        summary: m.summary,
        more: m.more === true,
        x: ring.cx + Math.cos(a) * ring.rx,
        y: ring.cy + Math.sin(a) * ring.ry
      });
    });
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = [];
  for (const m of modules) {
    const from = byId.get(m.id);
    if (!from) continue;
    for (const depId of m.deps ?? []) {
      const to = byId.get(depId);
      if (!to) continue;
      // Leicht gebogen, gleiche Formel wie die Kanten der Hauptszene, damit
      // beide Ebenen visuell zusammengehoeren.
      const qx = (from.x + to.x) / 2 + (to.y - from.y) * 0.12;
      const qy = (from.y + to.y) / 2 - (to.x - from.x) * 0.12;
      edges.push({ from: m.id, to: depId, d: `M${from.x} ${from.y} Q${qx} ${qy} ${to.x} ${to.y}` });
    }
  }

  return { rings, nodes, edges };
}
```

- [ ] **Step 4: Tests laufen lassen**

```bash
npm test
```

Erwartet: PASS, alle Tests aus Step 1.

- [ ] **Step 5: Commit**

```bash
git add assets/js/atlas-layout.js tests/atlas-layout.test.js
git commit -m "Atlas: reine, getestete Layout-Funktion fuer Layer- und Modulringe"
```

---

### Task 6: Lader `assets/js/atlas-data.js`

**Files:**
- Create: `assets/js/atlas-data.js`
- Test: `tests/atlas-data.test.js`

**Interfaces:**
- Consumes: `data/atlas/index.json` und `data/atlas/<id>.json` aus Task 4.
- Produces:
  ```js
  export function isValidAtlas(value): boolean
  export function hasAtlas(index, projectId): boolean
  export async function loadAtlas(projectId, baseUrl, fetchImpl = globalThis.fetch): Atlas | null
  export async function loadAtlasIndex(baseUrl, fetchImpl = globalThis.fetch): { projects: {} }
  export function __resetAtlasCache(): void   // nur fuer Tests
  ```
  `loadAtlas` cacht pro Projekt-id und wirft nie — bei jedem Fehler `null`. Der `fetchImpl`-Parameter existiert, damit die Fehlerpfade ohne Netz und ohne Browser testbar sind; Produktivcode übergibt ihn nicht.

- [ ] **Step 1: Test schreiben**

Getestet werden die reinen Teile (Validierung, Index-Abfrage) und der Fehlerpfad des Laders über ein injiziertes `fetch`. Erstelle `tests/atlas-data.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidAtlas, hasAtlas, loadAtlas, __resetAtlasCache } from "../assets/js/atlas-data.js";

const GUELTIG = {
  id: "sql-agent", repo: "sql-copilot", generatedAt: "2026-08-05",
  source: { tool: "understand-anything", license: "MIT" },
  layers: [{ id: "ui", label: "Oberflaeche", summary: "", count: 3 }],
  modules: [{ id: "app", layerId: "ui", label: "app.py", file: "a", summary: "", deps: [] }]
};

test("erkennt einen gueltigen Atlas", () => {
  assert.equal(isValidAtlas(GUELTIG), true);
});

test("weist alles zurueck, was den Vertrag verletzt", () => {
  assert.equal(isValidAtlas(null), false);
  assert.equal(isValidAtlas({}), false);
  assert.equal(isValidAtlas("string"), false);
  assert.equal(isValidAtlas({ ...GUELTIG, layers: "keine liste" }), false);
  assert.equal(isValidAtlas({ ...GUELTIG, modules: undefined }), false);
  assert.equal(isValidAtlas({ ...GUELTIG, id: 42 }), false);
  assert.equal(isValidAtlas({ ...GUELTIG, layers: [{ label: "ohne id" }] }), false);
  assert.equal(isValidAtlas({ ...GUELTIG, modules: [{ id: "x" }] }), false);
});

test("hasAtlas liest den Index defensiv", () => {
  const index = { projects: { "sql-agent": { layers: 2, modules: 9 } } };
  assert.equal(hasAtlas(index, "sql-agent"), true);
  assert.equal(hasAtlas(index, "gibt-es-nicht"), false);
  assert.equal(hasAtlas(null, "sql-agent"), false);
  assert.equal(hasAtlas({}, "sql-agent"), false);
});

test("hasAtlas ist falsch, wenn der Eintrag keine Layer hat", () => {
  assert.equal(hasAtlas({ projects: { x: { layers: 0, modules: 0 } } }, "x"), false);
});

test("loadAtlas liefert null statt zu werfen, wenn der Abruf scheitert", async () => {
  __resetAtlasCache();
  const fetchImpl = async () => { throw new Error("offline"); };
  assert.equal(await loadAtlas("sql-agent", "https://example.test/", fetchImpl), null);
});

test("loadAtlas liefert null bei HTTP-Fehler", async () => {
  __resetAtlasCache();
  const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
  assert.equal(await loadAtlas("sql-agent", "https://example.test/", fetchImpl), null);
});

test("loadAtlas liefert null bei ungueltigem Inhalt", async () => {
  __resetAtlasCache();
  const fetchImpl = async () => ({ ok: true, json: async () => ({ kaputt: true }) });
  assert.equal(await loadAtlas("sql-agent", "https://example.test/", fetchImpl), null);
});

test("loadAtlas cacht pro Projekt und ruft nur einmal ab", async () => {
  __resetAtlasCache();
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: true, json: async () => GUELTIG }; };
  const a = await loadAtlas("sql-agent", "https://example.test/", fetchImpl);
  const b = await loadAtlas("sql-agent", "https://example.test/", fetchImpl);
  assert.equal(calls, 1);
  assert.equal(a.id, "sql-agent");
  assert.equal(b, a);
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npm test
```

Erwartet: FAIL, `Cannot find module '../assets/js/atlas-data.js'`.

- [ ] **Step 3: Lader implementieren**

Erstelle `assets/js/atlas-data.js`:

```js
// Laedt die Atlas-Dateien lazy nach — erst beim ersten Wechsel auf Stufe 2,
// dann pro Projekt genau einmal. Dasselbe Muster wie github-activity.js und
// aus demselben Grund: die Startseite darf nicht langsamer werden.
//
// Fehlerpfade sind konsequent still und liefern null. Die Szene IST die
// Seite — ein fehlender Atlas darf sie nie kosten.

const cache = new Map();      // projectId -> Atlas
const inFlight = new Map();   // projectId -> Promise
const FETCH_TIMEOUT_MS = 6000;

// Nur fuer Tests.
export function __resetAtlasCache() {
  cache.clear();
  inFlight.clear();
}

export function isValidAtlas(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (!Array.isArray(value.layers) || !Array.isArray(value.modules)) return false;
  if (!value.layers.every((l) => l && typeof l.id === "string" && typeof l.label === "string")) return false;
  if (!value.modules.every((m) => m && typeof m.id === "string" && typeof m.layerId === "string")) return false;
  return true;
}

export function hasAtlas(index, projectId) {
  const entry = index?.projects?.[projectId];
  return Boolean(entry) && Number(entry.layers) > 0;
}

async function fetchJson(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response?.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadAtlasIndex(baseUrl, fetchImpl = globalThis.fetch) {
  const data = await fetchJson(`${baseUrl}data/atlas/index.json`, fetchImpl);
  return data && typeof data === "object" && data.projects ? data : { projects: {} };
}

export async function loadAtlas(projectId, baseUrl, fetchImpl = globalThis.fetch) {
  if (cache.has(projectId)) return cache.get(projectId);
  if (inFlight.has(projectId)) return inFlight.get(projectId);

  const promise = (async () => {
    const data = await fetchJson(`${baseUrl}data/atlas/${projectId}.json`, fetchImpl);
    if (!isValidAtlas(data)) return null;
    cache.set(projectId, data);
    return data;
  })().finally(() => inFlight.delete(projectId));

  inFlight.set(projectId, promise);
  return promise;
}
```

- [ ] **Step 4: Tests laufen lassen**

```bash
npm test
```

Erwartet: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/js/atlas-data.js tests/atlas-data.test.js
git commit -m "Atlas: lazy Lader mit Validierung und stillem Fehlerpfad"
```

---

### Task 7: Regler im Projektfenster (ohne Szenenänderung)

Bewusst getrennt von Task 8: hier entsteht die Bedienung samt Zustand und Attribution, die Szene bleibt unangetastet. Ein Reviewer kann diese Task annehmen und die nächste ablehnen.

**Files:**
- Modify: `index.html` — `state`-Initialisierung (Zeile ~407-412), `componentDidMount` (~414-460), Projektfenster-Block (~302-360), `renderVals` (~878-895)

**Interfaces:**
- Consumes: `loadAtlas`, `loadAtlasIndex`, `hasAtlas` (Task 6), `maxLevelFor` (Task 5).
- Produces: `this.state.atlasLevel` (1|2|3), `this.state.atlasIndex`, `this.state.atlas` — von Task 8 gelesen.

- [ ] **Step 1: Zustand ergänzen**

In `index.html` die `state`-Initialisierung um drei Felder erweitern:

```js
    hist: false, tour: -1, term: [{ text: "MARCO.OS Terminal. Tippe 'help' und du siehst alle Befehle.", kind: "muted" }], gh: {},
    tipIndex: 0, visitors: null, chatStalled: false,
    // Code Atlas: Stufe 1 = heutige Ansicht, 2 = Layer-Ringe, 3 = Modulknoten.
    atlasLevel: 1, atlasIndex: null, atlas: null, atlasError: false, atlasHover: null
```

- [ ] **Step 2: Index beim Start laden**

In `componentDidMount`, direkt nach dem `analytics.js`-Import-Block einfügen. `modUrl` und `document.baseURI` sind Pflicht — siehe Global Constraints:

```js
    // Nur der Index (wenige hundert Byte) kommt beim Start mit; er entscheidet
    // lediglich, ob der Regler ueberhaupt erscheint. Die Atlas-Dateien selbst
    // werden erst beim Wechsel auf Stufe 2 geholt.
    import(modUrl("atlas-data.js")).then((m) => {
      this._atlas = m;
      return m.loadAtlasIndex(new URL("./", document.baseURI).href);
    }).then((index) => this.setState({ atlasIndex: index })).catch(() => {});
```

- [ ] **Step 3: Stufenwechsel implementieren**

Als Methode der Komponente ergänzen (neben `open`/`close`):

```js
  setAtlasLevel = (level) => {
    const id = this.state.active;
    if (level <= 1) { this.setState({ atlasLevel: 1, atlasError: false }); return; }
    if (!id || !this._atlas) return;
    // Sofort schalten: der Regler darf nicht auf das Netz warten. Die Szene
    // rendert Stufe 2 leer, bis die Daten da sind — das ist ein Sekundenbruchteil
    // aus dem Cache und faellt bei Fehlschlag auf Stufe 1 zurueck.
    this.setState({ atlasLevel: level, atlasError: false });
    this._atlas.loadAtlas(id, new URL("./", document.baseURI).href).then((atlas) => {
      if (this.state.active !== id) return;   // inzwischen anderes Projekt offen
      if (!atlas) { this.setState({ atlasLevel: 1, atlas: null, atlasError: true }); return; }
      this.setState({ atlas });
    });
  };
```

- [ ] **Step 4: Beim Projektwechsel zurücksetzen**

Sonst zeigt ein neu geöffnetes Projekt kurz den Atlas des vorigen. Die erste Zeile von `open = (id) => {` (Zeile 707) erweitern:

```js
    // vorher: this.setState({ active: id, tech: false, hist: false });
    this.setState({ active: id, tech: false, hist: false, atlasLevel: 1, atlas: null, atlasError: false });
```

Dasselbe in `close` — beim Schließen des Fensters darf die Bühne nicht herangezoomt stehenbleiben.

- [ ] **Step 5: Regler-Werte in `renderVals` bereitstellen**

Im `renderVals`-Rückgabeobjekt ergänzen (nach `activeSummary`):

```js
      atlasAvailable: Boolean(
        this.state.atlasIndex && activeP && this._atlas?.hasAtlas(this.state.atlasIndex, activeP.id)
      ),
      atlasLevel: this.state.atlasLevel,
      atlasMaxLevel: this.state.w < 760 ? 2 : 3,
      atlasLevelLabel: ["", "Projekt", "Struktur", "Code"][this.state.atlasLevel] || "Projekt",
      atlasHint: this.state.atlasError
        ? "Architekturdaten gerade nicht verfügbar"
        : "Graph-Extraktion: Understand-Anything (MIT) · Reduktion und Darstellung: eigene Pipeline",
      setAtlasLevelFromInput: (e) => this.setAtlasLevel(Number(e.target.value)),
```

- [ ] **Step 6: Regler-Markup einfügen**

Im Projektfenster-Block, direkt nach dem `isProject`-Abschnitt mit der Tech-Liste (ca. Zeile 302-315). `<input type="range">` statt eigener Buttons, weil damit Tastaturbedienung (Pfeiltasten, Home/End) und Screenreader-Semantik ohne Zusatzcode funktionieren:

```html
            <sc-if value="{{ atlasAvailable }}" hint-placeholder-val="{{ true }}">
              <div style="margin:0 0 22px;padding:14px 16px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(160,140,230,.16)">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
                  <span style="font:600 10px/1 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:#8a86a8">Tiefe</span>
                  <span style="font:500 11.5px/1 'Space Grotesk',sans-serif;color:{{ activeAccent }}">{{ atlasLevelLabel }}</span>
                </div>
                <input type="range" min="1" max="{{ atlasMaxLevel }}" step="1" value="{{ atlasLevel }}"
                       onInput="{{ setAtlasLevelFromInput }}" aria-label="Detailtiefe der Architekturansicht"
                       style="width:100%;accent-color:#b48cf5;cursor:pointer">
                <div style="margin-top:8px;font:400 10px/1.4 'JetBrains Mono',monospace;color:#6f6a92">{{ atlasHint }}</div>
              </div>
            </sc-if>
```

- [ ] **Step 7: Im Browser prüfen**

```bash
python -m http.server 8000
```

Dann `http://localhost:8000/` öffnen, **hart neu laden (Ctrl+Shift+R)** — der Dev-Server sendet keine Cache-Header und zeigt sonst alte Dateien.

Zu prüfen:
- Regler erscheint bei `sql-agent` (hat einen Atlas aus Task 4), erscheint **nicht** bei Projekten ohne Atlas.
- Regler lässt sich mit den Pfeiltasten bedienen, wenn er fokussiert ist.
- Beschriftung wechselt „Projekt → Struktur → Code".
- Attributionszeile ist sichtbar.
- Bei 375 px Breite geht der Regler nur bis „Struktur".
- Anderes Projekt öffnen: Regler steht wieder auf „Projekt".
- Die Szene verändert sich noch **nicht** — das ist in dieser Task korrekt.

- [ ] **Step 8: Tests laufen lassen und committen**

```bash
npm test
git add index.html
git commit -m "Atlas: Tiefen-Regler im Projektfenster inklusive Attribution"
```

---

### Task 8: Szenen-Rendering und Kamerafahrt

**Files:**
- Modify: `index.html` — `layout(D)` (Zeile 796-876), `stageTransform()` (691-696), `renderVals` (878-990), SVG-Block der Szene (~120-180)

**Interfaces:**
- Consumes: `this.state.atlas` / `this.state.atlasLevel` (Task 7), `computeAtlasLayout` (Task 5).
- Produces: nichts für spätere Tasks.

**Achtung Namen:** Die Layout-Methode heißt `layout(D)` (Zeile 796), **nicht** `computeLayout`. Aufgerufen wird sie in `renderVals` Zeile 909 als `const { nodes, edges, rings, focusId } = this.layout(D);`.

- [ ] **Step 1: `atlas-layout.js` importieren**

In `componentDidMount`, beim Atlas-Import aus Task 7 mitladen (der Template-Block ist ein einziger Scope — späte `const` landen in der temporalen Todeszone, deshalb hier und nicht weiter unten):

```js
    import(modUrl("atlas-layout.js")).then((m) => { this._atlasLayout = m; }).catch(() => {});
```

- [ ] **Step 2: Atlas-Geometrie in `layout(D)` anhängen**

Am Ende von `layout(D)`, direkt **vor** `return { nodes, edges, rings, focusId };` (Zeile 875). Der bestehende Rückgabewert wird erweitert, nicht ersetzt — die Hauptszene bleibt vollständig gerendert und dimmt nur:

```js
    // --- Code Atlas -------------------------------------------------------
    // Die Layer-/Modulringe liegen um den AKTIVEN Planeten, nicht um die Sonne.
    // Die Hauptszene bleibt gerendert und dimmt lediglich staerker ab — der
    // Besucher soll sehen, wo im System er sich befindet.
    // _atlasHost merkt sich den Planeten fuer stageTransform()/stageOrigin():
    // die Kamera skaliert um genau diesen Punkt.
    let atlasRings = [], atlasNodes = [], atlasEdges = [];
    this._atlasHost = null;
    if (this.state.atlasLevel > 1 && this.state.atlas && this._atlasLayout) {
      const host = nodes.find((n) => n.p && n.p.id === this.state.active);
      if (host) {
        this._atlasHost = host;
        const out = this._atlasLayout.computeAtlasLayout(this.state.atlas, {
          level: this.state.atlasLevel, cx: host.x, cy: host.y, w, h
        });
        atlasRings = out.rings; atlasNodes = out.nodes; atlasEdges = out.edges;
      }
    }
    return { nodes, edges, rings, focusId, atlasRings, atlasNodes, atlasEdges };
```

- [ ] **Step 3: Kamerafahrt — Skalierungsursprung auf den Planeten**

Das ist Ansatz A aus der Spec, und es braucht **keine** eigene Animations-Engine: der Planet bleibt stehen, während die Szene um ihn herum wächst. `stageTransform()` (Zeile 691-696) ersetzen und `stageOrigin()` daneben ergänzen:

```js
  stageTransform() {
    const D = this.state.D, act = this.state.active;
    const focused = !!act && act !== D?.TERM_ID;
    const shift = act && act !== D?.TERM_ID ? -Math.min(230, this.state.w * 0.16) : 0;
    // Im Atlas-Modus zusaetzlich heranfahren. Zusammen mit stageOrigin() ergibt
    // das die "Kamerafahrt": skaliert wird um den Planeten, nicht um die Mitte.
    const atlasBoost = this.state.atlasLevel > 1 && this._atlasHost ? 1.35 : 1;
    const scale = (focused ? this._zoom * 1.25 : this._zoom) * atlasBoost;
    return `translateX(${shift}px) scale(${scale.toFixed(3)})`;
  }
  stageOrigin() {
    const host = this._atlasHost;
    return this.state.atlasLevel > 1 && host
      ? `${host.x.toFixed(0)}px ${host.y.toFixed(0)}px`
      : "50% 50%";
  }
```

- [ ] **Step 4: Bestehende Szene stärker dimmen, wenn der Atlas an ist**

Die Ring-Deckkraft in `layout(D)` (Zeile 840) und die Kanten-Deckkraft (Zeile 873) berücksichtigen bisher nur `this.state.active`. Beide um die Atlas-Stufe erweitern:

```js
        // Zeile 840, Ring-Opacity:
        rings.push({ cx: ox, cy: oy, rx, ry, color: D.CLUSTERS[c].color,
          opacity: this.state.atlasLevel > 1 ? 0.04 : this.state.active ? 0.09 : 0.22 });
```

```js
      // Zeile 872-873, Kanten:
      const dim = focusId && focusId !== (n.p ? n.p.id : "center");
      const atlasDim = this.state.atlasLevel > 1;
      edges.push({ d, color: hexA(color, atlasDim ? 0.03 : dim ? 0.07 : 0.2), flowColor: color,
        flowOpacity: atlasDim || dim ? 0 : 0.85, delay: `${(i * 0.62).toFixed(2)}s` });
```

- [ ] **Step 5: Layout-Werte in `renderVals` aufbereiten**

Zeile 909 erweitern, damit die drei neuen Listen ankommen:

```js
    const { nodes, edges, rings, focusId, atlasRings, atlasNodes, atlasEdges } = this.layout(D);
```

Direkt danach die Darstellungsfelder berechnen. Modulknoten sind bewusst **keine** Planeten — kleine einfarbige Punkte ohne Bild, sonst liest man die Atlas-Ebene als „noch mehr Projekte". Der Sammelknoten ist gestrichelt und hohl:

```js
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const atlasNodeVals = (atlasNodes ?? []).map((n) => ({
      x: n.x, y: n.y, label: n.label,
      radius: n.more ? 5 : 4.5,
      fill: n.more ? "transparent" : "#b48cf5",
      dash: n.more ? "2 3" : "none",
      labelY: n.y + 15,
      // Der Sammelknoten "+N weitere" ist bewusst nicht interaktiv: er steht
      // fuer weggekappte Module, zu denen es nichts anzuzeigen gibt.
      cursor: n.more ? "default" : "pointer",
      onEnter: n.more ? () => {} : () => this.setState({ atlasHover: n.summary || n.label }),
      onLeave: n.more ? () => {} : () => this.setState({ atlasHover: null })
    }));
```

Dafür `atlasHover: null` in die `state`-Initialisierung aus Task 7 aufnehmen.

Der Hinweistext der Szene (`tipText`, Zeile ~998) zeigt bisher die Summary des gehoverten Planeten. Im Atlas-Modus hat die Modul-Summary Vorrang — ein Modul ist das Spezifischere:

```js
      tipText: this.state.atlasHover || (hoverP ? hoverP.summary : ""),
```

Und im Rückgabeobjekt (Zeile 985-986, neben `nodes: nodeVals, edges, rings`) ergänzen:

```js
      atlasRings: atlasRings ?? [], atlasEdges: atlasEdges ?? [], atlasNodes: atlasNodeVals,
      atlasTransition: reduceMotion ? "none" : "opacity .5s cubic-bezier(.22,1,.3,1)",
```

- [ ] **Step 6: `transform-origin` in den Bühnen-Stil aufnehmen**

`sceneTransform` in Zeile 988 ersetzen. Unter reduzierter Bewegung entfällt die Transition ganz — dann ist der Stufenwechsel ein harter Schnitt, wie von der Spec verlangt:

```js
      sceneTransform: `position:absolute;inset:0;will-change:transform;transition:${
        reduceMotion ? "none" : "transform .42s cubic-bezier(.22,1,.3,1), transform-origin .42s cubic-bezier(.22,1,.3,1)"
      };transform-origin:${this.stageOrigin()};transform:${this.stageTransform()}`,
```

Die Transition war vorher `transform .16s ease-out` — für den Mausrad-Zoom richtig, für eine Kamerafahrt zu hektisch. 0.42 s mit derselben Kurve, die das Repo schon für aufklappende Bereiche benutzt.

- [ ] **Step 7: SVG-Rendering ergänzen**

Im SVG-Block der Szene, **nach** den bestehenden Ellipsen (Zeile 127) und vor den Projektknoten einfügen. Die Reihenfolge im SVG ist die Stapelreihenfolge: Ringe hinten, Kanten darüber, Knoten vorn.

```html
        <sc-for list="{{ atlasRings }}" as="ar" hint-placeholder-count="3">
          <ellipse cx="{{ ar.cx }}" cy="{{ ar.cy }}" rx="{{ ar.rx }}" ry="{{ ar.ry }}" fill="none"
                   stroke="#b48cf5" stroke-width="1" stroke-dasharray="3 6" opacity=".34"
                   style="transition:{{ atlasTransition }}"></ellipse>
        </sc-for>
        <sc-for list="{{ atlasEdges }}" as="ae" hint-placeholder-count="4">
          <path d="{{ ae.d }}" fill="none" stroke="#b48cf5" stroke-width="1" opacity=".22"></path>
        </sc-for>
        <sc-for list="{{ atlasNodes }}" as="an" hint-placeholder-count="8">
          <g style="transition:{{ atlasTransition }};cursor:{{ an.cursor }}"
             onMouseEnter="{{ an.onEnter }}" onMouseLeave="{{ an.onLeave }}">
            <circle cx="{{ an.x }}" cy="{{ an.y }}" r="{{ an.radius }}"
                    fill="{{ an.fill }}" stroke="#b48cf5" stroke-width="1"
                    stroke-dasharray="{{ an.dash }}"></circle>
            <text x="{{ an.x }}" y="{{ an.labelY }}" text-anchor="middle"
                  style="font:500 9px/1 'JetBrains Mono',monospace;fill:#8a86a8">{{ an.label }}</text>
          </g>
        </sc-for>
```

- [ ] **Step 8: Tests laufen lassen**

```bash
npm test
```

Erwartet: PASS — die bestehenden Tests plus alle neuen. `computeAtlasLayout` ist bereits aus Task 5 abgedeckt; hier wird nur sichergestellt, dass nichts zerbrochen ist.

- [ ] **Step 9: Im Browser verifizieren — der eigentliche Prüfpunkt**

```bash
python -m http.server 8000
```

Hart neu laden (Ctrl+Shift+R). Bei **1280 px** prüfen:
- `sql-agent` öffnen, Regler auf „Struktur": Ringe erscheinen **um den Planeten**, nicht um die Sonne.
- **Kamerafahrt:** die Szene fährt heran und der Planet bleibt dabei visuell stehen (er ist der Skalierungsursprung). Wandert stattdessen die Mitte, ist `stageOrigin()` nicht wirksam — dann prüfen, ob `transform-origin` tatsächlich im `sceneTransform`-String steht.
- Regler auf „Code": Modulpunkte auf den Ringen, Kanten dazwischen, Beschriftungen lesbar.
- Hover über einem Modulpunkt zeigt dessen Summary in der Hinweiszeile der Szene; der Sammelknoten „+N weitere" reagiert nicht und zeigt keinen Zeigefinger.
- Restliche Szene dimmt spürbar ab, bleibt aber sichtbar.
- Regler zurück auf „Projekt": Kamera fährt zurück, alles kehrt in den Ausgangszustand zurück.
- `Esc` und Fenster schließen führen ebenfalls sauber zurück — insbesondere darf die Bühne nicht herangezoomt stehenbleiben.
- Mausrad-Zoom funktioniert weiterhin, auch im Atlas-Modus.

Bei **375 px** prüfen:
- Regler geht nur bis „Struktur".
- **Keine Planeten fallen auf die Sonne** (das ist die dokumentierte Falle 3 — wenn das passiert, ist ein Radius negativ geworden).

Mit **`prefers-reduced-motion: reduce`** (DevTools → Rendering → Emulate CSS media feature) prüfen:
- Stufenwechsel ist ein harter Schnitt, keine Kamerafahrt, kein Überblenden.

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "Atlas: Layer- und Modulringe rendern um den aktiven Planeten"
```

---

### Task 9: Pilot vervollständigen, dokumentieren, Sprache entscheiden

**Files:**
- Create: `data/atlas/marco-os.json` (über den Generator)
- Create: `tools/atlas-overrides/sql-agent.json` (nur falls die Sprachentscheidung es verlangt)
- Modify: `CLAUDE.md`, `README.md`
- Modify: `data/atlas/index.json` (über den Generator)

**Interfaces:**
- Consumes: alles Vorherige.
- Produces: den fertigen Pilotstand.

- [ ] **Step 1: Zweiten Piloten erzeugen — marco-os analysiert sich selbst**

```bash
cd "c:/Users/Marco/02_Portfolio/marco-os"
```

`/understand` in Claude Code ausführen, dann:

```bash
echo ".ua/" >> .gitignore
node tools/gen-atlas.mjs . marco-os
```

Sollte `marco-os` nicht als id in `data/projects.js` stehen, bricht der Generator mit einer klaren Meldung ab — dann die dort tatsächlich vorhandene id verwenden.

- [ ] **Step 2: Sprachentscheidung treffen**

Die Spec hat diesen Punkt bewusst offen gelassen (Abschnitt „Offener Punkt: Sprache der Summaries"), weil er ohne echte Daten nicht entscheidbar war. Jetzt liegen die Daten vor:

```bash
node -e "const a=require('./data/atlas/sql-agent.json'); console.log(a.layers.map(l=>l.id+' → '+l.label).join('\n')); console.log('---'); console.log(a.modules.slice(0,5).map(m=>m.label+': '+m.summary).join('\n'));"
```

Sind die Layer-Labels englisch oder technisch unschön, die Override-Datei anlegen — das ist Arbeitsannahme „Weg 1" aus der Spec und kommt ohne zusätzliche Abhängigkeit aus:

```bash
mkdir -p tools/atlas-overrides
cat > tools/atlas-overrides/sql-agent.json <<'EOF'
{
  "labels": {
    "ui": "Oberfläche",
    "agent": "Agent-Logik",
    "data": "Datenzugriff"
  }
}
EOF
node tools/gen-atlas.mjs ../sql-copilot sql-agent
```

Die Schlüssel links müssen den tatsächlichen Layer-ids aus der Ausgabe oben entsprechen.

- [ ] **Step 3: Größe gegen die 50-KB-Grenze prüfen**

```bash
ls -l data/atlas/
```

Erwartet: jede Datei unter 50 KB. Darüber: Kappungsgrenzen in `tools/atlas-reduce.mjs` senken, Test in `tests/atlas-reduce.test.js` läuft weiterhin gegen die exportierten Konstanten und muss nicht angepasst werden.

- [ ] **Step 4: `CLAUDE.md` ergänzen**

Neuer Abschnitt nach „Architecture — v3":

```markdown
## Code Atlas (data/atlas/)

Reinzoomen in einen Planeten zeigt die Architektur des jeweiligen Repos:
Stufe 1 Projekt, Stufe 2 Layer-Ringe, Stufe 3 Modulknoten. Der Regler sitzt
im Projektfenster und erscheint nur für Projekte, die in
`data/atlas/index.json` stehen.

Rohdaten kommen von Understand-Anything (Egonex-AI, MIT) — **nur als
Datenquelle, nie als UI**: ihr Viewer ist ein Node-Prozess und auf GitHub
Pages nicht lauffähig. Reduktion und Darstellung sind Eigenleistung.

Atlas für ein Repo neu erzeugen:

```bash
cd ../<repo> && # /understand in Claude Code ausführen
cd ../marco-os && node tools/gen-atlas.mjs ../<repo> <projekt-id>
```

Die `<projekt-id>` muss einer `id` aus `data/projects.js` entsprechen; der
Generator bricht sonst ab. Die `.ua/`-Rohgraphen bleiben in den jeweiligen
Repos und sind dort gitignored — nur die reduzierte Fassung wird committed.

| Datei | Zweck |
| --- | --- |
| `tools/atlas-normalize.mjs` | Adapter aufs fremde Rohschema — die **einzige** Stelle, die bricht, wenn Understand-Anything sein Format ändert |
| `tools/atlas-reduce.mjs` | Kappung (6 Layer, 8 Module/Layer), deterministisch |
| `tools/atlas-overrides/<id>.json` | optional: `pin`/`hide`/`labels` (u.a. deutsche Layer-Namen) |
| `assets/js/atlas-layout.js` | reine Layout-Funktion, DOM-frei, unit-getestet |
| `assets/js/atlas-data.js` | lazy Lader, Fehler immer still → `null` |

Das beobachtete Rohschema steht in
`docs/superpowers/plans/2026-08-05-atlas-rohschema.md`.
```

- [ ] **Step 5: README ergänzen (dritte Attributionsstelle)**

Im Abschnitt Architektur/Tech-Stack aufnehmen:

```markdown
Die Architekturansicht („Code Atlas") nutzt
[Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)
(Egonex-AI, MIT) zur Graph-Extraktion aus den Repos. Reduktions-Pipeline,
Layout und Szenen-Integration sind Eigenleistung.
```

- [ ] **Step 6: Definition of Done abhaken**

Gegen die Spec prüfen — jeder Punkt einzeln, nicht überfliegen:

```bash
npm test                    # (7) alle Tests grün, bestehende 78 plus neue
ls -l data/atlas/           # (3) index.json + zwei Pilot-Atlanten, je < 50 KB
node tools/gen-atlas.mjs ../sql-copilot sql-agent && git diff --stat data/atlas/
                            # (1) Determinismus: kein Diff nach erneutem Lauf
```

Manuell: (4) Regler über alle Stufen hin und zurück, mit Tastatur, bei 375 px und 1280 px verifiziert. (5) `prefers-reduced-motion`. (6) Attribution an allen drei Stellen — Atlas-JSON `source`, Projektfenster, README.

- [ ] **Step 7: Commit**

```bash
git add data/atlas/ tools/atlas-overrides/ CLAUDE.md README.md
git commit -m "Atlas: Pilot fuer sql-copilot und marco-os, Doku und Attribution"
```

- [ ] **Step 8: Rücksprache vor dem eigenen Planeten**

DoD-Punkt 9 der Spec: der eigene `data/projects.js`-Eintrag für „Code Atlas" kommt **erst nach** dieser Rücksprache. Ein Planet für etwas, das noch nicht in echt überzeugt, verletzt Produktprinzip 2. Marco entscheidet anhand des laufenden Piloten, ob der Eintrag kommt und wie er heißt.

---

## Nach der Umsetzung

Was diese Spec bewusst nicht enthält und was als eigenes Backlog-Item folgen kann:

- **Seitenweiter Persona-Schalter (HR/Dev)** — nutzt `atlasLevel` als Voreinstellung (HR = 1, Dev = 3). Braucht zusätzlich zwei Textvarianten je Projekt und ist damit eher Content- als Code-Arbeit.
- **Restliche sieben Repos** — reine Wiederholung von `/understand` plus einem `gen-atlas`-Aufruf, sobald der Pilot überzeugt.
