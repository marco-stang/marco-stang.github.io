const BASE_RADIUS = 170;
const RADIUS_STEP_PER_EXTRA_PROJECT = 20;
const REFERENCE_VIEWPORT = 1280;
const MIN_VIEWPORT_SCALE = 0.58;

// Skill clusters, each its own concentric elliptical orbit around the
// center node. Order determines both which ring sits innermost (first =
// smallest) and the reveal stagger order in scene.js.
const CLUSTER_ORDER = ["agentic-ai", "cloud", "full-stack"];

// rx multiplier per cluster (applied to the shared baseRadius). agentic-ai
// is the largest/most active cluster in the current portfolio, so it sits
// closest to the center; full-stack sits furthest out. Gaps between tiers
// are kept wide (not just proportionally different) so that even at the
// smallest supported viewport scale, one ring's node/label footprint
// doesn't reach into the next ring's territory.
const CLUSTER_RX_MULTIPLIER = {
  "agentic-ai": 0.95,
  cloud: 1.45,
  "full-stack": 2
};

// ry = rx * ELLIPSE_ASPECT — flattens each ring into an ellipse (wider than
// tall) instead of a circle, matching the wide viewport. Kept relatively
// tall (vs. the old 0.55) so the innermost ring still has enough vertical
// clearance around the center node's own dot+label footprint once the
// whole scene is scaled down on narrow viewports.
const ELLIPSE_ASPECT = 0.62;

// Per-ring rotation so no cluster places a node on the vertical axis
// (90deg/270deg, straight above/below the center node, where it would
// collide with the center's own label) and so the clusters' members don't
// all line up on the same radial spokes as each other. With the current
// membership (agentic-ai 5, cloud 1, full-stack 4) the landscape layout
// keeps a 123px minimum node distance, so these values were left alone when
// the portrait ones below were retuned — measure before changing them.
const CLUSTER_ANGLE_OFFSET_DEG = {
  "agentic-ai": 45,
  cloud: 200,
  "full-stack": 0
};

// Applied on top of a project's own cluster ring for status: "planned"
// projects, so they sit visibly further out than their cluster siblings —
// "not built yet" stays legible even though they're still grouped by skill.
const IDEA_ORBIT_MULTIPLIER = 1.2;

// A project with orbitsCenter: true belongs to Marco himself, not a skill
// cluster (currently just second-brain/Ask-Marco Assistant) — it skips the
// cluster-ring system entirely and instead sits on its own small, fixed
// orbit right next to the center node, like a moon. MOON_RADIUS is
// deliberately far inside even the innermost cluster ring (agentic-ai sits
// at ~0.95 * BASE_RADIUS) so it reads as "orbiting Marco", not "a tight
// cluster ring" — but still large enough to clear the center node's own
// 52px dot + glow and its "Marco Stang" label underneath (a smaller radius
// visually collided the moon and its label into Marco's own sphere). A true
// circle (no ELLIPSE_ASPECT flattening) since, unlike the wide cluster
// rings, a single small moon orbit doesn't need to match the viewport's
// aspect ratio.
const MOON_RADIUS = 140;
// -15deg (mostly rightward, barely up) keeps the moon off the agentic-ai
// ring's own spokes, so the moon and its label don't crowd whichever
// agentic-ai planet happens to render nearby. Since the ring grew to five
// members the moon is the tightest landscape pair (123px at 1280px wide) —
// still well clear at a 34px planet size, but it is the number to watch if
// another agentic-ai project is added.
const MOON_ANGLE_OFFSET_DEG = -15;

function viewportScale(viewportSize) {
  if (!viewportSize) return 1;
  return Math.min(1, Math.max(MIN_VIEWPORT_SCALE, viewportSize / REFERENCE_VIEWPORT));
}

// --- Fit-to-viewport (schmale/portrait Viewports, z.B. Smartphones) ---
// Ohne diese Korrektur liefen der äußerste Ring (full-stack, 2x baseRadius)
// und seine Labels auf Handys links/rechts aus dem Bild. Statt die ganze
// Szene uniform zu verkleinern (Labels/Planeten sind CSS-fixiert, nur die
// *Positionen* schrumpfen — uniform würde alles unlesbar stauchen), passiert
// zweierlei, wenn `dimensions` ({ width, height }) übergeben wird:
//  1. rx wird so skaliert, dass der äußerste Ring + Label-Rand in die
//     Viewport-Breite passt (H_FIT_MARGIN je Seite für halbe Label-Breite).
//  2. Auf Portrait-Viewports (height > width) werden die Ellipsen über
//     PORTRAIT_ASPECT_MAX *höher* statt breiter — der Platz ist dort unten,
//     nicht an den Seiten. ry wird zusätzlich gegen die Höhe geclampt.
const H_FIT_MARGIN = 64;
const V_FIT_MARGIN = 90;
const PORTRAIT_ASPECT_MAX = 1.25;
// Untergrenze für den Mond-Orbit auf sehr schmalen Viewports: kleiner, und
// der Mond samt Label klebt im 52px-Dot + Glow + Label des Zentrums.
const MOON_MIN_RADIUS = 72;

// Portrait-Rotation je Cluster. Diese drei Werte und der cloud-Radius unten
// wurden per Rastersuche bestimmt: maximiere den kleinsten Abstand zwischen
// zwei beliebigen Knoten über fünf Portrait-Viewports (360x800, 390x844,
// 414x896, 430x932, 768x1024). Von Hand ist das nicht mehr zu treffen —
// agentic-ai trägt inzwischen fünf Ring-Knoten, und jede Winkeländerung
// verschiebt gleichzeitig fünf Positionen gegen sechs andere.
//
// Kleinster Knotenabstand im Portrait (Planeten sind 34px):
//   9 Projekte, alte Werte (45/135/90, cloud 1.65): 44px
//   11 Projekte, alte Werte:                        35px  <- Regression
//   11 Projekte, diese Werte:                       54px
//
// Wer Projekte hinzufügt oder Cluster umhängt, fährt die Suche neu — die
// Werte gelten für genau diese Knotenverteilung (agentic 5, cloud 1,
// full-stack 4), nicht allgemein.
const CLUSTER_ANGLE_OFFSET_DEG_PORTRAIT = {
  "agentic-ai": 180,
  cloud: 285,
  "full-stack": 135
};

// Portrait-rx-Multiplikatoren: die inneren Ringe rücken relativ weiter nach
// außen (1.25/1.8 statt 0.95/1.45), weil auf schmalen Viewports sonst die
// Labels des innersten Rings mit dem Zentrum (Sonne + "Marco Stang"-Label +
// Mond) kollidieren — der äußerste Ring (2) bestimmt weiterhin den Fit.
const CLUSTER_RX_MULTIPLIER_PORTRAIT = {
  "agentic-ai": 1.25,
  // 1.8 statt 1.65: schiebt den einzelnen Cloud-Knoten weiter vom
  // agentic-Ring weg, der seit den zwei neuen Projekten dichter besetzt ist.
  cloud: 1.8,
  "full-stack": 2
};

// Mond-Winkel im Portrait-Layout: exakt rechts (0deg) — von derselben
// Rastersuche wie die Winkel oben bestätigt (90/180/270 schneiden alle
// schlechter ab). Rechts auf Sonnenhöhe bleibt der freieste Sektor für den
// Mond und sein Label ("Ask-Marco Assistant", auf Mobile zweizeilig).
const MOON_ANGLE_OFFSET_DEG_PORTRAIT = 0;

function fitParams(baseRadius, clustersPresent, hasIdeas, dimensions) {
  const defaults = {
    rxScale: 1,
    aspect: ELLIPSE_ASPECT,
    ryScale: 1,
    angleOffsets: CLUSTER_ANGLE_OFFSET_DEG,
    rxMultipliers: CLUSTER_RX_MULTIPLIER,
    moonAngleDeg: MOON_ANGLE_OFFSET_DEG
  };
  if (!dimensions || !dimensions.width) return defaults;

  const { width, height = 0 } = dimensions;
  const isPortrait = height > width;
  const rxMultipliers = isPortrait ? CLUSTER_RX_MULTIPLIER_PORTRAIT : CLUSTER_RX_MULTIPLIER;
  const maxMultiplier =
    Math.max(...clustersPresent.map((c) => rxMultipliers[c] ?? 1)) * (hasIdeas ? IDEA_ORBIT_MULTIPLIER : 1);
  const maxRx = baseRadius * maxMultiplier;

  const rxScale = Math.min(1, Math.max(0, width / 2 - H_FIT_MARGIN) / maxRx);
  const aspect = isPortrait
    ? Math.min(PORTRAIT_ASPECT_MAX, (ELLIPSE_ASPECT * height) / width)
    : ELLIPSE_ASPECT;
  const maxRy = maxRx * rxScale * aspect;
  const ryScale = height ? Math.min(1, Math.max(0, height / 2 - V_FIT_MARGIN) / maxRy) : 1;

  return {
    rxScale,
    aspect,
    ryScale,
    angleOffsets: isPortrait ? CLUSTER_ANGLE_OFFSET_DEG_PORTRAIT : CLUSTER_ANGLE_OFFSET_DEG,
    rxMultipliers,
    moonAngleDeg: isPortrait ? MOON_ANGLE_OFFSET_DEG_PORTRAIT : MOON_ANGLE_OFFSET_DEG
  };
}

export function computeLayout(projects, viewportSize = null, dimensions = null) {
  const nodes = [{ id: "center", type: "center", x: 0, y: 0 }];
  const edges = [];
  const rings = [];

  const scale = viewportScale(viewportSize);

  const moonProjects = projects.filter((project) => project.orbitsCenter);
  const ringProjects = projects.filter((project) => !project.orbitsCenter);

  const count = ringProjects.length;
  const baseRadius = (BASE_RADIUS + Math.max(0, count - 3) * RADIUS_STEP_PER_EXTRA_PROJECT) * scale;

  const clustersPresent = [...new Set(ringProjects.map((p) => p.cluster).filter((c) => CLUSTER_ORDER.includes(c)))];
  const hasIdeas = ringProjects.some((p) => p.status === "planned");
  const { rxScale, aspect, ryScale, angleOffsets, rxMultipliers, moonAngleDeg } = fitParams(
    baseRadius,
    clustersPresent.length ? clustersPresent : CLUSTER_ORDER,
    hasIdeas,
    dimensions
  );

  // Moons orbit Marco directly on their own small radius, evenly spaced if
  // there's ever more than one — entirely separate from the cluster-ring
  // system below, so they never join a ring or a cluster-colored edge.
  // rxScale schrumpft den Mond-Orbit auf schmalen Viewports mit (sonst läge
  // er plötzlich *außerhalb* des geschrumpften innersten Rings), MOON_MIN_RADIUS
  // verhindert, dass er dabei ins Zentrum kollabiert.
  const moonRadius = Math.max(MOON_MIN_RADIUS, MOON_RADIUS * scale * rxScale);
  const moonAngleOffset = (moonAngleDeg * Math.PI) / 180;
  moonProjects.forEach((project, index) => {
    const angle = (2 * Math.PI * index) / moonProjects.length + moonAngleOffset;
    const x = Math.cos(angle) * moonRadius;
    const y = Math.sin(angle) * moonRadius;

    nodes.push({ id: project.id, type: "project", tier: "moon", x, y });
    edges.push({ from: "center", to: project.id, kind: "moon" });
  });

  const projectsByCluster = new Map();
  for (const project of ringProjects) {
    if (!CLUSTER_ORDER.includes(project.cluster)) {
      console.warn(
        `computeLayout: project "${project.id}" has unrecognized cluster "${project.cluster}" — it will not be rendered as a node.`
      );
    }
    const list = projectsByCluster.get(project.cluster) ?? [];
    list.push(project);
    projectsByCluster.set(project.cluster, list);
  }

  for (const cluster of CLUSTER_ORDER) {
    const clusterProjects = projectsByCluster.get(cluster);
    if (!clusterProjects || clusterProjects.length === 0) continue;

    const rx = baseRadius * rxMultipliers[cluster] * rxScale;
    const ry = rx * aspect * ryScale;
    rings.push({ cluster, rx, ry });

    const angleOffset = (angleOffsets[cluster] * Math.PI) / 180;
    const clusterCount = clusterProjects.length;

    clusterProjects.forEach((project, index) => {
      const angle = (2 * Math.PI * index) / clusterCount + angleOffset;
      const tier = project.status === "planned" ? "idea" : "active";
      const orbitMultiplier = tier === "idea" ? IDEA_ORBIT_MULTIPLIER : 1;
      const x = Math.cos(angle) * rx * orbitMultiplier;
      const y = Math.sin(angle) * ry * orbitMultiplier;

      nodes.push({ id: project.id, type: "project", tier, x, y });
      edges.push({
        from: "center",
        to: project.id,
        kind: tier === "idea" ? "idea" : `cluster-${project.cluster}`
      });
    });
  }

  return { nodes, edges, rings };
}
