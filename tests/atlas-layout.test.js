import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAtlasLayout, maxLevelFor, ATLAS_MIN_VIEWPORT } from "../assets/js/atlas-layout.js";

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

// Fix-Runde 3 (Task-8-Review): unterhalb der Schwelle bleibt es bei Stufe 1
// (kein Atlas) statt vormals Stufe 2 -- das Projektfenster laesst dort so
// wenig freie Flaeche, dass Ringe ohnehin komplett darunter liegen wuerden.
// Abschlusspruefung 1c: Schwelle von 760 auf ATLAS_MIN_VIEWPORT (1000)
// angehoben, weil die Ringe dazwischen zu einem unlesbaren Klumpen geraten.
test("maxLevelFor erlaubt nur Stufe 1 unterhalb von ATLAS_MIN_VIEWPORT, Stufe 3 ab dort", () => {
  assert.equal(maxLevelFor(ATLAS_MIN_VIEWPORT - 1), 1);
  assert.equal(maxLevelFor(ATLAS_MIN_VIEWPORT), 3);
  assert.equal(maxLevelFor(1280), 3);
});

// Die gemessenen Zwischenbreiten aus Marcos Entscheidung, damit ein
// spaeteres Herunterdrehen der Schwelle nicht unbemerkt durchgeht.
test("die gemessenen Klumpen-Breiten 780 und 900 zeigen keinen Atlas", () => {
  assert.equal(maxLevelFor(780), 1);
  assert.equal(maxLevelFor(900), 1);
  assert.equal(maxLevelFor(999), 1);
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

// Abschlusspruefung 3b: der Schmalviewport-Zweig (NARROW_INNER_RX,
// NARROW_RING_STEP) ist raus — er war unerreichbar, und die drei Tests, die
// ihn abdeckten, blieben gruen, wenn man ihn loeschte. Was heute
// tatsaechlich garantiert wird und hier geprueft gehoert: die Radien sind
// ausnahmslos strikt positiv UND streng monoton wachsend, egal wie eng es
// wird. Diese Garantie leisten Math.max(innerRx, ...), opts.maxRadius und
// MIN_RING_STEP zusammen — ohne jede Breitenschwelle.

const SECHS_LAYER = {
  id: "test", repo: "test", generatedAt: "2026-08-05",
  source: { tool: "test", license: "MIT" },
  layers: Array.from({ length: 6 }, (_, i) => ({
    id: `l${i + 1}`, label: `Layer ${i + 1}`, summary: "", count: 1
  })),
  modules: []
};

function pruefeRadien(rings, erwarteteAnzahl) {
  assert.equal(rings.length, erwarteteAnzahl);
  for (const [i, r] of rings.entries()) {
    assert.ok(r.rx > 0, `Ring ${i}: rx=${r.rx} muss strikt positiv sein`);
    assert.ok(r.ry > 0, `Ring ${i}: ry=${r.ry} muss strikt positiv sein`);
    if (i > 0) {
      assert.ok(
        r.rx > rings[i - 1].rx,
        `Ring ${i}: rx=${r.rx} muss echt groesser sein als rx=${rings[i - 1].rx} des inneren Rings`
      );
      assert.ok(r.ry > rings[i - 1].ry, `Ring ${i}: ry muss echt wachsen`);
    }
  }
}

test("sechs Ringe wachsen streng monoton — auch bei absurd kleinem maxRadius", () => {
  // 1 liegt weit unter innerRx (74): der Extremfall, in dem die alte
  // clamp()-Klemmung alle sechs Ringe auf denselben Radius zusammenfallen
  // liess. MIN_RING_STEP haelt sie jetzt auseinander.
  pruefeRadien(computeAtlasLayout(SECHS_LAYER, { level: 2, cx: 640, cy: 350, w: 1280, h: 700, maxRadius: 1 }).rings, 6);
  pruefeRadien(computeAtlasLayout(SECHS_LAYER, { level: 2, cx: 640, cy: 350, w: 1280, h: 700, maxRadius: 0 }).rings, 6);
  pruefeRadien(computeAtlasLayout(SECHS_LAYER, { level: 2, cx: 640, cy: 350, w: 1280, h: 700, maxRadius: -50 }).rings, 6);
});

test("sechs Ringe wachsen streng monoton — auch in einem winzigen Viewport", () => {
  // Der Fall aus Falle 3: unter 400px Breite wurde maxRx frueher negativ und
  // SVG verwarf saemtliche Ellipsen. Die Klemmung faengt das ohne eigenen
  // Schmalviewport-Zweig ab.
  pruefeRadien(computeAtlasLayout(SECHS_LAYER, { level: 2, cx: 160, cy: 300, w: 320, h: 600 }).rings, 6);
  pruefeRadien(computeAtlasLayout(SECHS_LAYER, { level: 2, cx: 4, cy: 4, w: 8, h: 8 }).rings, 6);
});

test("auch der Planet direkt am Viewportrand liefert wachsende Radien", () => {
  // cx = 0 bzw. cx = w: Math.min(cx, w - cx) wird 0, roomX also negativ,
  // bevor Math.max(innerRx, ...) greift.
  pruefeRadien(computeAtlasLayout(SECHS_LAYER, { level: 2, cx: 0, cy: 0, w: 1280, h: 700 }).rings, 6);
  pruefeRadien(computeAtlasLayout(SECHS_LAYER, { level: 2, cx: 1280, cy: 700, w: 1280, h: 700 }).rings, 6);
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

test("ein absurd kleiner maxRadius liefert trotzdem strikt positive, wachsende Radien", () => {
  // 76 = innerRx(74) + 2: der knappste Wert, der noch ueber der inneren
  // Untergrenze liegt. Abschlusspruefung 3b: Werte UNTER innerRx sind
  // inzwischen ebenfalls abgedeckt (siehe die drei Tests oben) — dort
  // greift MIN_RING_STEP, statt alle Ringe auf innerRx zusammenfallen zu
  // lassen, wie es die alte clamp()-Klemmung tat.
  pruefeRadien(computeAtlasLayout(ATLAS, { ...WIDE, maxRadius: 76 }).rings, 2);
});

test("ohne maxRadius reproduziert computeAtlasLayout exakt das bisherige Ergebnis", () => {
  const withoutOption = computeAtlasLayout(ATLAS, WIDE);
  const withUndefined = computeAtlasLayout(ATLAS, { ...WIDE, maxRadius: undefined });
  assert.deepEqual(withoutOption, withUndefined, "maxRadius: undefined muss sich wie Weglassen verhalten");
  assert.equal(withoutOption.rings[0].rx, 74);
  assert.equal(withoutOption.rings[1].rx, 120);
});
