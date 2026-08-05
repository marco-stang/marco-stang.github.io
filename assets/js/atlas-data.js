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

export function isValidAtlas(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (!Array.isArray(value.layers) || !Array.isArray(value.modules)) return false;
  if (!value.layers.every((l) => l && typeof l.id === "string" && typeof l.label === "string")) return false;
  if (!value.modules.every((m) => m && typeof m.id === "string" && typeof m.layerId === "string")) return false;
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
    if (!isValidAtlas(data)) return null;
    cache.set(projectId, data);
    return data;
  })().finally(() => inFlight.delete(projectId));

  inFlight.set(projectId, promise);
  return promise;
}
