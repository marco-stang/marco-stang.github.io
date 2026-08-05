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
