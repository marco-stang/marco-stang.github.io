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
