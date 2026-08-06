// Adapter zwischen der .ua/knowledge-graph.json von Understand-Anything und
// unserem stabilen Zwischenformat. Alles, was vom fremden Schema abhaengt,
// steht in DIESER Datei — aendert das Tool sein Format, ist das hier die
// einzige Baustelle.
//
// Das beobachtete Rohschema (Graph-Version 1.0.0) steht in
// docs/superpowers/plans/2026-08-05-atlas-rohschema.md. Es ist nirgends
// offiziell dokumentiert, also ist jenes Dokument die einzige Referenz.
//
// Drei Eigenheiten bestimmen diesen Adapter:
//  1. Knoten haben KEIN layer-Feld. Die Zuordnung steht invertiert in
//     layers[].nodeIds.
//  2. Knoten haben KEIN deps-Feld. Kanten stehen im Top-Level-Array edges[]
//     als { source, target, type, ... }.
//  3. Layer decken nur die Datei-Ebene ab (file/config/document/service),
//     nicht die Funktions- und Klassenknoten.

const LAYER_ID_PREFIX = "layer:";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function str(value) {
  return typeof value === "string" ? value : "";
}

function basename(path) {
  const parts = String(path).split(/[/\\]/);
  return parts[parts.length - 1] || String(path);
}

function stripLayerPrefix(id) {
  return id.startsWith(LAYER_ID_PREFIX) ? id.slice(LAYER_ID_PREFIX.length) : id;
}

// Understand-Anything legt sein eigenes Arbeitsverzeichnis .ua/ INNERHALB des
// gescannten Repos ab (Config, Ignore-Datei, ...). Das sind Artefakte des
// Analyse-Tools, nicht des analysierten Projekts, und duerfen der Szene nicht
// als Projekt-Modul praesentiert werden. .ua/ ist das feste Arbeitsverzeichnis
// des Tools, der Filter gilt also automatisch fuer jedes kuenftige Repo.
function isToolArtifact(filePath) {
  return str(filePath).startsWith(".ua/");
}

export function normalizeGraph(raw) {
  const rawNodes = asArray(raw?.nodes);
  const rawLayers = asArray(raw?.layers);
  const rawEdges = asArray(raw?.edges);

  const nodeById = new Map();
  for (const n of rawNodes) {
    if (n && typeof n === "object" && str(n.id)) nodeById.set(n.id, n);
  }

  // Layer-Zuordnung invertieren. Nur Knoten, die tatsaechlich existieren —
  // ein nodeIds-Eintrag ins Leere darf keinen Geisterknoten erzeugen.
  const layerOfNode = new Map();
  const layers = [];
  for (const l of rawLayers) {
    if (!l || typeof l !== "object" || !str(l.id)) continue;
    const key = stripLayerPrefix(l.id);
    const members = asArray(l.nodeIds).filter((id) => {
      const n = nodeById.get(id);
      return n && !isToolArtifact(n.filePath);
    });
    if (members.length === 0) continue;
    for (const id of members) {
      // Erster Treffer gewinnt: der echte Graph kennt keine Mehrfach-
      // zuordnung, aber darauf verlassen wollen wir uns nicht.
      if (!layerOfNode.has(id)) layerOfNode.set(id, key);
    }
    layers.push({ id: key, label: str(l.name) || key, summary: str(l.description) });
  }

  // Nur Knoten mit Layer behalten — das ist die Datei-Ebene und damit die
  // Granularitaet, die "Modul" in der Spec meint. Die 37 Funktions- und
  // Klassenknoten des Pilot-Graphen liegen in keinem Layer; sie waeren
  // Innenleben einzelner Dateien, keine Architektur, und wuerden die echten
  // Layer-Ringe zahlenmaessig erdruecken. (Frueher stand hier "wuerden sonst
  // den Sammelring fluten" — den Sammelring "sonstiges" gibt es seit der
  // Abschlusspruefung nicht mehr, die Auswahl hier ist der Grund dafuer:
  // aus DIESER Zeile folgt, dass jeder ausgegebene Knoten einen Layer hat.)
  const nodes = [];
  for (const [id, layer] of layerOfNode) {
    const n = nodeById.get(id);
    const file = str(n.filePath);
    nodes.push({
      id,
      label: file ? basename(file) : str(n.name) || id,
      file,
      layer,
      summary: str(n.summary),
      deps: []
    });
  }

  // Kanten am source-Knoten anhaengen. Beide Enden muessen ueberlebt haben,
  // sonst zeigt die Szene auf nichts. Selbstbezuege und Duplikate raus.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of rawEdges) {
    if (!e || typeof e !== "object") continue;
    const from = byId.get(str(e.source));
    const target = str(e.target);
    if (!from || !byId.has(target) || target === from.id) continue;
    if (!from.deps.includes(target)) from.deps.push(target);
  }

  return { nodes, layers };
}
