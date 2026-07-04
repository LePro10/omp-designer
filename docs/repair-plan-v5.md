# v5 Repair Plan

Source: Fable audit session
Status: planning document, not implementation proof
Do not treat this as verified current truth without re-checking the code.

omp-designer — Vollständige Analyse & Architekturplan

  1. Executive Summary

  Das Repository ist in einem deutlich besseren Zustand als die Problemliste im
  Prompt vermuten lässt — aber es ist ein anderes System als das, wonach der 
  Prompt fragt. Die entscheidende Erkenntnis:

  v5 (aktueller Stand, Commit 3ea898f + uncommittete Änderungen) hat das 
  Skill-Gate, die State Machine, das Tool-Gating und die MCP-Mutation bewusst 
  vollständig entfernt. Der OMP-Adapter deklariert sich selbst als "prompt-only
  workflow guidance; no skill-read tool gate" (extension/index.ts:7). Ein Test
  verlangt sogar explizit, dass keine tool_call/tool_result-Handler registriert
  sind (extension.test.ts:36-37). Die Invariante "designer-master must complete 
  before any other required skill begins" ist nirgends implementiert — weder als
  Hard Gate noch als Soft Check. Docs, Skills und Code sind dabei untereinander
  erstaunlich konsistent: Sie behaupten das Gate auch nicht mehr.
  docs/problems.md und loop.md dokumentieren die Entfernung als bewusste
  Entscheidung mit realer Evidenz (das v4-Gate "measured ritual completion
  rather than interface quality").

  Meine Bewertung: Die v5-Entscheidung ist im Kern richtig — das v4-Gate war
  Ritual-Theater. Aber v5 hat mit dem Gate auch jede Telemetrie darüber
  verloren, ob Skills überhaupt gelesen werden. Das ursprüngliche reale Problem
  ("Agenten haben nicht einmal designer-master gelesen") ist damit weder gelöst
  noch messbar. Zusätzlich gibt es einen P0-Hygienefund (live API-Key in .env im
  Arbeitsverzeichnis), einen uncommitteten Release-Stand, und die neue
  Plan-Check-Logik ist englisch-only Regex-NLP, die für deutsche Prompts (deine
  Sprache) schlicht nie feuert.

  Ausgeführte Checks (alle ohne Repo-Änderung, npm pack nur --dry-run):

  Command: npm test (typecheck + 8 Suiten)
  Exit: 0
  Ergebnis: pass
  Was es beweist: Echtes Extension-Modul, echte Validator-CLIs, Lifecycle in
    temp-HOME funktionieren
  Was es NICHT beweist: Kein echter omp-Prozess, keine echte Host-API, kein
    Modell
  ────────────────────────────────────────
  Command: npm run check:release
  Exit: 0
  Ergebnis: pass, 57 Dateien
  Was es beweist: Pack-Whitelist korrekt, keine Secrets in gepackten Dateien,
    keine Legacy-Gate-Strings
  Was es NICHT beweist: Nichts über ungepackte Dateien (.env!), nichts über
    Runtime
  ────────────────────────────────────────
  Command: Repo-weiter Secret-Scan (find-basiert)
  Exit: —
  Ergebnis: 1 Fund
  Was es beweist: Einziger Live-Secret-Fund: .env
  Was es NICHT beweist: Nur bekannte Muster; 5,4 GB test-output nur ohne
    node_modules gescannt

  ---
  2. Top 10 bestätigte Probleme (CONFIRMED)

  1. Live OpenAI-Key (sk-proj…, 164 Zeichen) in .env im Repo-Root. Gitignored,
  nie committet, nicht im npm-Pack — aber er liegt in einem Verzeichnis, in dem
  regelmäßig KI-Agenten mit Dateizugriff arbeiten und real-agent-eval.mjs echte
  Agentenprozesse mit vererbtem process.env startet. Evidenz: direkter
  Pattern-Match; git log --all -- .env leer.
  2. Die geforderte Gate-Invariante existiert nicht — auf keinem Host. Kein
  Read-Tracking, keine ToolCallId-Korrelation, kein Content-Hashing, keine
  Reihenfolge-Prüfung, kein Report-Store. Alle Fragen aus dem Prompt-Abschnitt
  "Skill-System und Gate" haben dieselbe Antwort: entfällt, weil v5 nichts davon
  hat. Evidenz: extension/index.ts komplett gelesen; extension.test.ts:33-38.
  3. Kein "Hard Gate" irgendwo, und auch kein Skill-Read-Nachweis. OMP:
  prompt-only + post-hoc session_stop-Checks (Klassifikation: post-execution 
  detection mit einer begrenzten Continuation). Pi: prompt-only + nur
  Plan-Checks. Kein einziges Trace-Event dokumentiert, ob ein Skill je gelesen
  wurde — das ursprüngliche Kernproblem ist unbeobachtbar.
  4. Uncommitteter Release-Stand auf master. 13 modifizierte Dateien (die
  gesamte Plan-Only-Funktionalität!) sind nicht committet, Version steht
  unverändert auf 5.0.0. Ein npm publish jetzt würde einen Stand
  veröffentlichen, der keinem Commit entspricht. check:release prüft das nicht.
  5. Intent-Erkennung ist englisch-only Regex-NLP. asksForApprovalPlan
  (extension/index.ts:359-361) verlangt wörtlich plan + approve/review/confirm.
  Deutsche Prompts ("Erstelle einen Plan, ich gebe dann die Freigabe")
  aktivieren den Plan-Modus nie → Plan-Prompt und Plan-Checks laufen für
  deutschsprachige Nutzung stillschweigend nie. Umgekehrt triggert "review my
  plan" fälschlich Plan-Only bei Build-Aufträgen.
  6. Prompt und Runtime-Check widersprechen sich bei der Planlänge. Prompt:
  "unter 700 Wörtern, außer der User bittet um eine detaillierte Spezifikation".
  Runtime: hartes Fail bei >800 Wörtern ohne Ausnahme (planChecks, Zeile
  372-374). Ein legitim angeforderter Detailplan wird zwangs-rewritten.
  7. Trace-Redaction ist schwächer als der eigene Secret-Scanner. redact() in
  der Extension kennt 4 Muster; scripts/security.mjs kennt 8 (AWS, Private Key,
  JWT, DB-URIs fehlen in der Extension). Duplizierter Code statt shared module —
  Root Cause: shared/ ist ein leerer Ordner.
  8. Pi-Asymmetrie ist unvollständig dokumentiert. Der Pi-Adapter hat keinerlei
  Delivery-Check-Backstop (nur Plan-Checks). architecture.mds
  Runtime-Flow-Diagramm und AGENTS.md unterscheiden das nicht. Immerhin: keine
  falsche Paritätsbehauptung ("same focused workflow, without tool interception"
  ist ehrlich, aber unpräzise).
  9. session_stop führt bei jedem Stop in einem Frontend-cwd npm run build im 
  User-Projekt aus (bis 120 s), auch bei reinen Chat-Turns — ein realer Side
  Effect (dist-Output) plus Latenz. Zudem: userFactsByCwd hält nur den letzten
  Prompt (Multi-Turn-Fakten gehen verloren), und die Session-ID fällt auf
  ${cwd}:unknown zurück, wodurch Attempt-Zähler über Sessions kollidieren
  können.
  10. Keine automatisierte E2E-Evidenz. Alle 8 Testsuiten sind Unit/Integration
  gegen das importierte Modul oder CLIs. Der einzige echte E2E-Pfad
  (real-agent-eval.mjs) ist manuell, braucht lokalen omp + Modell + Key, und
  seine Evidenz liegt in 5,4 GB nicht versioniertem test-output/. Die
  Prompt-Contract-"Tests" sind Regex-Präsenz-Checks auf Prompttext — nützliche
  Regressionsanker, aber keine Verhaltensevidenz.

  3. Top 10 vermutete / unverifizierte Risiken

  1. SUSPECTED — Skill-Skip-Regression: Ohne jedes Read-Signal kann niemand
  sagen, ob v5-Agenten designer-master überhaupt lesen. R8 zeigte gutes
  Verhalten für einen Fall/ein Modell; das ist keine Verallgemeinerung.
  2. UNVERIFIED — resources_discover-Vertrag: Ob OMP/Pi { skillPaths } wirklich
  so konsumieren, ist nur durch Mocks und einen manuellen Smoke-Run gedeckt.
  Host-API-Drift bräche das System lautlos.
  3. SUSPECTED — Plan-Check False Positives: Route-Erkennung verlangt Backticks
  um Routen; die Dead-Link-Regex feuert auf legitime Anker-Erwähnungen ("links
  to #pricing section"); "form"-Regex feuert auf "platform"-nahe Formulierungen
  nicht, wohl aber auf legitime erklärte Nicht-Formulare in ungünstiger Syntax.
  4. SUSPECTED — In-Memory-State über Sessions: userFactsByCwd/Attempt-Maps
  leben im Prozess. Parallele Sessions im selben cwd teilen sich Fakten; ein
  Host-Restart heilt/vergisst alles undokumentiert.
  5. UNVERIFIED — DESIGNER_USER_FACTS-Substring-Matching in fix-ai-slop.mjs:
  Sichtbare Claims müssen wörtlich im User-Prompt vorkommen; Paraphrasen
  legitimer Fakten könnten als Blocker fehlschlagen (nur teilweise gelesen).
  6. SUSPECTED — Doppelte Grep-Blindstelle im eigenen Tooling: Mein rekursiver
  grep -r übersprang .env reproduzierbar (find-basiert gefunden). check-release
  scannt ohnehin nur gepackte Dateien — es gibt keinen repo-weiten Secret-Scan
  im Testlauf.
  7. UNVERIFIED — pi-backup (old)/sessions: Alte Session-/Config-Backups (312
  KB) im Repo-Verzeichnis. Bekannte Secret-Muster: sauber. PII/Chatinhalte:
  nicht bewertet. Gehört nicht in dieses Repo.
  8. SUSPECTED — Duplicate-Load-Guard-Nebenwirkung: Der INSTANCE_ENV-PID-Guard
  verhindert Re-Registrierung im selben Prozess auch nach legitimem
  Extension-Reload (Hot-Reload würde still nichts registrieren).
  9. UNVERIFIED — .env-Zweck: OPENAI_API_KEY wird von keinem Repo-Skript
  referenziert; vermutlich für den opencode-Provider des Eval-Modells. Unklar =
  Entfernbarkeit unklar.
  10. SUSPECTED — 5,4 GB test-output/ als Wartbarkeits-/Unfallrisiko: untracked;
  ein git add -A oder falsches Packaging-Refactoring hätte massive Folgen;
  Evidenz-Referenzen in Docs (R1–R8) sind nicht reproduzierbar für Dritte.

  4. Top 10 architektonische Chancen

  1. Shared Core real machen: shared/ mit State-Store, Prompt-Bau, planChecks,
  Redaction/Secret-Patterns (eine Quelle statt drei Kopien), von beiden Adaptern
  und Scripts importiert.
  2. Skill-Read-Telemetrie statt Gate: Nicht blockieren, aber messen —
  skill_read-Trace-Events (falls der Host Read-Events liefert; sonst
  Skill-Zitat-Marker, die der Agent im Output nennen muss und die die Eval
  prüft). Damit wird das Ursprungsproblem erstmals beobachtbar.
  3. Intent per Kommando statt Regex: /designer plan als expliziter
  Modus-Schalter; die Regex nur als Fallback mit Trace-Event
  plan_intent_heuristic und mehrsprachigen Mustern.
  4. Delivery-Checks nur nach Schreibaktivität: session_stop prüft
  mtime-Änderungen seit Session-Start, bevor es Build & Validatoren feuert.
  Eliminiert den Chat-Turn-Build-Side-Effect.
  5. Ehrliche Enforcement-Taxonomie in Docs: OMP = post-execution detection, 
  bounded continuation; Pi = prompt-only + plan detection. Ein Satz pro Host in
  README/AGENTS/doctor.
  6. Release-Gate erweitern: clean working tree + Version-Bump gegen letztes
  Git-Tag + repo-weiter (find-basierter) Secret-Scan inkl. Dotfiles.
  7. Automatisierter E2E-Smoke: ein CI-tauglicher Headless-omp-Lauf (oder
  Host-Simulator mit dem echten Event-Vertrag) mit Canary-Assertions: Prompt
  injiziert genau 1×, Plan-Check-Continuation feuert, Delivery-Check feuert
  nicht bei leerem cwd.
  8. Docs-Konsistenz-Checker generalisieren: Skill-Anzahl/-Namen/Version aus
  DESIGNER_SKILLS + package.json generiert gegen README/AGENTS/architecture
  geprüft (heute nur punktuell in check-release).
  9. Validator-Orchestrator: eine CLI (designer-validate) mit JSON-Schema, die
  fix-ai-slop + analyze-layout + audit-data bündelt; Blocker/Warning-Taxonomie
  ist bereits gut und bleibt.
  10. Eval-Matrix erweitern: ein deutschsprachiger Plan-Case und ein
  Skill-Skip-Detektions-Case in real-agent-eval.mjs; test-output mit GC-Policy
  und Auslagerung großer Artefakte.

  Explizit behalten (das ist gut): die vier schlanken Skills (inhaltlich stark,
  proportional, mit echtem Design-Urteil statt Verbotslisten), die
  Evidenz-Ledger-Architektur (User-Prompt schlägt selbstautorisierte
  EVIDENCE.md), die bounded Continuations, die dry-run-first Lifecycle-Skripte
  mit temp-HOME-Tests, docs/problems.md als ehrliches Entscheidungslog. Löschen:
  pi-backup (old)/, leeres shared/ (oder füllen), promt.md nach dieser Session,
  .env aus dem Repo-Verzeichnis.

  5. Go/No-Go

  No-Go für ein Publish heute — nicht wegen Architektur, sondern wegen: (a)
  Live-Key im Arbeitsverzeichnis, (b) uncommitteter Release-Stand, (c)
  Plan-Feature de facto funktionslos für deutsche Prompts, (d)
  Prompt/Check-Widerspruch bei Planlänge. Alles davon ist in Tagen behebbar. Die
  Grundarchitektur v5 ist tragfähig; ein Rückbau zum v4-Gate wäre falsch.

  6. Priorisierter Reparaturplan

  P0 — Security / Release-Blocker
  - Key-Hygiene: .env aus dem Repo-Verzeichnis entfernen (z. B. ~/.config/… +
  direnv), Key rotieren (er war Agenten-Prozessen zugänglich). Repo-weiten
  Secret-Scan (find-basiert, inkl. Dotfiles, exkl. node_modules) als
  test:security-Erweiterung. DoD: Scan grün, Key rotiert, .env weg. Evidenz:
  CONFIRMED.
  - Git-Hygiene: Arbeitsstand committen; check-release um "working tree clean +
  Version > letztes Tag" erweitern. DoD: Publish nur von sauberem, getaggtem
  Stand möglich.

  P1 — Gate-/Check-Korrektheit
  - Plan-Intent: explizites Kommando + mehrsprachige Fallback-Heuristik +
  Trace-Event (Pfad A, empfohlen) vs. nur bessere Regex (Pfad B, billiger,
  bleibt fragil). Dateien: extension/index.ts, extensions/designer.ts, neue
  shared-Funktion. Tests: deutsche + englische Prompts, positive und negative.
  - Wortlimit-Widerspruch auflösen: Check erkennt "detailed
  specification"-Anforderung im User-Prompt oder Limit fällt auf Warning.
  - session_stop: Delivery-Checks nur bei Datei-Änderungen seit Session-Start;
  Session-ID-Fallback eindeutig machen (cwd+timestamp).
  - Trace-Redaction auf SECRET_PATTERNS aus security.mjs umstellen (Import statt
  Kopie).

  P2 — E2E-Beweise
  - Host-Simulator-Test, der den dokumentierten Event-Vertrag
  (before_agent_start/resources_discover/session_stop-Result-Shapes) als
  eigenständige Fixture pflegt, plus ein optionaler echter omp-Smoke-Run mit
  Canary (existiert als manuelles Artefakt test-output/e2e-canary, gehört
  skriptiert). Tests: Doppel-Load über zwei Loader-Realms, Plan-Continuation
  genau 1×, keine Continuation nach zweitem Fail.

  P3 — Doku-Konsistenz — Konsistenzmatrix der wichtigsten Claims:

  Claim: "4 conditional skills"
  Quelle: README, AGENTS, arch., package.json, check-release
  Realität: 4 Skill-Dateien, Manifest im Code
  Status: match
  Auflösung: —
  ────────────────────────────────────────
  Claim: Kein Tool-Gate, keine MCP-Mutation
  Quelle: alle Docs
  Realität: Code entspricht
  Status: match
  Auflösung: —
  ────────────────────────────────────────
  Claim: Plan <700 Wörter mit User-Ausnahme
  Quelle: Prompt
  Realität: Runtime: hart >800 ohne Ausnahme
  Status: contradiction
  Auflösung: P1-Fix
  ────────────────────────────────────────
  Claim: Pi = "same focused workflow"
  Quelle: designer.ts Header
  Realität: Pi ohne Delivery-Backstop
  Status: partial
  Auflösung: Ein Satz in README/AGENTS/arch.
  ────────────────────────────────────────
  Claim: session_stop-Flow (arch.md)
  Quelle: architecture.md
  Realität: gilt nur für OMP
  Status: partial
  Auflösung: Diagramm annotieren
  ────────────────────────────────────────
  Claim: "no secrets" via check:release
  Quelle: README-Implikation
  Realität: scannt nur gepackte Dateien
  Status: partial
  Auflösung: P0-Scan
  ────────────────────────────────────────
  Claim: R8 = clean-install-Evidenz
  Quelle: README, loop, problems
  Realität: nur als 5,4 GB lokale Artefakte, nicht reproduzierbar
  Status: unverified
  Auflösung: Report-Schema + Aufbewahrungspolicy
  ────────────────────────────────────────
  Claim: Timing-/Motion-/Skalen-Angaben
  Quelle: animate.md vs. andere
  Realität: nur in animate.md definiert, keine Widersprüche
  Status: match
  Auflösung: —

  P4 — Designer-Qualität (Neubewertung von Grund auf): Die Skill-Inhalte sind
  das Stärkste am Repo — proportional, mit Kompositions-Map gegen
  Card-Grid-Klone, geschlossenem Faktenset gegen erfundene Claims,
  "Review-Signal statt Verbotsliste" gegen Anti-Slop-Overreach. Was fehlt: (a)
  messbarer Skill-Konsum (P1-Telemetrie), (b) ein objektives visuelles
  Prüfverfahren jenseits "Screenshots ansehen" — Vorschlag: strukturiertes
  Review-Rubrik-JSON pro Eval-Run (Hierarchie/Spezifität/Responsive/Motion je 3
  Stufen mit Begründungspflicht), von einem zweiten Modell oder Menschen
  ausgefüllt, versioniert neben dem Report; (c) User-Wunsch-vs-Regel-Konflikt:
  Skills sagen das implizit richtig ("Honor explicit interaction requests"),
  sollte aber als expliziter Vorrang-Absatz in designer-master stehen:
  User-Entscheidung > Skill-Geschmacksregel, nur Fakten-/A11y-Blocker sind nicht
  verhandelbar.

  P5 — Performance/Kontextkosten: v5 hat das Kernproblem (12 Skills × Vollread)
  bereits gelöst; verbleibend: Prompt (~6,5 KB) enthält viele Detailregeln, die
  in review-skill dupliziert sind — kürzbar; test-output-GC.

  P6 — Release-Readiness: P0+P1 fertig → Version 5.0.1/5.1.0, Tag,
  check:release, ein frischer Real-Agent-Run (ein Build-Case, ein Edit-Case, ein
  deutscher Plan-Case) als Release-Evidenz.

  7. Ziel-Architektur (Soll)

  shared/core.ts          State, Prompts, planChecks, Intent, Redaction (eine
  Quelle)
  shared/security.ts      SECRET_PATTERNS (ersetzt scripts/security.mjs-Duplikat
  in extension)
  extension/index.ts      OMP-Adapter: Hooks + Delivery-Backstop (nur nach
  Writes)
  extensions/designer.ts  Pi-Adapter: Hooks, ehrlich als prompt-only +
  plan-check deklariert
  skills/                 4 Skills, Frontmatter = Manifest-Quelle
  scripts/validate.mjs    Orchestrator über fix-ai-slop / analyze-layout /
  audit-data
  scripts/e2e-smoke.mjs   Host-Simulator + optionaler echter omp-Canary-Run
  scripts/check-release.mjs  + tree-clean, version-tag, repo-weiter Secret-Scan
  scripts/real-agent-eval.mjs  + DE-Plan-Case, Skill-Konsum-Signal,
  Review-Rubrik
  Bewusst nicht bauen: Skill-Read-State-Machine, Pre-Execution-Tool-Gate,
  Report-Wiederverwendung über Sessions — die v4-Erfahrung im eigenen
  Problems-Log ist dafür ausreichende Gegen-Evidenz. Enforcement-Ehrlichkeit
  ersetzt Enforcement-Theater.

  8. Tests, die vor Release existieren müssen

  1. Intent-Erkennung DE+EN, positiv/negativ (Unit, shared core).
  2. Detailplan-Ausnahme fürs Wortlimit (Unit).
  3. session_stop ohne Datei-Änderung → kein Build-Spawn (Integration, temp-cwd,
  physisch geprüft).
  4. Trace-Redaction gegen alle 8 Secret-Muster (Unit, real formats).
  5. Repo-weiter Secret-Scan-Test, der eine gepflanzte Canary in einem Dotfile
  findet (beweist Scan-Abdeckung — mein grep-Blindstellen-Fund macht das
  zwingend).
  6. Release-Gate: schmutziger Tree / fehlender Version-Bump → Fail (Integration
  in temp-Klon).
  7. Doppel-Registrierung über zwei Realms (skriptierter Smoke statt manuellem
  Artefakt).
  8. Ein reproduzierbarer real-agent Plan-Case-Lauf mit archiviertem Report
  inkl. Trace-Validität.

  9. Manuelle User-Aktionen

  1. OpenAI-Key rotieren und .env außerhalb des Repos ablegen (einzige dringende
  Aktion).
  2. Entscheiden: pi-backup (old)/ archivieren/löschen (gehört nicht in dieses
  Repo).
  3. Entscheiden: uncommittete v5-Plan-Änderungen committen (sie sind getestet
  und grün).
  4. Optional: test-output (5,4 GB) aufräumen bzw. GC-Policy festlegen.

  Analysis complete.
  Repository modified: no
  Recommended next step: Rotate the exposed OpenAI key and move .env out of the
  repo, then commit the pending v5 plan-check work before any further changes.
