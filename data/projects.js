// Einzige Quelle der Projektdaten für BEIDE Frontends:
//  - index.html (v3, live) über assets/js/portfolio-data-v3.js
//  - index-legacy.html über assets/js/scene.js & window-manager.js
// Texte und Reihenfolge entsprechen dem v3-Stand, weil der live ist —
// Änderungen hier wirken sich also sofort auf die Startseite aus.
//
// `orbitsCenter: true` heißt: das Projekt umkreist Marco selbst statt einen
// Cluster-Ring (siehe graph-layout.js). portfolio-data-v3.js spiegelt das
// Feld auf seinen eigenen Namen `moon`.
export const projects = [
  {
    id: "sql-agent",
    title: "SQL Copilot",
    summary:
      "Frag die Firmendatenbank einfach in normaler Sprache und du bekommst die " +
      "Antwort. Kein SQL nötig, und der Agent darf ausschließlich lesen, niemals " +
      "verändern.",
    description:
      "Ein LangGraph-Agent arbeitet hier gegen eine echte PostgreSQL-Datenbank mit " +
      "rund 100.000 Olist-Bestellungen: Er erkundet das Schema selbst, hält sich an " +
      "harte Guardrails (Whitelist statt Blacklist, nur lesende SELECT-Queries, " +
      "read-only DB-User) und korrigiert fehlerhafte Queries in einem eigenen Loop. " +
      "Das Spannendste daran: Die Streamlit-Oberfläche zeigt Guardrails und " +
      "Selbstkorrektur offen, statt sie im Code zu verstecken, und ein Live-Button " +
      "provoziert den Korrektur-Loop auf Knopfdruck. Die Evaluation bleibt ehrlich: " +
      "8 von 15 Referenzfragen korrekt, mit klarem Muster nach Schwierigkeit " +
      "(Grundlagen 5/5, Joins und Aggregation 3/5, Window Functions 0/5).",
    tags: ["LangGraph", "LangChain", "Python", "PostgreSQL", "Streamlit"],
    // stats: echte, nachprüfbare Metriken (siehe description) — werden im
    // Projekt-Fenster als eigene Stat-Zeile gerendert. Optionales Feld.
    stats: [
      { value: "8/15", label: "Eval korrekt" },
      { value: "5/5", label: "Grundlagen" },
      { value: "0/5", label: "Window Fns" }
    ],
    demoUrl: "https://sql-copilot-portfolio.streamlit.app/",
    repoUrl: "https://github.com/marco-stang/sql-copilot",
    status: "live",
    cluster: "agentic-ai"
  },
  {
    id: "ai-act-validation-toolkit",
    title: "AI Act Evidence Toolkit",
    shortTitle: "AI Act Toolkit",
    summary:
      "Stuft eine KI-Anwendung nach dem EU AI Act ein und geht dann genau einen " +
      "Schritt weiter als jedes andere Compliance-Tool: Womit belegst du die " +
      "Pflichten technisch?",
    description:
      "Ein deterministischer Regelbaum ordnet den Use-Case einer Risikoklasse nach " +
      "Annex III zu. Das LLM formuliert dabei nur die Begründung und hat auf die " +
      "Einstufung selbst keinen Einfluss, denn nachvollziehbar geht vor elegant. " +
      "Für die technisch belegbaren Pflichten laufen metamorphe Tests gegen drei " +
      "simulierte Systeme, und eine Namensinvarianz-Relation deckt dabei auf, dass " +
      "ein Bewerber-Scoring den Score senkt, sobald man nur den Vornamen tauscht " +
      "(Art. 10, Bias-Prüfung). Wer will, injiziert absichtlich Fehler und sieht in " +
      "einer Kill-Matrix, wie viele davon die Relationsmenge wirklich fängt. Kurz " +
      "gesagt: Marcos Promotionsthema am KIT/ITIV, in eine Anwendung übersetzt, die " +
      "man anklicken kann.",
    tags: ["Python", "LangChain", "Streamlit", "pytest"],
    stats: [
      { value: "2/7", label: "Pflichten technisch belegt" },
      { value: "11/14", label: "Mutanten getötet" }
    ],
    demoUrl: "https://ai-act-validation-toolkit.streamlit.app/",
    repoUrl: "https://github.com/marco-stang/ai-risk-classifier",
    status: "live",
    cluster: "agentic-ai"
  },
  {
    id: "goz-finetune-vs-rag",
    title: "Medical Coding Extractor",
    shortTitle: "Medical Coding",
    summary:
      "Zieht Abrechnungsziffern aus zahnärztlichen Behandlungsnotizen und klärt " +
      "nebenbei die Frage, die viele Teams nur behaupten: Finetuning oder RAG, was " +
      "gewinnt hier wirklich?",
    description:
      "Ein per LoRA feingetuntes Llama-3.2-3B-Instruct extrahiert GOZ-Ziffern im " +
      "Multi-Label-Setup über 10 Kern-Codes und tritt gegen eine RAG-Baseline aus " +
      "BM25 und Embeddings an, aufgesetzt auf genau demselben unveränderten " +
      "Basismodell. Der Weg dahin war ehrliche Arbeit: Zwei frühe Trainingsläufe " +
      "kollabierten in fast konstante Vorhersagen, systematisches Debugging " +
      "verdächtigte zuerst Exposure Bias und fand am Ende die banale Ursache, " +
      "nämlich zu wenige Gradientenschritte. Nach der Korrektur gewinnt das " +
      "Finetune bei F1 (0,59 gegen 0,48) und ganz deutlich bei Exact Match " +
      "(0,38 gegen 0,07), während die RAG-Baseline den höheren Recall behält. Ein " +
      "dritter Ansatz verdrahtet beide Pfade als Graph: Die erste Fassung mit " +
      "Aggregator scheiterte messbar, die zweite mit Checker-Knoten schöpft 86 % " +
      "des Spielraums aus. Alle Trainingsdaten sind synthetisch generiert.",
    tags: ["PyTorch", "LoRA", "RAG", "Llama 3.2", "Python"],
    stats: [
      { value: "0,59", label: "F1 (RAG: 0,48)" },
      { value: "0,38", label: "Exact Match (RAG: 0,07)" }
    ],
    demoUrl: "https://medical-coding-extractor.streamlit.app/",
    repoUrl: "https://github.com/marco-stang/medical-coding-extractor",
    status: "live",
    cluster: "agentic-ai"
  },
  {
    id: "second-brain",
    title: "Ask-Marco Assistant",
    summary:
      "Ein Chat, der jedes Projekt in diesem Portfolio kennt. Frag ihn einfach " +
      "direkt, zum Beispiel: „Welche Projekte zeigen Cloud-Erfahrung?“",
    description:
      "Ein „second brain“, das README, CLAUDE.md und HANDOVER aller Portfolio-Repos " +
      "zu einem Snapshot verdichtet und Fragen dazu direkt im Chat beantwortet. " +
      "Bewusst Context-Stuffing statt Vektor-RAG, denn bei dieser Projektzahl passt " +
      "alles locker ins Prompt und jede Vektor-Datenbank wäre reine Show. Dasselbe " +
      "Wissen liegt zusätzlich hinter einem MCP-Server, sodass Claude Code oder " +
      "Desktop direkt danach fragen können.",
    tags: ["Python", "LangChain", "MCP", "Streamlit"],
    demoUrl: "https://second-brain-projects.streamlit.app/",
    repoUrl: "https://github.com/marco-stang/ask-marco-assistant",
    status: "live",
    cluster: "agentic-ai",
    orbitsCenter: true
  },
  {
    id: "chrono24-chatbot",
    title: "Chrono24-FAQ-Chatbot",
    shortTitle: "Chrono24 Chatbot",
    summary:
      "Ein RAG-Chatbot über die öffentlichen Chrono24-Hilfeseiten, der jede " +
      "Antwort belegt, und was er nicht belegen kann, als geprüftes Briefing an " +
      "einen Menschen übergibt.",
    description:
      "Hybrid-Retrieval aus BM25 und Vektorsuche mit RRF-Fusion und " +
      "Cross-Encoder-Reranker, dazu offline per Haiku erzeugte Umformulierungen " +
      "jeder FAQ-Frage als zusätzliche Embeddings. Die Hit-Rate@5 liegt bei 91 % " +
      "auf den Tuning-Fragen und 100 % auf einem Held-out-Set, das nie zum " +
      "Justieren benutzt wurde; ein CI-Job lässt keinen Pull Request durch, der " +
      "darunter fällt. Die ehrlichste Stelle ist die Ablationstabelle: zehn " +
      "Ideen wurden gemessen und verworfen, darunter ein Reranker mit dem " +
      "Fünffachen an Parametern, der keinen einzigen Fehltreffer behob und die " +
      "Antwortzeit verzehnfachte. Verweigern hat drei unabhängige Schichten, und " +
      "die billigste davon, das Retrieval-Konfidenz-Gate, stand nach der ersten " +
      "Messung bei 0 %: Das multilinguale Embedding hält jeden deutschen " +
      "Fragesatz für ähnlich, selbst „Wie backe ich einen Hefezopf?“. Nach dem " +
      "Umbau auf ein ODER aus drei Signalen fängt es die Hälfte der " +
      "themenfremden Fragen ohne einen einzigen verlorenen Treffer; den Rest " +
      "müssen Prompt und ein deterministischer Faithfulness-Check tragen, " +
      "derselbe Validator wie im Handover Brief Generator.",
    tags: ["RAG", "FastAPI", "Chroma", "BM25", "Claude API", "Python"],
    stats: [
      { value: "91 %", label: "Hit-Rate@5" },
      { value: "100 %", label: "Held-out" },
      { value: "50 %", label: "Off-Topic abgewiesen" }
    ],
    // Repo ist noch privat, Deploy steht aus (Render Free-Tier reicht nicht
    // für Embedding- plus Reranker-Modell). Links erst eintragen, wenn sie
    // für Recruiter wirklich erreichbar sind.
    demoUrl: null,
    repoUrl: null,
    status: "no-demo",
    cluster: "agentic-ai"
  },
  {
    id: "handover-brief",
    title: "Handover Brief Generator",
    shortTitle: "Handover Brief",
    summary:
      "Macht aus einem Support-Ticketverlauf bei der Übergabe ein Briefing, in " +
      "dem jede Aussage ihre Ticketzeile zitieren muss, und ein Validator prüft " +
      "das nach, statt dem Modell zu glauben.",
    description:
      "Eine Prompt-Anweisung „zitiere deine Quellen“ ist eine Bitte, keine " +
      "Prüfung. Hier muss Claude Haiku strukturiert antworten, jede Aussage mit " +
      "Zeilen-IDs, und ein deterministischer Validator rechnet danach pro Aussage " +
      "den Token-Overlap gegen die zitierten Zeilen. Unbelegtes löst einen " +
      "zweiten Versuch mit dem konkreten Fehler im Prompt aus, scheitert auch der, " +
      "gibt es eine Fehlermeldung statt eines Briefings. Über 15 generierte " +
      "Eval-Tickets liegt die Citation-Validity bei 98,7 % roh und 99,3 % nach " +
      "dem Retry; die Fact-Coverage bleibt mit 74,7 % die schwächere Zahl, weil " +
      "Token-Overlap Paraphrasen nicht sieht. Der Validator hatte selbst einen " +
      "dokumentierten Bug: Zeilen-IDs im Fließtext zählten als Fremdwörter und " +
      "bestraften ausgerechnet sauberes Zitieren. Und der dritte Demo-Fall zeigt " +
      "die Architekturgrenze offen: Ein Kunde, der auf „wie letztes Mal“ " +
      "verweist, ist für einen zeilenbasierten Prüfer unsichtbar, weil der nur " +
      "prüft, was zitiert wurde, nicht, was fehlt.",
    tags: ["Claude API", "Python", "Streamlit", "pytest"],
    stats: [
      { value: "99,3 %", label: "Citation-Validity" },
      { value: "74,7 %", label: "Fact-Coverage" }
    ],
    // Noch nicht auf GitHub und nicht deployed; Streamlit Cloud ist der
    // nächste Schritt. Links folgen, sobald sie erreichbar sind.
    demoUrl: null,
    repoUrl: null,
    status: "no-demo",
    cluster: "agentic-ai"
  },
  {
    id: "cloud-native-pipeline",
    title: "Document Auto-Classifier",
    shortTitle: "Auto-Classifier",
    summary:
      "Dokument hochladen, fertig: Typ und relevante Felder erkennt die Pipeline " +
      "von allein, komplett serverlos auf AWS und ohne einen einzigen selbst " +
      "betriebenen Server.",
    description:
      "Eine Rechnung, eine Visitenkarte oder ein Vertragsschnipsel landet in S3 und " +
      "löst sofort eine Lambda aus, die den Dokumenttyp erkennt und die relevanten " +
      "Felder herauszieht, vollständig event-getrieben über S3, Lambda, Claude, " +
      "DynamoDB und API Gateway. Ein einziger Claude-API-Call klassifiziert und " +
      "extrahiert in einem Schritt, die Antwort wird gegen typspezifische " +
      "Pydantic-Schemas validiert, und Fehlerfälle macht die Pipeline sichtbar " +
      "statt sie zu verschlucken. Die gesamte Infrastruktur steht als " +
      "Terraform-Code im Repo und ist gegen ein echtes AWS-Konto verifiziert.",
    tags: ["AWS Lambda", "Terraform", "DynamoDB", "Streamlit", "Claude API"],
    demoUrl: "https://cloud-native-pipeline.streamlit.app/",
    repoUrl: "https://github.com/marco-stang/document-auto-classifier",
    status: "live",
    cluster: "cloud"
  },
  {
    id: "ai-analytics-portal",
    title: "Review Risk Predictor",
    shortTitle: "Risk Predictor",
    summary:
      "Sagt für jede Bestellung das Risiko einer schlechten Kundenbewertung vorher " +
      "und erklärt in einem Satz, woran es liegt. Keine nackte Zahl, sondern eine " +
      "Begründung.",
    description:
      "Für jede Bestellung im Olist-Marktplatz schätzt ein " +
      "GradientBoostingClassifier aus scikit-learn das Risiko einer schlechten " +
      "Bewertung. SHAP legt die wichtigsten Treiber frei, ein LLM übersetzt sie in " +
      "Klartext, den auch das Fachteam ohne Data-Science-Hintergrund sofort " +
      "versteht. Umgesetzt als vollständige Full-Stack-Anwendung mit React und " +
      "TypeScript im Frontend und FastAPI im Backend, ganz bewusst als Gegenstück " +
      "zu SQL Copilot (Agentic AI) und Medical Coding Extractor (LLM-Finetuning). " +
      "Die Zahlen bei zeitlichem Train/Test-Split: ROC-AUC 0,706, konservativ " +
      "kalibriert mit hoher Precision und niedrigerem Recall.",
    tags: ["React", "TypeScript", "FastAPI", "scikit-learn", "SHAP"],
    stats: [{ value: "0,706", label: "ROC-AUC (zeitl. Split)" }],
    demoUrl: "https://ai-analytics-portal-gray.vercel.app/",
    repoUrl: "https://github.com/marco-stang/review-risk-predictor",
    status: "live",
    cluster: "full-stack"
  },
  {
    id: "fraud-triage",
    title: "Fraud Triage Copilot",
    shortTitle: "Fraud Triage",
    summary:
      "Führt eine Bestellung Schritt für Schritt durch die Betrugsprüfung: " +
      "ML-Score, SHAP-Erklärung, Analysten-Briefing. Entscheiden bleibt " +
      "Menschensache.",
    description:
      "Auf einem synthetischen Luxusuhren-Marktplatz scort ein Gradient-Boosting-" +
      "Modell jede Bestellung, SHAP legt die Treiber offen und ein Briefing " +
      "übersetzt sie in nächste Schritte für den Fraud-Analysten. Bewertet wird " +
      "an der Größe, die ein Team wirklich spürt: Precision@200 von 1,0 gegen " +
      "0,935 der Regel-Baseline, bei zeitlichem Split. Die Eval weist den Recall " +
      "pro Betrugsmuster aus statt einer Gesamtzahl, und genau da liegt die " +
      "ehrliche Schwäche: Ghost Listings findet das Modell komplett, Account " +
      "Takeover nur zu 85,1 Prozent, weil dessen Trust-Signale legitim aussehen. " +
      "Ein zweites, mit zusätzlichen Verhaltenssignalen trainiertes Modell hebt " +
      "diesen Recall auf 91,5 Prozent, schließt die Lücke aber nicht vollständig " +
      "und kostet Recall bei einem verwandten Muster — der Trade-off wird in der " +
      "Demo gezeigt, nicht versteckt. Das Briefing nennt ausschließlich belegte " +
      "Treiber, per Guardrail getestet.",
    tags: ["scikit-learn", "SHAP", "Streamlit", "Python", "Claude API"],
    stats: [
      { value: "1,0", label: "Precision@200 (Regeln: 0,935)" },
      { value: "85 %", label: "ATO-Recall, ehrlich" }
    ],
    demoUrl: "https://fraud-triage-copilot.streamlit.app/",
    repoUrl: "https://github.com/marco-stang/fraud-triage-copilot",
    status: "live",
    cluster: "full-stack"
  },
  {
    id: "hr-interview-cockpit",
    title: "Interview Cockpit",
    summary:
      "Führt dich strukturiert durch Bewerbungsgespräche: Fragenpool vorbereiten, " +
      "live im Gespräch bewerten, am Ende steht die Auswertung als Radar-Chart " +
      "bereit.",
    description:
      "Ein einziges HTML-File deckt den ganzen Interviewprozess ab: Intake von " +
      "Stellenanzeige und CV, ein importierbarer Fragenpool aus xlsx mit Cluster- " +
      "und Verhaltensankern, Terminplanung im Kalender, ein Live-Cockpit mit Timer, " +
      "Phasen-Tracking und vierstufiger Skala, dazu je Kandidat:in eine KPI- und " +
      "Radar-Chart-Auswertung. Kein Backend, kein Build-Schritt, und selbst der " +
      "optionale KI-Copilot ruft die API direkt aus dem Browser mit einem selbst " +
      "eingegebenen Key. Entstanden ist das Tool aus echtem Bedarf während eines " +
      "Bewerbungsprozesses, diese Version ist bereinigt und enthält ausschließlich " +
      "synthetische Beispieldaten.",
    tags: ["JavaScript", "HTML/CSS", "Chart.js", "Claude API"],
    demoUrl: "https://marco-stang.github.io/interview-cockpit/",
    repoUrl: "https://github.com/marco-stang/interview-cockpit",
    status: "live",
    cluster: "full-stack"
  },
  {
    id: "amalea",
    title: "Applied ML Course (KIT)",
    shortTitle: "ML Course (KIT)",
    summary:
      "Sechs Wochen praktisches Machine Learning für den KI-Campus. Marco hat die " +
      "Inhalte am KIT mitentwickelt und den Kurs als Co-Dozent begleitet.",
    description:
      "Praktische Jupyter-Notebook-Übungen für den KI-Campus-Kurs AMALEA, also " +
      "Angewandte Machine Learning Algorithmen: von Pandas-Grundlagen über " +
      "Klassifikation, Clustering und Regression bis zu CNNs und generativen " +
      "Modellen. Marco hat die Kursinhalte als Mitarbeiter des ITIV am KIT " +
      "mitgeschrieben und den Kurs als Co-Dozent begleitet. Dieser Fork ist die " +
      "persönliche Portfolio-Kopie, das Original hostet und versioniert der " +
      "KI-Campus.",
    tags: ["Python", "Jupyter", "Machine Learning", "Deep Learning"],
    demoUrl: null,
    repoUrl: "https://github.com/marco-stang/applied-ml-course",
    status: "no-demo",
    cluster: "full-stack"
  }
];
