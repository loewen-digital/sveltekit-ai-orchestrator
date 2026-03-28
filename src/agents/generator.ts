import { runAgent, loadPrompt } from "./runner.js";
import type { AgentResult } from "./runner.js";
import type { Feature } from "../types/feature.js";

export async function runGeneratorAgent(
  cwd: string,
  feature: Feature,
  evalFeedback?: string,
): Promise<AgentResult> {
  const systemPrompt = loadPrompt("generator");

  const acList = feature.acceptance_criteria
    .map((ac, i) => `${i + 1}. ${ac}`)
    .join("\n");

  let prompt = `Implementiere Feature ${feature.id}: ${feature.title}

Beschreibung: ${feature.description}

Acceptance Criteria:
${acList}`;

  if (evalFeedback) {
    prompt = `EVALUATOR FEEDBACK (vorheriger Versuch FAIL):
---
${evalFeedback}
---

Fixe die Probleme und implementiere:

${prompt}`;
  }

  return runAgent({
    name: `Generator[${feature.id}]`,
    prompt,
    systemPrompt,
    tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    cwd,
  });
}
