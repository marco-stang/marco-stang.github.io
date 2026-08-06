// Erzeugt data/atlas/<id>.json aus der .ua/knowledge-graph.json eines Repos.
// Aufruf aus dem marco-os-Repo-Root:
//   node tools/gen-atlas.mjs ../sql-copilot sql-agent
// Die <id> MUSS einer id aus data/projects.js entsprechen — sonst faende die
// Szene den Atlas nie, und der Fehler wuerde erst im Browser auffallen.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeGraph } from "./atlas-normalize.mjs";
import { reduceGraph } from "./atlas-reduce.mjs";

// Ausgabe- und Override-Verzeichnis sind ueber Umgebungsvariablen
// umlenkbar. NUR fuer tests/gen-atlas.test.js gedacht (Vorbild:
// __resetAtlasCache in assets/js/atlas-data.js): der Testlauf startet diese
// CLI als echten Prozess, und ohne die Umlenkung schriebe er dabei in das
// echte data/atlas/ des Repos. Im normalen Gebrauch sind beide Variablen
// nicht gesetzt und es bleibt exakt beim bisherigen Verhalten.
const withSlash = (p) => (p.endsWith("/") || p.endsWith("\\") ? p : `${p}/`);
const ATLAS_DIR = process.env.MARCO_ATLAS_OUT_DIR
  ? withSlash(process.env.MARCO_ATLAS_OUT_DIR)
  : fileURLToPath(new URL("../data/atlas/", import.meta.url));
const OVERRIDES_DIR = process.env.MARCO_ATLAS_OVERRIDES_DIR
  ? withSlash(process.env.MARCO_ATLAS_OVERRIDES_DIR)
  : fileURLToPath(new URL("./atlas-overrides/", import.meta.url));

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
const { nodes, layers } = normalizeGraph(raw);
if (nodes.length === 0) fail("Rohgraph enthaelt keine verwertbaren Knoten — Rohschema pruefen.");

const overridePath = `${OVERRIDES_DIR}${projectId}.json`;
const overrides = existsSync(overridePath) ? JSON.parse(readFileSync(overridePath, "utf8")) : null;

// Datum des Rohgraphen, nicht des Generatorlaufs (Abschlusspruefung 2c).
// new Date() machte den Generator tagesabhaengig statt inhaltsabhaengig:
// derselbe Rohgraph am Folgetag erzeugte ein Diff, obwohl sich nichts
// geaendert hatte -- "deterministisch bis Mitternacht" ist nicht
// deterministisch. project.analyzedAt ist der Zeitstempel der Analyse
// (siehe docs/superpowers/plans/2026-08-05-atlas-rohschema.md) und aendert
// sich genau dann, wenn sich der Inhalt aendern kann.
// Nur das Datum, nicht die Uhrzeit: ein erneuter /understand-Lauf am selben
// Tag soll kein Diff erzeugen, wenn der Graph gleich geblieben ist.
// Rueckfall auf das heutige Datum, falls das Feld fehlt oder kein
// ISO-Datum ist -- das ist der einzige nicht-deterministische Pfad und
// bleibt sichtbar, weil er eine Warnung schreibt.
const analyzedAt = typeof raw?.project?.analyzedAt === "string" ? raw.project.analyzedAt : "";
if (!/^\d{4}-\d{2}-\d{2}/.test(analyzedAt)) {
  console.warn("gen-atlas: WARNUNG — project.analyzedAt fehlt im Rohgraphen, generatedAt faellt auf das heutige Datum zurueck.");
}
const generatedAt = /^\d{4}-\d{2}-\d{2}/.test(analyzedAt)
  ? analyzedAt.slice(0, 10)
  : new Date().toISOString().slice(0, 10);

const atlas = reduceGraph(nodes, {
  id: projectId,
  repo: repoPath.split(/[/\\]/).filter(Boolean).pop(),
  generatedAt,
  // graphVersion, NICHT version (Abschlusspruefung 2a): raw.version ist laut
  // Rohschema-Dokument die Schema-Version des GRAPHEN ("1.0.0"), nicht die
  // Version von Understand-Anything. Neben tool: "understand-anything" las
  // sich ein blosses "version" als Werkzeugversion — eine falsche Angabe an
  // genau der Stelle, die die verbindliche Attribution traegt.
  source: { tool: "understand-anything", graphVersion: raw?.version ?? "unbekannt", license: "MIT" },
  // Echte, deutsche Layer-Namen und -Beschreibungen aus dem Rohgraphen statt
  // aus dem Schluessel erfundener Titel.
  layerMeta: layers,
  overrides
});

mkdirSync(ATLAS_DIR, { recursive: true });
const atlasJson = JSON.stringify(atlas, null, 2) + "\n";
writeFileSync(`${ATLAS_DIR}${projectId}.json`, atlasJson);

const indexPath = `${ATLAS_DIR}index.json`;
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : { projects: {} };
// generatedAt haengt am jeweiligen Projekteintrag, nicht an der Datei
// (Abschlusspruefung 2d): ein Lauf fuer Projekt B hat sonst auch Projekt A
// umdatiert, obwohl dessen Atlas monatealt sein kann.
index.projects[projectId] = {
  repo: atlas.repo,
  layers: atlas.layers.length,
  modules: atlas.modules.filter((m) => !m.more).length,
  generatedAt: atlas.generatedAt
};
// Altbestand aufraeumen: aeltere index.json tragen das Feld noch global.
delete index.generatedAt;
// Schluessel sortieren: sonst haengt die Reihenfolge davon ab, in welcher
// Reihenfolge man die Repos zufaellig verarbeitet hat.
index.projects = Object.fromEntries(Object.entries(index.projects).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

// Dieselbe Zeichenkette messen, die tatsaechlich geschrieben wurde (pretty-
// printed) — sonst unterschaetzt die Pruefung die reale Dateigroesse, gegen
// die die 50-KB-Grenze eigentlich gilt.
const kb = (atlasJson.length / 1024).toFixed(1);
console.log(`gen-atlas: ${projectId} — ${atlas.layers.length} Layer, ${atlas.modules.length} Module, ${kb} KB`);
if (kb > 50) console.warn("gen-atlas: WARNUNG — ueber 50 KB, Kappungsgrenzen pruefen.");
