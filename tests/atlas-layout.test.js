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

// Fix-Runde 3 (Task-8-Review): unter NARROW_VIEWPORT bleibt es bei Stufe 1
// (kein Atlas) statt vormals Stufe 2 -- das Projektfenster laesst dort so
// wenig freie Flaeche, dass Ringe ohnehin komplett darunter liegen wuerden.
test("maxLevelFor erlaubt nur Stufe 1 unterhalb von NARROW_VIEWPORT, Stufe 3 ab dort", () => {
  assert.equal(maxLevelFor(NARROW_VIEWPORT - 1), 1);
  assert.equal(maxLevelFor(NARROW_VIEWPORT), 3);
  assert.equal(maxLevelFor(1280), 3);
});

test("Stufe 3 auf schmalem Viewport faellt auf maxLevelFor(w) zurueck (heute Stufe 1)", () => {
  const { nodes, edges } = computeAtlasLayout(ATLAS, { level: 3, cx: 160, cy: 300, w: 375, h: 700 });
  assert.equal(nodes.length, 0);
  assert.equal(edges.length, 0);
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

test("sechs Layer bleiben bei schmalem Viewport visuell unterscheidbar", () => {
  const sixLayers = {
    id: "test", repo: "test", generatedAt: "2026-08-05",
    source: { tool: "test", license: "MIT" },
    layers: [
      { id: "l1", label: "Layer 1", summary: "", count: 1 },
      { id: "l2", label: "Layer 2", summary: "", count: 1 },
      { id: "l3", label: "Layer 3", summary: "", count: 1 },
      { id: "l4", label: "Layer 4", summary: "", count: 1 },
      { id: "l5", label: "Layer 5", summary: "", count: 1 },
      { id: "l6", label: "Layer 6", summary: "", count: 1 }
    ],
    modules: []
  };
  const { rings } = computeAtlasLayout(sixLayers, { level: 2, cx: 160, cy: 300, w: 375, h: 700 });
  assert.equal(rings.length, 6);
  // Alle sechs Radien muessen paarweise verschieden sein und positiv bleiben
  const rxValues = rings.map((r) => r.rx);
  for (let i = 0; i < rxValues.length; i++) {
    assert.ok(rxValues[i] > 0, `ring ${i}: rx=${rxValues[i]} muss positiv sein`);
  }
  const uniqueRx = new Set(rxValues);
  assert.equal(
    uniqueRx.size,
    6,
    `alle sechs rx sollten unterschiedlich sein, aber ${JSON.stringify(rxValues)} hat ${uniqueRx.size} unterschiedliche Werte`
  );
});

// Fix-Runde 2 (Task-8-Review): opts.maxRadius laesst den Aufrufer eine
// zusaetzliche Obergrenze setzen (z.B. "so gross wie die freie Flaeche neben
// dem Projektfenster ist"), ohne dass ein Radius negativ werden oder
// verschwinden darf. Ohne die WIDE-Fixtur waeren die erwarteten Zahlen
// unten nicht nachvollziehbar: 2 Layer, innerRx=74, RING_STEP=46 im breiten
// Viewport, also ist der unbeeinflusste aeusserste Ring bei 74+46=120.

test("maxRadius begrenzt den aeussersten Ring tatsaechlich", () => {
  const unconstrained = computeAtlasLayout(ATLAS, WIDE);
  assert.equal(unconstrained.rings[1].rx, 120, "Vorbedingung: unbeeinflusst waere der aeussere Ring 120");

  const { rings } = computeAtlasLayout(ATLAS, { ...WIDE, maxRadius: 90 });
  assert.equal(rings[1].rx, 90, "der aeusserste Ring muss exakt auf maxRadius geklemmt werden");
  assert.ok(rings[1].rx < unconstrained.rings[1].rx, "maxRadius muss tatsaechlich verkleinern, nicht nur durchreichen");
});

test("ein absurd kleiner maxRadius liefert trotzdem strikt positive, unterscheidbare Radien", () => {
  // 76 = innerRx(74) + 2: der denkbar knappste Wert, der noch ueber der
  // inneren Untergrenze liegt. Kleiner als innerRx ist bewusst nicht
  // getestet -- das aeussere Math.max(innerRx, ...) in computeAtlasLayout
  // garantiert dort weiterhin strikt positive Radien, klemmt aber wie
  // dokumentiert alle Ringe auf denselben Wert (innerRx). Das ist die
  // bewusste Prioritaet "sichtbar, aber gestaucht" vor "negativ/verworfen"
  // und kein Fehler dieses Tests.
  const { rings } = computeAtlasLayout(ATLAS, { ...WIDE, maxRadius: 76 });
  for (const r of rings) assert.ok(r.rx > 0, `rx=${r.rx} muss positiv sein`);
  const uniqueRx = new Set(rings.map((r) => r.rx));
  assert.equal(uniqueRx.size, rings.length, "Radien muessen bei knappem maxRadius unterscheidbar bleiben");
});

test("ohne maxRadius reproduziert computeAtlasLayout exakt das bisherige Ergebnis", () => {
  const withoutOption = computeAtlasLayout(ATLAS, WIDE);
  const withUndefined = computeAtlasLayout(ATLAS, { ...WIDE, maxRadius: undefined });
  assert.deepEqual(withoutOption, withUndefined, "maxRadius: undefined muss sich wie Weglassen verhalten");
  assert.equal(withoutOption.rings[0].rx, 74);
  assert.equal(withoutOption.rings[1].rx, 120);
});
