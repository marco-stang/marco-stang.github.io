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
