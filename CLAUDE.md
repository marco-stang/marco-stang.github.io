# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first: two front ends live in this repo

Since 2026-08-03 the served start page (`index.html`) is the **v3 redesign** —
an externally authored drop-in that renders from `assets/js/dc-support.js`, a
generated mini-React runtime marked "do not edit", driven by
`assets/js/portfolio-data-v3.js` and `assets/js/sky-v3.js`.

The previous front end is untouched at **`index-legacy.html`** and still works
at that URL. Everything in "Architecture" below describes *that* file, not the
current start page. `npm test` also tests the legacy modules only — v3 has no
test coverage.

**All content lives in `data/` and is shared by both front ends.** Nothing is
duplicated any more:

| File | Consumed by |
| --- | --- |
| `data/projects.js` | v3 via `portfolio-data-v3.js` (re-maps `orbitsCenter` → its own `moon`), legacy via `scene.js`/`window-manager.js` |
| `data/resume.js` | v3 (joins `currentStations[].bullets` into one `detail` line), legacy as-is |
| `data/tour.js` | both via `tourWithResumeId(...)` — the résumé step carries `resume: true` instead of an id, because the two front ends use different sentinel values |
| `data/boot.js` | both; the text is shared, the rendering (colors vs. CSS classes, typewriter) stays per front end |

`assets/js/analytics.js` is shared too, so visits and demo-start events are
counted once from one place. Text and ordering throughout are the v3 ones,
because v3 is what's live — reordering `data/projects.js` moves planets on the
live site.

What is still v3-only in `portfolio-data-v3.js`: cluster colors, planet images,
boot line colors and the terminal parser.

So: before editing, decide which of the two front ends you mean.

## What this is

A portfolio site for Marco Stang, presented as a fictional operating system
("MARCO.OS"): the desktop background is a live neural-network graph with Marco as
the central node and each project as a satellite node ("planet"). Clicking a node
opens a terminal-style window with project details. Deliberate decision: no
classic card-grid fallback — the graph/OS scene *is* the page. Core value: a
recruiter can try a project's live demo directly in the browser, without a build
step or install.

**The code is built and working** — this is not a spec-only repo. Original
design/build intent lives in:
- `docs/superpowers/specs/2026-07-28-marco-os-design.md`
- `docs/superpowers/plans/2026-07-28-marco-os-implementation.md` (task-by-task,
  written for `superpowers:subagent-driven-development`)

Later features each have their own spec/plan under `docs/superpowers/specs/` and
`docs/superpowers/plans/` (parallax starfield, graph zoom, boot screen + scene
reveal, etc.) — check the most recent ones there before assuming current
behavior, since individual features have evolved past their original specs
through live tuning.

## Relationship to sibling repos

**This is the portfolio.** Two alternative concepts were explored earlier and
were dropped on 2026-08-03: `stangfolio` (a static card grid) and `stangverse`
(an isometric walkable Phaser world). Their repos may still exist on disk, but
they are not maintained and no longer a reference for anything here. If older
specs under `docs/superpowers/` weigh a decision against them, that framing is
historical.

The `second-brain` chat app (separate repo/Streamlit) is implemented: clicking
the "Ask-Marco Assistant" moon node opens a window embedding
`https://second-brain-projects.streamlit.app/?embed=true` via `<iframe>` — see
`docs/superpowers/specs/2026-07-29-second-brain-chat-window-design.md`. The
"Marco Stang" center node instead opens a résumé window (see `data/resume.js`
and the `RESUME_ID` sentinel below) — these two click targets were swapped
from the chat window's original design.

**Non-obvious gotcha:** there are two distinct "second-brain" things in this
codebase. (a) A real `data/projects.js` project entry with `id: "second-brain"`
— its own planet, its own window. (b) The chat's internal sentinel, which is
deliberately *not* the string `"second-brain"` so it can't collide with (a).
**The two front ends use different sentinel values** — `state.js` has
`SECOND_BRAIN_CHAT_ID = "__second-brain-chat__"`, v3 has `CHAT_ID = "__chat__"`.
That is why `data/tour.js` marks its last step with `resume: true` instead of
an id, and each front end substitutes its own `RESUME_ID` via
`tourWithResumeId()`. Both happen to use `"__resume__"` today, but don't rely
on it. Know all of this before touching sentinels.

In v3 the moon always opens the *chat*, never a project window — `#second-brain`
therefore normalizes to `#ask-marco`.

## Commands

```bash
npm test                     # runs `node --test`, discovers tests/*.test.js — 184 passing
node --check <file>.js       # per-file syntax check
start-local.bat              # Windows: server on :8000 + opens the browser
python -m http.server 8000   # otherwise, then open http://localhost:8000/
```

`node --test tests/` (passing the directory explicitly) does **not** work on
this Node build — use `npm test` or `node --test "tests/*.test.js"` instead.

No build tool, bundler, or framework — plain HTML/CSS/vanilla JS (ES modules).
`package.json` exists only to declare `"type": "module"` and the test script.
Hosting is GitHub Pages ("Deploy from branch"), no CI pipeline. Verify manually
in a browser at 375px and 1280px+ widths — most visual/animation work in this
project is verified via a locally-installed Playwright (installed in a scratch
directory outside the repo, never as a project dependency, to keep the
"no dependencies" principle) rather than automated tests.

**Cache trap:** `python -m http.server` sends no cache-busting headers — hard
refresh (Ctrl+Shift+R) after JS/CSS changes or you'll see stale output.

## Architecture

Everything below `data/` is shared. Everything below `assets/js/` in this
section belongs to **`index-legacy.html`**, not to the live start page — see
the "two front ends" note at the top.

- `data/projects.js` — project data (`id`, `title`, `summary`, `description`,
  `tags`, `demoUrl`, `repoUrl`, `status`, `cluster`, optional `stats` and
  `orbitsCenter`). No position field — layout is computed at runtime, and the
  array order decides where planets land, so reordering moves the live page.
- `data/resume.js`, `data/tour.js`, `data/boot.js` — CV, guided-tour steps,
  ASCII logo and boot lines. All three are read by both front ends.
- `assets/js/state.js` — central state singleton (`activeProjectId`,
  `bootComplete`, `zoomLevel`) with a subscribe/notify pattern. Also exports
  `SECOND_BRAIN_CHAT_ID` and `RESUME_ID`, the sentinel `activeProjectId`
  values for the chat window and the résumé window respectively (see the
  "second-brain" gotcha above), plus `resolveFocusedNodeId`, the single
  source of truth for mapping a sentinel `activeProjectId` to the real
  graph-layout.js node id it should restore focus/zoom to.
- `assets/js/boot.js` — typewriter-style boot-line overlay, skippable by
  click/keypress at any point, respects `prefers-reduced-motion`. The *text*
  comes from `data/boot.js`; this file only decides how it renders. Once it
  finishes, `state.bootComplete` flips and the background overlay fades out
  while the graph scene reveals itself.
- `assets/js/graph-layout.js` — pure function computing node/edge coordinates.
  Projects are grouped by `cluster` (`agentic-ai`/`cloud`/`full-stack`) onto
  their own concentric elliptical orbit around the center node, evenly
  spaced within each ring; `status: "planned"` projects sit further out on
  their own ring via `IDEA_ORBIT_MULTIPLIER`. Viewport-responsive radius.
  No tag/tech-stack nodes in the graph itself anymore — tech stack shows in
  the project window's collapsible list instead. Kept unit-tested and
  DOM-free.
- `assets/js/scene.js` — renders the graph: `.graph-viewport` (gets the
  zoom/pan transform) wraps a `.graph-content` div (a `.graph-orbits` SVG
  layer of per-cluster orbit rings, plus edges + nodes, rebuilt only when
  the focused project or viewport size changes — *not* on every zoom tick,
  to avoid restarting CSS animations). After boot, rings/nodes/edges/
  edge-runner lights reveal themselves in staggered phases (planets → rings
  + lines → runner lights) via CSS transitions gated on an `is-revealed`
  class. Clicking a planet centers/zooms on it and dims the rest (including
  the orbit rings, which all dim together since they aren't tied to one
  project); clicking the background closes the open window.
- `assets/js/starfield.js` — parallax star field (`box-shadow`-based, no
  per-star DOM nodes), lives inside `.graph-viewport` so it zooms/pans with
  the graph. Mouse-reactive parallax only, respects reduced-motion.
- `assets/js/window-manager.js` — renders the single open "terminal window"
  for the active project, the second-brain chat window (an `<iframe>`
  inside a `.window--chat`-modified window) when `activeProjectId ===
  SECOND_BRAIN_CHAT_ID`, or the résumé window (a `.window--resume`-modified
  window built from `data/resume.js`) when `activeProjectId === RESUME_ID`.
- `assets/js/taskbar.js` — real system clock, active-window indicator,
  zoom buttons, rotating static "AI guide" tips (no real LLM behind it).
- `assets/js/focus-target.js` / `assets/js/html-utils.js` — small pure
  helpers (focus-restore decision logic, `escapeHtml`), unit-tested.
- `index-legacy.html` — containers: `#boot-overlay`, `#scene`, `#window-layer`,
  `#taskbar`. (This was `index.html` until the v3 swap on 2026-08-03; the
  current `index.html` is the v3 redesign and shares none of the above.)

## Architecture — v3 (`index.html`, the live page)

v3 is one self-contained HTML file plus three modules. All markup, styling and
component logic live *inside* `index.html`; there is no CSS file for it.

- `assets/js/dc-support.js` — generated mini-React runtime, header says "do not
  edit". It evaluates the `<script type="text\x-dc">` block in `index.html` and
  binds `{{ … }}` templates.
- `assets/js/portfolio-data-v3.js` — v3-only presentation: cluster colors,
  planet images, boot-line colors, terminal parser. Content comes from `data/`.
- `assets/js/sky-v3.js` — one canvas, one rAF loop: nebula, parallax stars,
  shooting stars, and the face constellation on hovering the sun.

**Six traps this runtime has already caused.** All fixed, all easy to
reintroduce:

1. Dynamic `import()` inside the template block resolves relative to
   `dc-support.js`, *not* to the document. Use
   `new URL(name, document.baseURI)`. An absolute `/assets/...` also breaks,
   because Pages serves from the project sub-path `/marco-os/`.
2. `const` helpers used inside `componentDidMount` must be declared before
   their first use — the template block is one scope, so a late `const` lands
   in the temporal dead zone.
3. Layout margins were hardcoded for desktop; below ~760px `maxRx` went
   negative, SVG discarded the ellipses, and every planet collapsed onto the
   sun. Anything geometric needs a narrow-viewport branch (`w < 760`).
4. Mobile chrome is driven by a `@media (max-width: 760px)` block with
   `!important`, because the elements carry inline styles. Classes: `.m-hide`,
   `.m-only`, `.hdr*`, `.hud*`, `.tabs`, `.livering`.
5. `{{ … }}` interpolations always render as an HTML `<span class="sc-interp">`
   — inside a normal element that's invisible, but inside an SVG `<text>` it
   renders *nothing*, because SVG text only paints character data or
   `tspan`/`textPath`. Symptom: the element sits in the DOM with the right
   content, `visibility: visible`, `opacity: 1` — and `getBBox()` still
   reports 0×0. Confirmed by comparing against a real SVG `<text>` built with
   `createElementNS` at the same spot, which rendered 75px wide. Fix used
   here: render such labels as absolutely positioned HTML above the SVG (the
   module labels now do what the planet labels already did), and don't forget
   `pointer-events: none` or the label steals hover from the node underneath.
6. `animation-fill-mode: both` permanently overrides any inline `transform`
   on the same element, because CSS animations sit above inline styles in the
   cascade. The atlas hover box carries `animation: rise .22s ease both`, and
   `@keyframes rise` ends on `to { transform: none }` — that end value sticks
   forever, silently discarding every `transform` declaration on the element.
   In this repo the box's original `translate(-50%,0)` had therefore never
   taken effect; it had been hanging off its left edge instead of centered
   since it was first written. Symptom: the `style` attribute shows the
   correct value, but `getComputedStyle(el).transform` is still the identity
   matrix. Fix: split positioning/transform and animation across two nested
   elements — the animation never touches the outer element's `transform`.

**Analytics is shared.** v3 imports `assets/js/analytics.js` exactly like the
legacy page. Loading it is what *counts* a visit — reading `TOTAL.json` only
displays the number. Forgetting `initAnalytics()` silently freezes the counter
while still showing a plausible figure.

**GitHub activity is lazy.** `fetchActivity(id)` runs when a project window
opens, once per project. Fetching all of them upfront burned the
60-requests-per-hour anonymous limit and left the "letzter Commit" line blank
everywhere.

## Code Atlas (data/atlas/)

Ein Projektfenster mit hinterlegtem Atlas zeigt einen Toggle
("▸ Architektur anzeigen"). Aufgeklappt listet er die Layer des Repos als
eigene Akkordeon-Abschnitte (`▸ <Name> (<Anzahl>)`); ein Klick auf einen Layer
zeigt dessen Module als Karten (Name, gekürzte Summary, ggf. "nutzt: …").
Kein Canvas, keine Kamerafahrt, kein Viewport-Gate mehr — die Liste
funktioniert bei jeder Breite. Ursprünglich (Pilot-Version) war das eine
Ring-Geometrie mit Kamerafahrt und einem dreistufigen Regler; das erwies sich
nach dem Pilot als zu unübersichtlich und wurde durch dieses Redesign
ersetzt (siehe `docs/superpowers/specs/2026-08-06-code-atlas-redesign-design.md`).

Rohdaten kommen von Understand-Anything (Egonex-AI, MIT) — **nur als
Datenquelle, nie als UI**: ihr Viewer ist ein Node-Prozess und auf GitHub
Pages nicht lauffähig. Reduktion und Darstellung sind Eigenleistung.

Bisher ein Pilot: `sql-agent` (Repo `sql-copilot`). Ein zweiter Pilot für
`marco-os` selbst war vorgesehen, ist aber noch nicht umgesetzt — er hängt an
einer Rücksprache mit Marco, weil die dafür nötige `data/projects.js`-id erst
nach dieser Rücksprache entsteht (siehe DoD-Punkt 9 der Spec).

Atlas für ein Repo neu erzeugen:

```bash
cd ../<repo> && # /understand in Claude Code ausführen
cd ../marco-os && node tools/gen-atlas.mjs ../<repo> <projekt-id>
```

Die `<projekt-id>` muss einer `id` aus `data/projects.js` entsprechen; der
Generator bricht sonst ab. Die `.ua/`-Rohgraphen bleiben in den jeweiligen
Repos und sind dort gitignored — nur die reduzierte Fassung wird committed.

| Datei | Zweck |
| --- | --- |
| `tools/gen-atlas.mjs` | CLI-Einstieg: liest `.ua/knowledge-graph.json`, ruft Normalisierung und Reduktion auf, schreibt `data/atlas/<id>.json` und `data/atlas/index.json` |
| `tools/atlas-normalize.mjs` | Adapter aufs fremde Rohschema — die **einzige** Stelle, die bricht, wenn Understand-Anything sein Format ändert |
| `tools/atlas-reduce.mjs` | Kappung (6 Layer, 8 Module/Layer) plus Summary-Kürzung auf den ersten Satz (`truncateSummary`, `MAX_SUMMARY_CHARS = 140`), deterministisch |
| `tools/atlas-overrides/<id>.json` | optional: `pin`/`hide`/`labels` (u.a. deutsche Layer-Namen), `highlights` (redaktioneller Teaser, 1-3 Sätze, vor dem ersten Layer-Klick sichtbar) |
| `assets/js/atlas-data.js` | lazy Lader, Fehler immer still → `null` |

Das beobachtete Rohschema steht in
`docs/superpowers/plans/2026-08-05-atlas-rohschema.md`.

## Working style notes for this repo

- Bigger features go through `superpowers:brainstorming` →
  `superpowers:writing-plans` → `superpowers:subagent-driven-development`
  (spec + plan committed under `docs/superpowers/`). Small visual/timing
  tweaks (animation speed, color, stagger delays) are made directly and
  verified in-browser — no need for the full process for those.
