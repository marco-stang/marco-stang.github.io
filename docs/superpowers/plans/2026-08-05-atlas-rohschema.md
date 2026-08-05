# Beobachtetes Rohschema der `.ua/knowledge-graph.json`

Aufgenommen am 2026-08-05 aus `sql-copilot` (Understand-Anything, Graph-Version
`1.0.0`, 26 analysierte Dateien, Git-Stand `676d6f1`).

Understand-Anything dokumentiert dieses Format **nirgends öffentlich** — weder
im README noch in der Feature-Liste. Dieses Dokument ist deshalb die einzige
Referenz für `tools/atlas-normalize.mjs`. Ändert das Tool sein Format, wird
hier nachgezogen und der Adapter angepasst; sonst nichts.

## Top-Level

| Key | Typ | Inhalt |
| --- | --- | --- |
| `version` | string | `"1.0.0"` |
| `project` | object | `name`, `languages`, `frameworks`, `description`, `analyzedAt`, `gitCommitHash` |
| `nodes` | array[63] | Dateien, Funktionen, Klassen, Configs, Dokumente |
| `edges` | array[144] | Beziehungen — **eigenes Array, nicht am Knoten** |
| `layers` | array[6] | Architektur-Layer mit Mitgliederliste |
| `tour` | array[12] | geführte Reihenfolge (hier ungenutzt) |

Nebendateien im `.ua/`-Verzeichnis: `meta.json` (Zeitstempel, Commit-Hash,
Dateizahl), `config.json`, `fingerprints.json` (für inkrementelle Läufe),
`intermediate/`, `.understandignore`.

## `nodes[]`

```json
{
  "id": "function:src/agent/graph.py:_strip_sql",
  "type": "function",
  "name": "_strip_sql",
  "filePath": "src/agent/graph.py",
  "lineRange": [49, 58],
  "summary": "Entfernt Markdown-Codeblock-Zäune aus der LLM-Antwort, falls das Modell die Query trotz Anweisung in ```sql ... ``` verpackt.",
  "tags": ["utility", "sanitization", "llm-output", "parsing"],
  "complexity": "simple"
}
```

Feldvereinigung über alle Knoten: `id`, `type`, `name`, `filePath`, `summary`,
`tags`, `complexity`, `languageNotes`, `lineRange`.

Die `id` trägt ein Typpräfix: `file:<pfad>`, `function:<pfad>:<name>`,
`class:<pfad>:<name>`.

Verteilung von `type`: `file` 14, `function` 35, `class` 2, `config` 6,
`document` 5, `service` 1.

**Es gibt kein `layer`-Feld am Knoten** und **kein `deps`-Feld**. Beides muss
abgeleitet werden — siehe unten. Das ist die wichtigste Abweichung von dem,
was der Implementierungsplan ursprünglich angenommen hatte.

## `layers[]`

```json
{
  "id": "layer:agent",
  "name": "Agenten-Kern",
  "description": "LangGraph-Orchestrierung des Ablaufs get_schema → generate_sql → validate_sql → execute_sql → answer samt Selbstkorrektur-Loop, SQL-Guardrails …",
  "nodeIds": ["file:src/agent/graph.py", "file:src/agent/guardrails.py", …]
}
```

Die Layer-Zugehörigkeit steht **invertiert** in `nodeIds`, nicht am Knoten.

| Layer | Name | Knoten |
| --- | --- | --- |
| `layer:agent` | Agenten-Kern | 7 |
| `layer:infrastructure` | Infrastruktur & Konfiguration | 6 |
| `layer:test` | Tests & Evaluation | 4 |
| `layer:data` | Datenebene | 3 |
| `layer:ui` | Präsentationsebene | 3 |
| `layer:documentation` | Dokumentation | 3 |

Geprüfte Eigenschaften am echten Graphen:

- **Layer decken nur 26 der 63 Knoten ab.** Genau die Datei-Ebene (`file`,
  `config`, `document`, `service`); `function`- und `class`-Knoten tauchen in
  keiner `nodeIds`-Liste auf.
- Keine Mehrfachzuordnung — kein Knoten liegt in zwei Layern.
- Keine verwaisten Verweise — jede `nodeId` existiert auch als Knoten.
- Alle 26 Layer-Knoten haben ein nicht-leeres `filePath` **und** `summary`.
- Größter Layer: 7 Knoten — **unterhalb der Kappungsgrenze von 8**. Für
  `sql-copilot` greift die Modul-Kappung also gar nicht.
- `description` ist ausformulierte Prosa, 163–276 Zeichen.

## `edges[]`

```json
{
  "source": "file:evals/run_evals.py",
  "target": "file:src/agent/graph.py",
  "type": "imports",
  "direction": "forward",
  "weight": 0.7
}
```

Verteilung von `type` über alle 144 Kanten: `contains` 37, `calls` 33,
`exports` 24, `documents` 22, `imports` 13, `configures` 8, `related` 4,
`deploys` 2, `tested_by` 1.

Beschränkt auf Kanten, deren **beide** Enden Layer-Knoten sind, bleiben
**50 Kanten**: `documents` 22, `imports` 13, `configures` 8, `related` 4,
`deploys` 2, `tested_by` 1. `contains`, `calls` und `exports` verschwinden
dabei vollständig — sie verbinden Dateien mit ihren eigenen Funktionen und
sind reine Hierarchie, keine Architektur-Abhängigkeit.

## Sprache

`.ua/config.json` enthält `{"outputLanguage": "de"}`, und **alle** `summary`-,
`name`- und `description`-Texte im Graphen sind tatsächlich deutsch. Das
README listet Deutsch nicht unter den unterstützten Sprachen (nur en, zh,
zh-TW, ja, ko, ru) — es funktioniert trotzdem.

**Damit ist der offene Punkt der Spec erledigt**: es braucht weder einen
Übersetzungsschritt im Generator noch handgesetzte deutsche Layer-Labels in
einer Override-Datei. Die Layer-Namen („Agenten-Kern", „Datenebene",
„Präsentationsebene") sind direkt verwendbar.

## Konsequenzen für `tools/atlas-normalize.mjs`

Der ursprünglich geplante Adapter hätte hier drei Dinge falsch gemacht — alle
still, ohne Fehlermeldung:

1. **Layer:** Er suchte ein `layer`-Feld am Knoten. Das existiert nicht, also
   wären **alle** Knoten im Sammel-Layer `sonstiges` gelandet und die Ansicht
   hätte genau einen Ring gezeigt. → `layers[].nodeIds` invertieren.
2. **Abhängigkeiten:** Er suchte `deps`/`dependencies`/`imports` am Knoten.
   Existiert nicht, also wären **alle** `deps` leer geblieben — keine einzige
   Kante in der Szene, und die Relevanz-Sortierung (Fan-in) hätte auf lauter
   Nullen sortiert, also faktisch alphabetisch. → aus `edges[]` aufbauen.
3. **Knotenauswahl:** Er hätte alle 63 Knoten übernommen. Funktions-Knoten
   ohne Layer hätten den `sonstiges`-Ring geflutet. → nur Knoten behalten, die
   in einem Layer vorkommen; das ist die Datei-Ebene und genau die Granularität,
   die „Modul" in der Spec meint.

Funktions- und Klassen-Granularität (die 37 übrigen Knoten samt `lineRange`)
bleibt bewusst ungenutzt — das wäre eine vierte Tiefenstufe und ist nicht
Teil dieser Spec.
