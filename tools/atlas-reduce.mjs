// Reduziert den normalisierten Graphen auf die Sicht, die die Szene rendern
// kann. Kappung passiert HIER, nicht zur Laufzeit — der Browser soll nie in
// die Lage kommen, 400 Knoten sortieren zu muessen.
// Reine Funktion, kein fs, kein Netz: darum unit-testbar.

export const MAX_LAYERS = 6;
export const MAX_MODULES_PER_LAYER = 8;
const FALLBACK_LAYER = "sonstiges";

// Deterministische Sortierung: Fan-in absteigend, dann Fan-out absteigend,
// dann Pfad alphabetisch, dann id alphabetisch. Ohne die letzte Stufe waere die
// Reihenfolge bei Gleichstand von der Eingabereihenfolge abhaengig und ein
// erneuter Generatorlauf erzeugte grundlos ein Diff. File ist nicht eindeutig
// (mehrere Knoten pro Datei), nur id garantiert Totalordnung.
function byRelevance(fanIn) {
  return (a, b) =>
    (fanIn.get(b.id) ?? 0) - (fanIn.get(a.id) ?? 0) ||
    b.deps.length - a.deps.length ||
    (a.file || a.id).localeCompare(b.file || b.id) ||
    a.id.localeCompare(b.id);
}

// Nach der Kappung koennen zwei ausgewaehlte Module denselben Dateinamen
// tragen (z.B. zwei __init__.py aus verschiedenen Verzeichnissen) und landen
// dann als zwei Punkte mit identischer Beschriftung im selben Layer. Das laesst
// sich erst HIER erkennen: erst nach der Kappung steht fest, welche Module
// tatsaechlich nebeneinander in einem gerenderten Layer sitzen. Dasselbe Label
// in zwei VERSCHIEDENEN Layern ist dagegen kein Problem und bleibt unberuehrt,
// weil diese Funktion nur je eine layer-lokale chosen-Liste bekommt.
function disambiguateLabels(chosen) {
  const byLabel = new Map();
  for (const n of chosen) {
    if (!byLabel.has(n.label)) byLabel.set(n.label, []);
    byLabel.get(n.label).push(n);
  }

  for (const group of byLabel.values()) {
    if (group.length < 2) continue;

    const segmentsOf = (n) => (n.file || n.id).split(/[/\\]/).filter(Boolean);
    const maxDepth = Math.max(...group.map((n) => segmentsOf(n).length));

    // Verzeichnisebenen von hinten dazunehmen, bis alle Labels der Gruppe
    // eindeutig sind — funktioniert generisch fuer jede Kollision, nicht nur
    // Zweier-Kollisionen. Terminiert spaetestens beim vollen Pfad.
    let depth = 2;
    let labels = group.map((n) => segmentsOf(n).slice(-depth).join("/"));
    while (new Set(labels).size < labels.length && depth < maxDepth) {
      depth++;
      labels = group.map((n) => segmentsOf(n).slice(-depth).join("/"));
    }
    // In der Praxis unerreichbar (identischer Pfad zweier Knoten), aber falls
    // selbst der volle Pfad nicht eindeutig macht, entscheidet die id.
    if (new Set(labels).size < labels.length) {
      labels = group.map((n, i) => `${labels[i]} (${n.id})`);
    }

    group.forEach((n, i) => { n.label = labels[i]; });
  }
}

export function reduceGraph(nodes, options) {
  const { id, repo, generatedAt, source, overrides = null, layerMeta = [] } = options;
  const pin = new Set(overrides?.pin ?? []);
  const hide = new Set(overrides?.hide ?? []);
  const labels = overrides?.labels ?? {};
  const metaById = new Map(layerMeta.map((l) => [l.id, l]));

  const visible = (nodes ?? []).filter((n) => !hide.has(n.id));

  const fanIn = new Map();
  for (const n of visible) for (const d of n.deps) fanIn.set(d, (fanIn.get(d) ?? 0) + 1);

  const byLayer = new Map();
  for (const n of visible) {
    const key = n.layer || FALLBACK_LAYER;
    if (!byLayer.has(key)) byLayer.set(key, []);
    byLayer.get(key).push(n);
  }

  // Layer-Kappung: die groessten Layer gewinnen, bei Gleichstand alphabetisch.
  const layerKeys = [...byLayer.keys()]
    .sort((a, b) => byLayer.get(b).length - byLayer.get(a).length || a.localeCompare(b))
    .slice(0, MAX_LAYERS);

  const layers = [];
  const modules = [];

  for (const key of layerKeys) {
    const all = byLayer.get(key);
    const sorted = [...all].sort(byRelevance(fanIn));
    // Gepinnte zuerst, dann nach Relevanz auffuellen.
    const pinned = sorted.filter((n) => pin.has(n.id));
    const rest = sorted.filter((n) => !pin.has(n.id));
    const chosen = [...pinned, ...rest].slice(0, MAX_MODULES_PER_LAYER);

    const meta = metaById.get(key);
    layers.push({
      id: key,
      // Reihenfolge: Override schlaegt echten Namen schlaegt Schluessel.
      label: labels[key] ?? meta?.label ?? key,
      summary: meta?.summary ?? chosen[0]?.summary ?? "",
      count: all.length
    });

    // Eigene Objekte statt der Eingabeknoten befuellen: disambiguateLabels
    // darf gleich anschliessend Labels umschreiben, ohne die von aussen
    // hereingereichten nodes zu mutieren — reduceGraph bleibt eine reine
    // Funktion.
    const layerModules = chosen.map((n) => ({
      id: n.id, layerId: key, label: n.label, file: n.file,
      summary: n.summary, deps: n.deps
    }));
    disambiguateLabels(layerModules);
    modules.push(...layerModules);

    const dropped = all.length - chosen.length;
    if (dropped > 0) {
      modules.push({
        id: `${key}__more`, layerId: key, label: `+${dropped} weitere`,
        file: "", summary: "", deps: [], more: true
      });
    }
  }

  // Kanten, deren Ziel weggekappt wurde, entfernen — sonst zeichnet die Szene
  // Linien ins Nichts.
  const kept = new Set(modules.map((m) => m.id));
  for (const m of modules) m.deps = m.deps.filter((d) => kept.has(d));

  return { id, repo, generatedAt, source, layers, modules };
}
