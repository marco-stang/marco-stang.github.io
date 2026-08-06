// Layout der Atlas-Ansicht: Layer als konzentrische Ellipsen um den aktiven
// Planeten, Module als Punkte darauf. Reine Funktion, DOM-frei, kein Import
// aus dem Template-Block — genau wie graph-layout.js fuer das Legacy-Frontend.
// Der Grund fuer diese Trennung: die Geometrie ist der Teil, der in diesem
// Repo schon einmal die ganze Szene zerlegt hat (negativer Radius unter
// 400 px Breite). Sie muss testbar sein, bevor sie irgendetwas rendert.

// Ab welcher Viewportbreite der Atlas ueberhaupt angeboten wird. Bewusst
// getrennt von der Schmalviewport-Geometrie unten: das sind zwei Fragen
// ("ab wann ist der Atlas sinnvoll" vs. "ab wann wird die Geometrie eng"),
// die bis zur Abschlusspruefung in einer einzigen Konstante NARROW_VIEWPORT
// steckten und darum nur gemeinsam verstellbar waren.
export const ATLAS_MIN_VIEWPORT = 1000;

// Verhaeltnis Hoehe/Breite der Ringe — flacher als ein Kreis, damit sie
// zum breiten Viewport passen und Module uebersichtlich sind.
const ASPECT = 0.72;
// Innerster Ring-Radius: gross genug, um den Planeten in der Mitte samt
// seinem Namensschild nicht zu ueberlagern. In der Mitte des Atlas steht
// IMMER ein Projektplanet, nie die Sonne — der Atlas oeffnet sich in einen
// Planeten hinein (siehe _atlasHost in index.html). Massgeblich ist also
// der groesste Planetenknoten: 52px Durchmesser, dazu der Fokusring bei
// inset -10px und der Glow. (Frueher stand hier "52px Dot + Glow + Marco
// Stang" — der Zentralknoten der Hauptszene. Der ist nie das Zentrum des
// Atlas; der Zahlenwert stimmt trotzdem, weil beide Radien aehnlich sind.)
const INNER_RX = 74;
// Standardabstand zwischen aufeinanderfolgenden Ringen im breiten Viewport:
// reicht fuer Label-Spacing, aber kompakt genug fuer 6 Layers ohne Stauchung.
const RING_STEP = 46;
// Untergrenze fuer den Ringabstand. Sie ist der Grund, warum die Radien
// AUSNAHMSLOS streng monoton wachsen: selbst wenn der Aufrufer einen
// absurd kleinen maxRadius uebergibt, bleiben die Ringe unterscheidbar,
// statt alle auf innerRx zu kollabieren. Der Preis ist, dass der
// aeusserste Ring in genau diesem Ausnahmefall ueber maxRadius
// hinausragen darf — "sichtbar, aber gestaucht" schlaegt "sechs Ringe auf
// einer Linie".
const MIN_RING_STEP = 3;
// Startwinkel je Ring versetzt, damit Module benachbarter Ringe nicht auf
// derselben Speiche uebereinander liegen.
const RING_ANGLE_OFFSET_DEG = 37;

// Fix-Runde 3 (Task-8-Review): unter der Schwelle bleibt es bei Stufe 1
// (kein Atlas) statt Stufe 2 (Ringe ohne Module). Gemessen bei 375px: das
// Projektfenster hat eine feste Mindestbreite von 320px, es bleiben nur 55px
// freie Flaeche — alle sechs Ringe liegen vollstaendig unterm Fenster, es
// gibt dort schlicht nichts zu sehen. Marcos Entscheidung: einen Regler
// anzubieten, der nachweislich nichts bewirkt, ist unehrlich, deshalb
// erscheint er unter dieser Breite in index.html gar nicht erst
// (atlasAvailable verlangt maxLevelFor(w) > 1). Das ueberstimmt bewusst die
// urspruengliche Spec-Regel "unter 760px zwei Stufen".
//
// Abschlusspruefung 1c, Marcos Entscheidung: die Schwelle steigt von 760 auf
// ATLAS_MIN_VIEWPORT (1000). Dieselbe Begruendung, eine Stufe hoeher
// angesetzt. Gemessen bei 780px: Ringradien 74/81/89/96/103/111 — eine
// Spanne von 37 Einheiten fuer sechs Ringe, 24 Modulpunkte mit einem
// engsten Abstand von 10px bei 15px hohen Labels. Das ist kein Atlas mehr,
// das ist ein Klumpen. Bei 900px sind es 15px Abstand, immer noch
// unlesbar. Ein Regler, dessen Ergebnis ein Klumpen ist, ist genauso
// unehrlich wie einer, der gar nichts bewirkt.
export function maxLevelFor(width) {
  return width < ATLAS_MIN_VIEWPORT ? 1 : 3;
}

export function computeAtlasLayout(atlas, opts) {
  const { cx, cy, w, h } = opts;
  const level = Math.min(opts.level, maxLevelFor(w));
  const layers = atlas?.layers ?? [];
  const modules = atlas?.modules ?? [];

  // Abschlusspruefung 3b: der eigene Schmalviewport-Zweig (NARROW_INNER_RX,
  // NARROW_RING_STEP) ist raus. Er stammte aus Falle 3 (unter 760px wurde
  // maxRx negativ und SVG verwarf alle Ellipsen), war aber schon seit
  // Fix-Runde 3 unerreichbar und ist es seit ATLAS_MIN_VIEWPORT = 1000 erst
  // recht. Die Absicherung gegen negative oder ununterscheidbare Radien
  // leisten heute drei andere Dinge, die immer greifen und nicht an einer
  // Breitenschwelle haengen: die Math.max(innerRx, ...)-Klemmung unten,
  // opts.maxRadius und MIN_RING_STEP.
  const innerRx = INNER_RX;

  // Der aeusserste Ring darf den Viewport nicht verlassen. Math.max haelt den
  // Radius auch dann positiv, wenn der Planet dicht am Rand sitzt — ein
  // negatives rx laesst den Browser die Ellipse verwerfen.
  const roomX = Math.max(innerRx, Math.min(cx, w - cx) - 12);
  const roomY = Math.max(innerRx * ASPECT, Math.min(cy, h - cy) - 12);
  // opts.maxRadius (Fix-Runde 2 des Code-Atlas-Reviews): optionale, vom
  // Aufrufer gesetzte zusaetzliche Obergrenze — z.B. "so gross wie die freie
  // Flaeche neben einem Projektfenster ist", damit die Ringe nicht darunter
  // laufen. Rein additiv: ohne die Option (Infinity) verhaelt sich maxRx
  // exakt wie zuvor. Das aeussere Math.max(innerRx, ...) garantiert strikt
  // positive Radien, selbst wenn ein Aufrufer einen unsinnig kleinen
  // maxRadius uebergibt.
  const maxRx = Math.max(innerRx, Math.min(roomX, roomY / ASPECT, opts.maxRadius ?? Infinity));

  // Dynamischer Abstieg zwischen Ringen: passt der feste Abstieg nicht in den
  // verfuegbaren Platz (z.B. sechs Layer bei knapper freier Flaeche), wird er
  // komprimiert — aber nie unter MIN_RING_STEP. Damit sind die Radien
  // ausnahmslos strikt positiv UND streng monoton wachsend; genau diese
  // Garantie hat frueher der Schmalviewport-Zweig vorgetaeuscht und die
  // clamp()-Klemmung auf maxRx wieder kaputtgemacht (alle Ringe fielen bei
  // zu kleinem maxRadius auf denselben Wert zusammen).
  const availableSpan = Math.max(maxRx - innerRx, 0);
  const gapCount = Math.max(layers.length - 1, 1);
  const effectiveStep = Math.max(MIN_RING_STEP, Math.min(RING_STEP, availableSpan / gapCount));

  const rings = layers.map((layer, i) => {
    const rx = innerRx + i * effectiveStep;
    return { cx, cy, rx, ry: rx * ASPECT, label: layer.label, layerId: layer.id, count: layer.count };
  });

  if (level < 3) return { rings, nodes: [], edges: [] };

  const ringById = new Map(rings.map((r) => [r.layerId, r]));
  const nodes = [];

  for (const [ringIndex, layer] of layers.entries()) {
    const ring = ringById.get(layer.id);
    const members = modules.filter((m) => m.layerId === layer.id);
    members.forEach((m, i) => {
      const a =
        (2 * Math.PI * i) / Math.max(members.length, 1) +
        (ringIndex * RING_ANGLE_OFFSET_DEG * Math.PI) / 180;
      nodes.push({
        id: m.id,
        layerId: m.layerId,
        label: m.label,
        summary: m.summary,
        more: m.more === true,
        x: ring.cx + Math.cos(a) * ring.rx,
        y: ring.cy + Math.sin(a) * ring.ry
      });
    });
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = [];
  for (const m of modules) {
    const from = byId.get(m.id);
    if (!from) continue;
    for (const depId of m.deps ?? []) {
      const to = byId.get(depId);
      if (!to) continue;
      // Leicht gebogen, gleiche Formel wie die Kanten der Hauptszene, damit
      // beide Ebenen visuell zusammengehoeren.
      const qx = (from.x + to.x) / 2 + (to.y - from.y) * 0.12;
      const qy = (from.y + to.y) / 2 - (to.x - from.x) * 0.12;
      edges.push({ from: m.id, to: depId, d: `M${from.x} ${from.y} Q${qx} ${qy} ${to.x} ${to.y}` });
    }
  }

  return { rings, nodes, edges };
}
