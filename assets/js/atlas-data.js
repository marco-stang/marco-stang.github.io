// Laedt die Atlas-Dateien lazy nach — erst beim ersten Wechsel auf Stufe 2,
// dann pro Projekt genau einmal. Dasselbe Muster wie github-activity.js und
// aus demselben Grund: die Startseite darf nicht langsamer werden.
//
// Fehlerpfade sind konsequent still und liefern null. Die Szene IST die
// Seite — ein fehlender Atlas darf sie nie kosten.

const cache = new Map();      // projectId -> Atlas
const inFlight = new Map();   // projectId -> Promise
const FETCH_TIMEOUT_MS = 6000;

// Nur fuer Tests.
export function __resetAtlasCache() {
  cache.clear();
  inFlight.clear();
}

// expectedId ist die Projekt-id, fuer die der Atlas geholt wurde. Ist sie
// angegeben, muss der Inhalt sie auch tragen (Abschlusspruefung 2e).
export function isValidAtlas(value, expectedId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (!Array.isArray(value.layers) || !Array.isArray(value.modules)) return false;
  if (!value.layers.every((l) => l && typeof l.id === "string" && typeof l.label === "string")) return false;
  if (!value.modules.every((m) => m && typeof m.id === "string" && typeof m.layerId === "string")) return false;
  // Mindestinhalt. Die Struktur allein reichte bislang: ein Atlas mit
  // layers: [] galt als gueltig, die Kamera flog los, die Hauptszene dimmte
  // auf 0.04 -- und der Besucher sah nichts, ohne jede Meldung. Genau das
  // passiert bei einem Deploy-Zwischenstand mit halb geschriebener Datei.
  // Ein leerer Atlas ist kein gueltiger Atlas, sondern ein Fehlerfall, und
  // gehoert damit in denselben stillen null-Pfad wie ein kaputtes JSON.
  // modules darf leer sein: Stufe 2 zeigt reine Layer-Ringe und ist damit
  // eine ehrliche, vollstaendige Ansicht.
  if (value.layers.length === 0) return false;
  // Ein Atlas, dessen id nicht zum angefragten Projekt gehoert, beschreibt
  // ein anderes Repo. Die Szene wuerde ihn stillschweigend als Architektur
  // dieses Planeten ausgeben -- eine Falschaussage, kein Darstellungsfehler.
  if (typeof expectedId === "string" && expectedId && value.id !== expectedId) return false;
  return true;
}

export function hasAtlas(index, projectId) {
  const entry = index?.projects?.[projectId];
  return Boolean(entry) && Number(entry.layers) > 0;
}

async function fetchJson(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response?.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadAtlasIndex(baseUrl, fetchImpl = globalThis.fetch) {
  const data = await fetchJson(`${baseUrl}data/atlas/index.json`, fetchImpl);
  return data && typeof data === "object" && data.projects ? data : { projects: {} };
}

export async function loadAtlas(projectId, baseUrl, fetchImpl = globalThis.fetch) {
  if (cache.has(projectId)) return cache.get(projectId);
  if (inFlight.has(projectId)) return inFlight.get(projectId);

  const promise = (async () => {
    const data = await fetchJson(`${baseUrl}data/atlas/${projectId}.json`, fetchImpl);
    if (!isValidAtlas(data, projectId)) return null;
    cache.set(projectId, data);
    return data;
  })().finally(() => inFlight.delete(projectId));

  inFlight.set(projectId, promise);
  return promise;
}
