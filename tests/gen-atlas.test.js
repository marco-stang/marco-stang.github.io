// Abschlusspruefung 3d: tools/gen-atlas.mjs hatte keinerlei Testabdeckung,
// obwohl die Spec unter §4 die "unbekannte id" ausdruecklich als Testfall
// nennt und DoD-Punkt 1 einen unit-getesteten Generator verlangt.
//
// Die Datei ist ein CLI-Skript: sie liest process.argv, ruft process.exit(1)
// und schreibt in Dateien. Ein Import wuerde sie beim ersten Zugriff sofort
// ausfuehren und den Testlauf mitbeenden. Darum wird sie hier als echter
// Prozess gestartet und ueber Exit-Code, Meldung und geschriebene Dateien
// geprueft — das ist genau die Schnittstelle, die ein Mensch auch benutzt.
// Keine neue Dependency: node:child_process, node:fs, node:os reichen.
//
// Ausgabe- und Override-Verzeichnis werden per Umgebungsvariable in ein
// temporaeres Verzeichnis ausserhalb des Repos umgelenkt (siehe Kommentar in
// gen-atlas.mjs). Ohne das schriebe jeder Testlauf in das echte
// data/atlas/ und ueberschriebe den Pilot-Atlas.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const GEN_ATLAS = fileURLToPath(new URL("../tools/gen-atlas.mjs", import.meta.url));
const WURZEL = mkdtempSync(join(tmpdir(), "marco-os-gen-atlas-"));

after(() => rmSync(WURZEL, { recursive: true, force: true }));

let lfdNr = 0;
function neuesVerzeichnis(name) {
  const dir = join(WURZEL, `${name}-${lfdNr++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Minimaler Rohgraph im beobachteten Understand-Anything-Schema (siehe
// docs/superpowers/plans/2026-08-05-atlas-rohschema.md): Layer-Zuordnung
// invertiert in layers[].nodeIds, Kanten im Top-Level-Array, kein layer- und
// kein deps-Feld am Knoten. Der function-Knoten liegt bewusst in keinem
// Layer — er muss von der Normalisierung verworfen werden.
function rohgraph(analyzedAt = "2026-03-14T10:00:00.000Z") {
  return {
    version: "1.0.0",
    project: { name: "fixture", analyzedAt },
    nodes: [
      { id: "file:src/app.py", type: "file", name: "app.py", filePath: "src/app.py", summary: "Einstieg" },
      { id: "file:src/agent/graph.py", type: "file", name: "graph.py", filePath: "src/agent/graph.py", summary: "Ablauf" },
      { id: "file:src/agent/tools.py", type: "file", name: "tools.py", filePath: "src/agent/tools.py", summary: "Werkzeuge" },
      { id: "function:src/app.py:main", type: "function", name: "main", filePath: "src/app.py", summary: "ohne Layer" }
    ],
    layers: [
      { id: "layer:ui", name: "Praesentationsebene", description: "Oberflaeche", nodeIds: ["file:src/app.py"] },
      { id: "layer:agent", name: "Agenten-Kern", description: "Ablauflogik", nodeIds: ["file:src/agent/graph.py", "file:src/agent/tools.py"] }
    ],
    edges: [
      { source: "file:src/app.py", target: "file:src/agent/graph.py", type: "imports" },
      { source: "file:src/agent/graph.py", target: "file:src/agent/tools.py", type: "imports" }
    ]
  };
}

function repoMitGraph(graph = rohgraph()) {
  const repo = neuesVerzeichnis("repo");
  mkdirSync(join(repo, ".ua"), { recursive: true });
  writeFileSync(join(repo, ".ua", "knowledge-graph.json"), JSON.stringify(graph));
  return repo;
}

function lauf(repoPfad, projektId, { outDir, overridesDir } = {}) {
  const ergebnis = spawnSync(process.execPath, [GEN_ATLAS, repoPfad, projektId].filter((a) => a !== undefined), {
    encoding: "utf8",
    env: {
      ...process.env,
      MARCO_ATLAS_OUT_DIR: outDir ?? neuesVerzeichnis("out"),
      MARCO_ATLAS_OVERRIDES_DIR: overridesDir ?? neuesVerzeichnis("overrides")
    }
  });
  return { status: ergebnis.status, stdout: ergebnis.stdout ?? "", stderr: ergebnis.stderr ?? "" };
}

const lies = (dir, datei) => JSON.parse(readFileSync(join(dir, datei), "utf8"));

// --- Abbruchbedingungen ---------------------------------------------------

test("bricht bei einer id ab, die nicht in data/projects.js steht", () => {
  const { status, stderr } = lauf(repoMitGraph(), "gibt-es-nicht");
  assert.equal(status, 1, "der Generator muss mit Exit-Code 1 abbrechen");
  assert.match(stderr, /existiert nicht in data\/projects\.js/);
  // Die Meldung muss die gueltigen ids nennen, sonst raet der Aufrufer.
  assert.match(stderr, /sql-agent/);
});

test("bricht ab, wenn die Rohgraph-Datei fehlt", () => {
  const leeresRepo = neuesVerzeichnis("repo-ohne-ua");
  const { status, stderr } = lauf(leeresRepo, "sql-agent");
  assert.equal(status, 1);
  assert.match(stderr, /knowledge-graph\.json/);
  assert.match(stderr, /understand/);
});

test("bricht ohne Argumente mit einem Aufrufhinweis ab", () => {
  const { status, stderr } = lauf(undefined, undefined);
  assert.equal(status, 1);
  assert.match(stderr, /Aufruf: node tools\/gen-atlas\.mjs/);
});

test("die id-Pruefung kommt VOR dem Dateizugriff", () => {
  // Sonst meldet der Generator bei zwei gleichzeitigen Fehlern den
  // unwichtigeren (fehlende Datei) und verschweigt den eigentlichen.
  const { status, stderr } = lauf(neuesVerzeichnis("repo-ohne-ua"), "gibt-es-nicht");
  assert.equal(status, 1);
  assert.match(stderr, /existiert nicht in data\/projects\.js/);
});

// --- Erfolgsfall ----------------------------------------------------------

test("schreibt <id>.json und index.json", () => {
  const outDir = neuesVerzeichnis("out");
  const { status, stdout } = lauf(repoMitGraph(), "sql-agent", { outDir });
  assert.equal(status, 0, "der Lauf muss erfolgreich sein");
  assert.match(stdout, /2 Layer, 3 Module/);

  const atlas = lies(outDir, "sql-agent.json");
  assert.equal(atlas.id, "sql-agent");
  assert.deepEqual(atlas.layers.map((l) => l.id).sort(), ["agent", "ui"]);
  // Der function-Knoten liegt in keinem Layer und darf nicht auftauchen.
  assert.ok(!atlas.modules.some((m) => m.id.startsWith("function:")));
  assert.equal(atlas.source.tool, "understand-anything");
  assert.equal(atlas.source.graphVersion, "1.0.0");

  const index = lies(outDir, "index.json");
  assert.deepEqual(Object.keys(index.projects), ["sql-agent"]);
  assert.equal(index.projects["sql-agent"].layers, 2);
});

test("generatedAt kommt aus project.analyzedAt, nicht aus dem Laufdatum", () => {
  const outDir = neuesVerzeichnis("out");
  lauf(repoMitGraph(rohgraph("2026-03-14T10:00:00.000Z")), "sql-agent", { outDir });
  assert.equal(lies(outDir, "sql-agent.json").generatedAt, "2026-03-14");
  assert.equal(lies(outDir, "index.json").projects["sql-agent"].generatedAt, "2026-03-14");
});

test("zwei Laeufe mit demselben Rohgraphen erzeugen exakt dieselbe Datei", () => {
  const repo = repoMitGraph();
  const a = neuesVerzeichnis("out"), b = neuesVerzeichnis("out");
  lauf(repo, "sql-agent", { outDir: a });
  lauf(repo, "sql-agent", { outDir: b });
  assert.equal(
    readFileSync(join(a, "sql-agent.json"), "utf8"),
    readFileSync(join(b, "sql-agent.json"), "utf8")
  );
});

// --- index.json: Zusammenfuehren und Sortieren ----------------------------

test("index.json fuehrt mehrere Projekte zusammen und sortiert sie alphabetisch", () => {
  const outDir = neuesVerzeichnis("out");
  // Bewusst in umgekehrter alphabetischer Reihenfolge erzeugt: ohne die
  // Sortierung im Generator haengt die Reihenfolge davon ab, in welcher
  // Reihenfolge man die Repos zufaellig verarbeitet hat.
  assert.equal(lauf(repoMitGraph(), "sql-agent", { outDir }).status, 0);
  assert.equal(lauf(repoMitGraph(), "second-brain", { outDir }).status, 0);
  assert.equal(lauf(repoMitGraph(), "amalea", { outDir }).status, 0);

  const index = lies(outDir, "index.json");
  assert.deepEqual(Object.keys(index.projects), ["amalea", "second-brain", "sql-agent"]);
  // Der erste Eintrag darf durch die spaeteren Laeufe nicht verlorengehen.
  assert.equal(index.projects["sql-agent"].layers, 2);
});

test("generatedAt haengt am Projekteintrag, nicht an der Datei", () => {
  const outDir = neuesVerzeichnis("out");
  lauf(repoMitGraph(rohgraph("2026-03-14T10:00:00.000Z")), "sql-agent", { outDir });
  lauf(repoMitGraph(rohgraph("2026-08-05T14:38:04.117Z")), "amalea", { outDir });

  const index = lies(outDir, "index.json");
  assert.equal(index.projects["sql-agent"].generatedAt, "2026-03-14", "der Maerz-Atlas darf nicht umdatiert werden");
  assert.equal(index.projects["amalea"].generatedAt, "2026-08-05");
  assert.equal(index.generatedAt, undefined, "kein globales Datum mehr in der Datei");
});

// --- Override-Datei -------------------------------------------------------

test("laedt tools/atlas-overrides/<id>.json und wendet hide und labels an", () => {
  const outDir = neuesVerzeichnis("out");
  const overridesDir = neuesVerzeichnis("overrides");
  writeFileSync(join(overridesDir, "sql-agent.json"), JSON.stringify({
    hide: ["file:src/agent/tools.py"],
    labels: { ui: "Eigener Titel" }
  }));

  assert.equal(lauf(repoMitGraph(), "sql-agent", { outDir, overridesDir }).status, 0);
  const atlas = lies(outDir, "sql-agent.json");
  assert.ok(!atlas.modules.some((m) => m.id === "file:src/agent/tools.py"), "hide muss greifen");
  assert.equal(atlas.layers.find((l) => l.id === "ui").label, "Eigener Titel", "labels muss greifen");
});

test("ohne Override-Datei laeuft der Generator rein automatisch", () => {
  const outDir = neuesVerzeichnis("out");
  // Leeres Override-Verzeichnis: die Datei existiert nicht, das darf kein
  // Fehler sein.
  assert.equal(lauf(repoMitGraph(), "sql-agent", { outDir }).status, 0);
  const atlas = lies(outDir, "sql-agent.json");
  assert.equal(atlas.modules.length, 3);
  assert.equal(atlas.layers.find((l) => l.id === "ui").label, "Praesentationsebene");
});

test("legt das Ausgabeverzeichnis an, wenn es noch nicht existiert", () => {
  const outDir = join(WURZEL, `neu-${lfdNr++}`, "atlas");
  assert.equal(existsSync(outDir), false);
  assert.equal(lauf(repoMitGraph(), "sql-agent", { outDir }).status, 0);
  assert.equal(existsSync(join(outDir, "sql-agent.json")), true);
});
