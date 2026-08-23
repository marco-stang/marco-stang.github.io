# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

DACH recruiters and hiring managers screening candidates for Data Science /
AI / ML Engineer roles. They land on the site to evaluate Marco Stang's
candidacy, primarily by trying a project's live demo directly in the
browser rather than reading claims about it.

## Product Purpose

A portfolio site presented as a fictional operating system ("MARCO.OS"):
the desktop background is a live neural-network graph with Marco as the
central node and each project as a satellite node. Clicking a node opens a
terminal-style window with project details, a live demo link, and a repo
link. Success is a recruiter trying a demo, then contacting Marco or
reaching his résumé/CV.

## Positioning

No classic card-grid fallback — the graph/OS scene *is* the page, not a
skin on a conventional layout. Differentiates from a typical static
portfolio through this interactive scene, and through project write-ups
that include honest technical depth and limitations (e.g. eval failure
patterns, a debugging war story) rather than polished-only claims.

## Operating Context

Browser-based, hosted on GitHub Pages ("Deploy from branch"), no CI
pipeline, no build step, no install. A visit starts with a skippable
boot-line sequence, then reveals the graph scene. Clicking a project node
opens its terminal window (live demo + repo link + description); a
separate moon node opens an "Ask-Marco" chat window (embeds a live
Streamlit chat app that answers questions about the portfolio); the center
node opens a résumé window built from `data/resume.js`.

Since 2026-08-03 the served page is an externally authored redesign ("v3",
`index.html`); the previous front end remains at `index-legacy.html`. Both
read the same content from `data/`. The live demos run on free tiers and
fall asleep after inactivity. Keeping them warm is an external monitor's job
since 2026-08-04: the in-repo scheduled workflow only ran ~5 of its ~39
planned times per day, because GitHub drops free-tier scheduled runs under
load. That workflow now checks the demos daily between 07:00 and 22:00 and
fails when one is asleep. Nothing automated can wake a sleeping app — the
resume endpoint needs a signed-in browser session — so a first visit can
still cost a cold start.

This is the portfolio. Two alternative concepts were explored earlier and
dropped on 2026-08-03; they are no longer maintained or referenced.

## Capabilities and Constraints

- No build tool, bundler, or framework — plain HTML/CSS/vanilla JS (ES
  modules). `package.json` exists only to declare `"type": "module"` and
  the test script.
- All project demos are real, live-deployed applications (Streamlit apps,
  a Terraform-deployed AWS serverless pipeline, a GitHub Pages tool) — no
  placeholder or mocked demos where `status: "live"`.
- All content (project descriptions, CV, UI copy) is German, targeting the
  DACH job market. Not currently localized to English.
- All content lives solely in `data/` (`projects.js`, `resume.js`,
  `tour.js`, `boot.js`) and is shared by both front ends; no CMS or backend.

## Brand Commitments

- "MARCO.OS" fictional-OS framing and the terminal-window aesthetic are
  binding identity decisions — the graph/OS scene is the entire page, with
  a deliberate rejection of a conventional card-grid fallback.
- Identity: Dr.-Ing. Marco Stang, headline "KI-Spezialist & Data
  Scientist" — Dr.-Ing. from KIT/ITIV (dissertation on validating AI
  systems via scenario linkage and metamorphic testing), 10+ years in
  ML/Data Science/generative AI.

## Evidence on Hand

- `data/projects.js`: 11 real projects (SQL Copilot, AI Act Evidence
  Toolkit, Medical Coding Extractor, Ask-Marco Assistant, Chrono24-FAQ-
  Chatbot, Handover Brief Generator, Document Auto-Classifier, Review Risk
  Predictor, Fraud Triage Copilot, Interview Cockpit, Applied ML Course),
  each with a real summary, tags, and (where live) a working demo URL and
  repo URL. Two of them (Chrono24-FAQ-Chatbot, Handover Brief Generator)
  are `status: "no-demo"` with both URLs `null` — the repos are not yet
  public/deployed, and a link a recruiter cannot open is not evidence.
  Several include real, sometimes unflattering metrics (e.g. SQL Copilot:
  8/15 reference questions correct, 0/5 on window functions; Review Risk
  Predictor: ROC-AUC 0.706; Medical Coding Extractor: F1 0.59 vs. 0.48
  baseline; Chrono24 chatbot: off-topic abstention 50 %; Handover Brief
  Generator: fact-coverage 74.7 %).
- `data/resume.js`: real CV content — current role (Solution Architect,
  ILI.DIGITAL AG), the KIT/ITIV doctorate with a Mercedes-Benz industry
  cooperation, skills list, and a downloadable CV PDF at
  `assets/docs/lebenslauf-marco-stang.pdf`.
- No testimonials, customer logos, or pricing exist anywhere on the site.
  Future work must not invent any of these.

## Product Principles

1. The graph/OS scene is the entire experience — no fallback grid, no
   compromise toward a conventional portfolio layout.
2. Every claim on the site is real and checkable (live demo, real repo,
   real metrics), including honest limitations — not polished wins only.
3. Minimize friction to the proof: a recruiter should reach a live,
   running demo in as few clicks as possible, no build step, no install.
4. German-DACH-market voice throughout, written to recruiters and hiring
   managers evaluating AI/Data Science roles specifically.
5. Depth over breadth per project — each node tells one specific technical
   story (a guardrail decision, a debugging journey, an architecture
   trade-off) instead of a generic feature list.

## Accessibility & Inclusion

No formal standard established. The implementation respects
`prefers-reduced-motion` (boot sequence, starfield parallax, the chat
node's live ring), declares `lang="de"`, and carries a single `<h1>` (the
identity panel) as baseline practice.
