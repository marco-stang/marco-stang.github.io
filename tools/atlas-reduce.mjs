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

export function reduceGraph(nodes, options) {
  const { id, repo, generatedAt, source, overrides = null } = options;
  const pin = new Set(overrides?.pin ?? []);
  const hide = new Set(overrides?.hide ?? []);
  const labels = overrides?.labels ?? {};

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

    layers.push({
      id: key,
      label: labels[key] ?? key,
      summary: chosen[0]?.summary ?? "",
      count: all.length
    });

    for (const n of chosen) {
      modules.push({
        id: n.id, layerId: key, label: n.label, file: n.file,
        summary: n.summary, deps: n.deps
      });
    }

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
