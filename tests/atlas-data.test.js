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
  assert.equal(isValidAtlas(42), false);
  assert.equal(isValidAtlas([]), false);
  assert.equal(isValidAtlas({ ...GUELTIG, layers: "keine liste" }), false);
  assert.equal(isValidAtlas({ ...GUELTIG, modules: undefined }), false);
  assert.equal(isValidAtlas({ ...GUELTIG, id: 42 }), false);
  assert.equal(isValidAtlas({ ...GUELTIG, layers: [{ label: "ohne id" }] }), false);
  assert.equal(isValidAtlas({ ...GUELTIG, modules: [{ id: "x" }] }), false);
  assert.equal(isValidAtlas({ ...GUELTIG, layers: [null] }), false);
  assert.equal(isValidAtlas({ ...GUELTIG, modules: [null] }), false);
});

// Abschlusspruefung 2e: die Strukturpruefung allein liess Atlanten durch,
// die zwar wohlgeformt, aber inhaltlich unbrauchbar oder schlicht das
// falsche Projekt waren -- die Szene dimmte dann auf 0.04 und zeigte
// nichts, ohne Meldung.
test("ein Atlas ohne Layer ist ungueltig", () => {
  assert.equal(isValidAtlas({ ...GUELTIG, layers: [], modules: [] }), false);
  assert.equal(isValidAtlas({ ...GUELTIG, layers: [] }), false);
});

test("ein Atlas ohne Module bleibt gueltig — Stufe 2 zeigt reine Layer-Ringe", () => {
  assert.equal(isValidAtlas({ ...GUELTIG, modules: [] }), true);
});

test("die id muss zum angefragten Projekt gehoeren", () => {
  assert.equal(isValidAtlas(GUELTIG, "sql-agent"), true);
  assert.equal(isValidAtlas(GUELTIG, "amalea"), false);
  // Ohne erwartete id bleibt die Pruefung wie zuvor rein strukturell.
  assert.equal(isValidAtlas(GUELTIG), true);
  assert.equal(isValidAtlas(GUELTIG, ""), true);
});

test("loadAtlas verwirft einen Atlas, der ein anderes Projekt beschreibt", async () => {
  __resetAtlasCache();
  const fetchImpl = async () => ({ ok: true, json: async () => GUELTIG });
  assert.equal(await loadAtlas("amalea", "https://example.test/", fetchImpl), null);
});

test("loadAtlas verwirft einen inhaltsleeren Atlas", async () => {
  __resetAtlasCache();
  const fetchImpl = async () => ({ ok: true, json: async () => ({ ...GUELTIG, layers: [], modules: [] }) });
  assert.equal(await loadAtlas("sql-agent", "https://example.test/", fetchImpl), null);
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

test("loadAtlas dedupliziert ueberlappende Abrufe", async () => {
  __resetAtlasCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    // Verzoegern, damit beide Aufrufe wirklich ueberlappen
    await new Promise(resolve => setTimeout(resolve, 10));
    return { ok: true, json: async () => GUELTIG };
  };
  const [a, b] = await Promise.all([
    loadAtlas("sql-agent", "https://example.test/", fetchImpl),
    loadAtlas("sql-agent", "https://example.test/", fetchImpl)
  ]);
  assert.equal(calls, 1);
  assert.equal(a.id, "sql-agent");
  assert.equal(b, a);
});

test("loadAtlas vergiftet Cache nicht, wenn der erste Abruf fehlschlaegt", async () => {
  __resetAtlasCache();
  let calls = 0;
  const failingFetch = async () => { calls++; throw new Error("offline"); };
  const successFetch = async () => { calls++; return { ok: true, json: async () => GUELTIG }; };

  // Erster Abruf schlaegt fehl
  const a = await loadAtlas("sql-agent", "https://example.test/", failingFetch);
  assert.equal(a, null);
  assert.equal(calls, 1);

  // Zweiter Abruf mit funktionierendem Fetch sollte erneut versuchen
  const b = await loadAtlas("sql-agent", "https://example.test/", successFetch);
  assert.equal(b.id, "sql-agent");
  assert.equal(calls, 2);
});
