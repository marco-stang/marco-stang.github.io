import { test } from "node:test";
import assert from "node:assert/strict";
import { reduceGraph, MAX_LAYERS, MAX_MODULES_PER_LAYER, truncateSummary, MAX_SUMMARY_CHARS } from "../tools/atlas-reduce.mjs";

const OPTS = {
  id: "sql-agent",
  repo: "sql-copilot",
  generatedAt: "2026-08-05",
  // graphVersion, nicht version: das ist die Schema-Version des Rohgraphen,
  // nicht die Version von Understand-Anything (Abschlusspruefung 2a).
  source: { tool: "understand-anything", graphVersion: "1.0.0", license: "MIT" }
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

// Abschlusspruefung 3a: der Sammel-Layer "sonstiges" ist raus. Seit dem
// Task-2-Neuschrieb baut normalizeGraph seine Ausgabe aus layerOfNode auf
// und kann keinen layerlosen Knoten mehr liefern — der Fallback war
// unerreichbar, und der einzige Test dafuer deckte ausschliesslich diesen
// toten Pfad ab. Statt eines stillen Ersatzrings bricht reduceGraph jetzt
// laut ab, wenn die Vorbedingung doch einmal verletzt wird.
test("ein Knoten ohne layer ist ein Adapterfehler und bricht laut ab", () => {
  assert.throws(
    () => reduceGraph([{ id: "x", label: "x.py", file: "x.py", layer: "", summary: "", deps: [] }], OPTS),
    /Knoten "x" hat keinen Layer/
  );
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

test("ist deterministisch auch bei identischen Fan-in/deps-Ties auf gemeinsamer Datei", () => {
  // Baue Knoten auf gemeinsamer Datei, die nach Fan-in und deps.length identisch sind.
  // Ohne Tiebreak auf id haengt Sortierung von Input-Reihenfolge ab.
  const shared = [
    { id: "z-leaf", label: "z.py", file: "src/helpers.py", layer: "util", summary: "z", deps: [] },
    { id: "a-leaf", label: "a.py", file: "src/helpers.py", layer: "util", summary: "a", deps: [] },
    { id: "m-leaf", label: "m.py", file: "src/helpers.py", layer: "util", summary: "m", deps: [] },
  ];
  // Gleiche Knoten, unterschiedliche Reihenfolge.
  const order1 = [...shared];
  const order2 = [shared[2], shared[0], shared[1]]; // Permutation

  const atlas1 = reduceGraph(order1, OPTS);
  const atlas2 = reduceGraph(order2, OPTS);

  // Beide muessen identisches JSON erzeugen.
  assert.equal(
    JSON.stringify(atlas1),
    JSON.stringify(atlas2),
    "Atlas muss identisch sein unabhaengig von Input-Reihenfolge bei Ties"
  );
});

test("nutzt Layer-Metadaten fuer Titel und Beschreibung", () => {
  const atlas = reduceGraph(fanIn("agent", 2), {
    ...OPTS,
    layerMeta: [{ id: "agent", label: "Agenten-Kern", summary: "LangGraph-Orchestrierung." }]
  });
  const layer = atlas.layers.find((l) => l.id === "agent");
  assert.equal(layer.label, "Agenten-Kern");
  assert.equal(layer.summary, "LangGraph-Orchestrierung.");
});

test("labels-Override schlaegt die Layer-Metadaten", () => {
  const atlas = reduceGraph(fanIn("agent", 2), {
    ...OPTS,
    layerMeta: [{ id: "agent", label: "Agenten-Kern", summary: "s" }],
    overrides: { labels: { agent: "Eigener Titel" } }
  });
  assert.equal(atlas.layers.find((l) => l.id === "agent").label, "Eigener Titel");
});

// Regressionstests fuer die Label-Disambiguierung (Review-Finding 1): zwei
// __init__.py aus verschiedenen Verzeichnissen im selben Layer duerfen nicht
// als zwei identisch beschriftete Punkte in der Szene landen.

test("zwei gleiche Basenamen im selben Layer werden disambiguiert", () => {
  const nodes = [
    { id: "a", label: "__init__.py", file: "src/__init__.py", layer: "agent", summary: "", deps: [] },
    { id: "b", label: "__init__.py", file: "src/agent/__init__.py", layer: "agent", summary: "", deps: [] }
  ];
  const atlas = reduceGraph(nodes, OPTS);
  const labels = atlas.modules.map((m) => m.label).sort();
  assert.deepEqual(labels, ["agent/__init__.py", "src/__init__.py"]);
});

test("derselbe Basename in VERSCHIEDENEN Layern bleibt unangetastet", () => {
  const nodes = [
    { id: "a", label: "__init__.py", file: "src/__init__.py", layer: "agent", summary: "", deps: [] },
    { id: "b", label: "__init__.py", file: "tests/__init__.py", layer: "test", summary: "", deps: [] }
  ];
  const atlas = reduceGraph(nodes, OPTS);
  const labels = atlas.modules.map((m) => m.label).sort();
  assert.deepEqual(labels, ["__init__.py", "__init__.py"]);
});

test("Dreier-Kollision: alle drei werden eindeutig disambiguiert", () => {
  const nodes = [
    { id: "a", label: "utils.py", file: "src/a/utils.py", layer: "ui", summary: "", deps: [] },
    { id: "b", label: "utils.py", file: "src/b/utils.py", layer: "ui", summary: "", deps: [] },
    { id: "c", label: "utils.py", file: "src/c/utils.py", layer: "ui", summary: "", deps: [] }
  ];
  const atlas = reduceGraph(nodes, OPTS);
  const labels = atlas.modules.map((m) => m.label);
  assert.equal(new Set(labels).size, 3, "alle drei Labels muessen sich unterscheiden");
  assert.deepEqual(labels.slice().sort(), ["a/utils.py", "b/utils.py", "c/utils.py"]);
});

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
