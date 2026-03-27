# sveltekit-orchestrator

## Stack
- Node.js 22, TypeScript strict mode
- @anthropic-ai/claude-agent-sdk (Claude Agent SDK)
- npm als Package Manager
- ESM (type: "module")

## Commands
- `npm run dev` — tsx watch mode für Entwicklung
- `npm run build` — TypeScript kompilieren nach dist/
- `npm run check` — TypeScript Type Check
- `npm run lint` — ESLint + Prettier
- `npm test` — Vitest Tests
- `npm run test:e2e` — Integration Tests (Agent SDK Mock)

## Architecture
- src/cli.ts — CLI Entry Point, Command Parsing
- src/orchestrator.ts — Hauptlogik, Phase-Orchestrierung
- src/agents/ — Agent Configs und Runner
- src/prompts/ — System Prompts als .md Dateien
- src/utils/ — Features, Progress, GitHub API, Config
- templates/ — Starter Template + GitHub Workflows + Issue Templates

## Hard Rules
- KEIN React (auch nicht für Templates)
- Immer npm, nie yarn/pnpm
- Agent SDK: Jeder Agent-Run = separater query() Call = frischer Context
- Evaluator hat NIEMALS Write/Edit Tools
- Model ist IMMER "opus"
- Alle Prompts in separate .md Dateien auslagern (nicht inline in TypeScript)
- Error Handling: Nie silent failen, immer loggen
- features.json: Nur der Orchestrator schreibt rein, nicht die Agents direkt
  (Agents markieren Features in ihrem Output, Orchestrator parsed und updated)

## Code Style
- Funktionale Patterns bevorzugt, Klassen nur wenn nötig
- Explizite Return Types
- Keine any Types (unknown + Type Guards wenn nötig)
- Console Output mit Emoji-Prefix für Lesbarkeit