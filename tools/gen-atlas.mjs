// Erzeugt data/atlas/<id>.json aus der .ua/knowledge-graph.json eines Repos.
// Aufruf aus dem marco-os-Repo-Root:
//   node tools/gen-atlas.mjs ../sql-copilot sql-agent
// Die <id> MUSS einer id aus data/projects.js entsprechen — sonst faende die
// Szene den Atlas nie, und der Fehler wuerde erst im Browser auffallen.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeGraph } from "./atlas-normalize.mjs";
import { reduceGraph } from "./atlas-reduce.mjs";

const ATLAS_DIR = fileURLToPath(new URL("../data/atlas/", import.meta.url));
const PROJECTS_JS = fileURLToPath(new URL("../data/projects.js", import.meta.url));
const OVERRIDES_DIR = fileURLToPath(new URL("./atlas-overrides/", import.meta.url));

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

const atlas = reduceGraph(nodes, {
  id: projectId,
  repo: repoPath.split(/[/\\]/).filter(Boolean).pop(),
  // Nur das Datum, nicht die Uhrzeit: sonst erzeugt jeder Lauf ein Diff,
  // obwohl sich inhaltlich nichts geaendert hat.
  generatedAt: new Date().toISOString().slice(0, 10),
  source: { tool: "understand-anything", version: raw?.version ?? "unbekannt", license: "MIT" },
  // Echte, deutsche Layer-Namen und -Beschreibungen aus dem Rohgraphen statt
  // aus dem Schluessel erfundener Titel.
  layerMeta: layers,
  overrides
});

mkdirSync(ATLAS_DIR, { recursive: true });
writeFileSync(`${ATLAS_DIR}${projectId}.json`, JSON.stringify(atlas, null, 2) + "\n");

const indexPath = `${ATLAS_DIR}index.json`;
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : { projects: {} };
index.projects[projectId] = {
  repo: atlas.repo,
  layers: atlas.layers.length,
  modules: atlas.modules.filter((m) => !m.more).length
};
index.generatedAt = atlas.generatedAt;
// Schluessel sortieren: sonst haengt die Reihenfolge davon ab, in welcher
// Reihenfolge man die Repos zufaellig verarbeitet hat.
index.projects = Object.fromEntries(Object.entries(index.projects).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");

const kb = (JSON.stringify(atlas).length / 1024).toFixed(1);
console.log(`gen-atlas: ${projectId} — ${atlas.layers.length} Layer, ${atlas.modules.length} Module, ${kb} KB`);
if (kb > 50) console.warn("gen-atlas: WARNUNG — ueber 50 KB, Kappungsgrenzen pruefen.");
