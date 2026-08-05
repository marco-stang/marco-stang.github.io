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

test("behaelt genau die Knoten, die in einem Layer vorkommen", () => {
  const { nodes } = normalizeGraph(FIXTURE);
  const inLayer = new Set(FIXTURE.layers.flatMap((l) => l.nodeIds));
  assert.equal(nodes.length, inLayer.size);
  for (const n of nodes) assert.ok(inLayer.has(n.id));
});

test("verwirft Funktions- und Klassenknoten, die in keinem Layer stehen", () => {
  const { nodes } = normalizeGraph(FIXTURE);
  // Die Fixture enthaelt bewusst 4 solche Knoten.
  assert.ok(FIXTURE.nodes.some((n) => n.type === "function"), "Fixture-Annahme");
  assert.ok(!nodes.some((n) => n.id.startsWith("function:")));
  assert.ok(!nodes.some((n) => n.id.startsWith("class:")));
});

test("jeder Knoten traegt einen nicht-leeren Layer aus layers[].nodeIds", () => {
  const { nodes } = normalizeGraph(FIXTURE);
  for (const n of nodes) assert.ok(n.layer.length > 0, `${n.id} ohne Layer`);
});

test("das layer-Praefix wird abgeschnitten", () => {
  const { nodes } = normalizeGraph(FIXTURE);
  assert.ok(nodes.some((n) => n.layer === "agent"));
  assert.ok(!nodes.some((n) => n.layer.startsWith("layer:")));
});

test("liefert Layer-Metadaten mit echtem Namen und Beschreibung", () => {
  const { layers } = normalizeGraph(FIXTURE);
  const agent = layers.find((l) => l.id === "agent");
  assert.ok(agent, "layer:agent muss dabei sein");
  assert.equal(agent.label, "Agenten-Kern");
  assert.ok(agent.summary.length > 50, "Beschreibung ist ausformulierte Prosa");
});

test("deps kommen aus dem edges-Array, nicht vom Knoten", () => {
  const { nodes } = normalizeGraph(FIXTURE);
  const total = nodes.reduce((sum, n) => sum + n.deps.length, 0);
  assert.ok(total > 0, "es muss Abhaengigkeiten geben");
  // Gegenprobe: kein Rohknoten hat ueberhaupt ein deps-Feld.
  assert.ok(FIXTURE.nodes.every((n) => n.deps === undefined));
});

test("deps stehen beim source-Knoten, nicht beim target", () => {
  const { nodes } = normalizeGraph(FIXTURE);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edge = FIXTURE.edges.find((e) => byId.has(e.source) && byId.has(e.target));
  assert.ok(edge, "Fixture-Annahme: mindestens eine Kante zwischen Layer-Knoten");
  assert.ok(byId.get(edge.source).deps.includes(edge.target));
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

test("deps enthalten keine Selbstbezuege und keine Duplikate", () => {
  const { nodes } = normalizeGraph(FIXTURE);
  for (const n of nodes) {
    assert.ok(!n.deps.includes(n.id), `${n.id} zeigt auf sich selbst`);
    assert.equal(new Set(n.deps).size, n.deps.length, `${n.id} hat doppelte deps`);
  }
});

test("label ist der Dateiname ohne Pfad", () => {
  const raw = {
    nodes: [{ id: "file:src/deep/app.py", filePath: "src/deep/app.py" }],
    edges: [],
    layers: [{ id: "layer:ui", name: "UI", description: "d", nodeIds: ["file:src/deep/app.py"] }]
  };
  assert.equal(normalizeGraph(raw).nodes[0].label, "app.py");
});

test("fehlende Felder werden zu leeren Werten, nicht zu undefined", () => {
  const raw = {
    nodes: [{ id: "file:a" }],
    edges: [],
    layers: [{ id: "layer:x", nodeIds: ["file:a"] }]
  };
  const { nodes, layers } = normalizeGraph(raw);
  assert.equal(nodes[0].summary, "");
  assert.equal(nodes[0].file, "");
  assert.deepEqual(nodes[0].deps, []);
  assert.equal(layers[0].label, "x", "ohne name faellt das Label auf die id zurueck");
  assert.equal(layers[0].summary, "");
});

test("Kanten auf verworfene Knoten werden entfernt", () => {
  const raw = {
    nodes: [{ id: "file:a", filePath: "a.py" }, { id: "function:a.py:helper", filePath: "a.py" }],
    edges: [{ source: "file:a", target: "function:a.py:helper", type: "contains" }],
    layers: [{ id: "layer:x", name: "X", description: "d", nodeIds: ["file:a"] }]
  };
  const { nodes } = normalizeGraph(raw);
  assert.equal(nodes.length, 1);
  assert.deepEqual(nodes[0].deps, [], "contains-Kante auf einen verworfenen Knoten faellt weg");
});

test("ein Layer ohne existierende Knoten taucht nicht in layers auf", () => {
  const raw = {
    nodes: [{ id: "file:a", filePath: "a.py" }],
    edges: [],
    layers: [
      { id: "layer:x", name: "X", description: "d", nodeIds: ["file:a"] },
      { id: "layer:leer", name: "Leer", description: "d", nodeIds: ["file:gibtsnicht"] }
    ]
  };
  const { layers } = normalizeGraph(raw);
  assert.deepEqual(layers.map((l) => l.id), ["x"]);
});

test("leerer oder kaputter Rohgraph wirft nicht", () => {
  for (const bad of [null, undefined, {}, { nodes: "kaputt" }, { nodes: [], layers: "kaputt" }, { layers: [{ nodeIds: "kaputt" }] }]) {
    const out = normalizeGraph(bad);
    assert.deepEqual(out.nodes, []);
    assert.deepEqual(out.layers, []);
  }
});

test("ist deterministisch", () => {
  assert.equal(
    JSON.stringify(normalizeGraph(FIXTURE)),
    JSON.stringify(normalizeGraph(FIXTURE))
  );
});

// Regressionstests fuer den .ua/-Filter (Review-Finding 2): Understand-
// Anything legt seine eigenen Arbeitsdateien im gescannten Repo ab. Die
// duerfen nicht als Projekt-Module in der Szene auftauchen.

test("ein Knoten unter .ua/ wird verworfen", () => {
  const raw = {
    nodes: [
      { id: "file:a", filePath: "src/a.py" },
      { id: "file:ua-config", filePath: ".ua/config.json" }
    ],
    edges: [],
    layers: [
      { id: "layer:x", name: "X", description: "d", nodeIds: ["file:a", "file:ua-config"] }
    ]
  };
  const { nodes } = normalizeGraph(raw);
  assert.deepEqual(nodes.map((n) => n.id), ["file:a"]);
});

test("ein Layer, der nur aus .ua/-Knoten besteht, verschwindet komplett statt leer zu werden", () => {
  const raw = {
    nodes: [{ id: "file:ua-ignore", filePath: ".ua/.understandignore" }],
    edges: [],
    layers: [
      { id: "layer:werkzeug", name: "Werkzeug", description: "d", nodeIds: ["file:ua-ignore"] }
    ]
  };
  const { nodes, layers } = normalizeGraph(raw);
  assert.deepEqual(nodes, []);
  assert.deepEqual(layers, []);
});

test("ein normaler Pfad mit der Teilzeichenkette '.ua' in der Mitte wird NICHT verworfen", () => {
  const raw = {
    nodes: [{ id: "file:lua", filePath: "src/lua/thing.py" }],
    edges: [],
    layers: [
      { id: "layer:x", name: "X", description: "d", nodeIds: ["file:lua"] }
    ]
  };
  const { nodes } = normalizeGraph(raw);
  assert.deepEqual(nodes.map((n) => n.id), ["file:lua"]);
});
