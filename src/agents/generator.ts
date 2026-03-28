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

  let prompt = `Implement feature ${feature.id}: ${feature.title}

Description: ${feature.description}

Acceptance Criteria:
${acList}`;

  if (evalFeedback) {
    prompt = `EVALUATOR FEEDBACK (previous attempt FAILED):
---
${evalFeedback}
---

Fix the issues and implement:

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
