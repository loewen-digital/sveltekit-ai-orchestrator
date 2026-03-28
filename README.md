# @loewen-digital/sveltekit-orchestrator

AI-powered SvelteKit project orchestrator using the Claude Agent SDK. Turns a project idea into a fully implemented SvelteKit application through autonomous agent collaboration.

## How it works

The orchestrator runs a pipeline of specialized Claude agents:

1. **Discovery** — Interactive interview to understand your project idea, outputs `briefing.md`
2. **Planning** — Creates `spec.md` and a prioritized `features.json`
3. **Building** — Implements features one-by-one with a Generator → Evaluator loop (retries on failure)
4. **Polish** — Final quality pass for accessibility, responsiveness, and loading states
5. **Maintain** — GitHub-triggered: analyzes issues, implements fixes, and opens PRs automatically

## Installation

```bash
npm install --save-dev @loewen-digital/sveltekit-orchestrator
```

Requires Node.js >= 22 and an `ANTHROPIC_API_KEY` environment variable.

## Quick Start

```bash
# Create a new project from the starter template
npx orchestrate init my-project
cd my-project

# Interactive discovery — the agent interviews you about your idea
npx orchestrate discover

# Autonomous build — generates and evaluates all features
npx orchestrate build

# Final polish pass
npx orchestrate polish
```

## Commands

| Command                        | Description                                                |
| ------------------------------ | ---------------------------------------------------------- |
| `orchestrate init <name>`      | Scaffold a new SvelteKit project from the starter template |
| `orchestrate discover`         | Interactive discovery phase — writes `briefing.md`         |
| `orchestrate plan`             | Generate `spec.md` and `features.json` from briefing       |
| `orchestrate build`            | Autonomous build loop (Generator → Evaluator per feature)  |
| `orchestrate polish`           | Final quality pass (a11y, responsive, loading states)      |
| `orchestrate maintain <issue>` | Analyze and implement a GitHub issue autonomously          |
| `orchestrate config`           | Show current configuration                                 |

## Configuration

Create `.claude-harness/config.json` in your project root:

```json
{
  "maxRetriesPerFeature": 3,
  "maxTotalIterations": 50,
  "timeoutMinutes": 60,
  "allowedIssueAuthors": [],
  "allowedIssueLabels": ["bug", "feature", "change", "automate"]
}
```

| Option                 | Default   | Range | Description                                                      |
| ---------------------- | --------- | ----- | ---------------------------------------------------------------- |
| `maxRetriesPerFeature` | 3         | 1–10  | Generator/Evaluator attempts per feature                         |
| `maxTotalIterations`   | 50        | 1–500 | Max total iterations across all features                         |
| `timeoutMinutes`       | 60        | 1–480 | Timeout for maintain command                                     |
| `allowedIssueAuthors`  | `[]`      | —     | Restrict which GitHub users can trigger automation (empty = all) |
| `allowedIssueLabels`   | see above | —     | Issue labels that trigger the maintenance loop                   |
| `autoMerge`            | `false`   | —     | Always locked to `false` for safety                              |

## GitHub Automation

The `init` command sets up a GitHub Action that triggers `orchestrate maintain` when labeled issues are created. This enables a fully autonomous loop:

1. Someone creates an issue with the `bug` or `feature` label
2. The action runs `orchestrate maintain <issue-number>`
3. The orchestrator analyzes the issue, implements a fix, and pushes a branch
4. A PR is created automatically via `peter-evans/create-pull-request`

Set `ANTHROPIC_API_KEY` as a repository secret for this to work.

## Programmatic API

The package exports all agents and utilities for custom workflows:

```typescript
import {
  runGeneratorAgent,
  runEvaluatorAgent,
  loadConfig,
  readFeatures,
  getNextFeature,
} from "@loewen-digital/sveltekit-orchestrator";
```

## Architecture

```
src/
├── cli.ts              # CLI entry point (Commander.js)
├── orchestrator.ts     # Public API re-exports
├── agents/             # Agent configurations and runners
│   ├── runner.ts       # Core agent execution (Agent SDK wrapper)
│   ├── discovery.ts    # Product discovery agent
│   ├── planner.ts      # Feature planning agent
│   ├── generator.ts    # Code generation agent
│   ├── evaluator.ts    # Code evaluation agent (read-only)
│   ├── polish.ts       # Quality polish agent
│   └── issue-analyzer.ts
├── commands/           # CLI command implementations
├── prompts/            # System prompts as .md files
├── types/              # TypeScript type definitions
└── utils/              # Features, progress, config, GitHub API, logging
```

## Key Design Decisions

- **Evaluator is read-only** — no Write/Edit tools, preventing self-approval
- **Each agent run = fresh context** — separate `query()` call per agent, no state leakage
- **`autoMerge` locked to `false`** — all PRs require human review
- **Atomic file writes** — features.json uses temp file + rename to prevent corruption
- **Model is always Opus** — consistent quality across all agent roles

## Development

```bash
npm run dev        # tsx watch mode
npm run build      # Compile TypeScript
npm run check      # Type check
npm run lint       # ESLint + Prettier
npm test           # Unit tests (Vitest)
npm run test:e2e   # E2E tests
```

## License

MIT — [Löwen Digital](https://loewen.digital)
