import { runAgent, loadPrompt } from "./runner.js";
import type { Feature } from "../types/feature.js";

export interface EvalResult {
  verdict: "PASS" | "FAIL";
  report: string;
}

export async function runEvaluatorAgent(
  cwd: string,
  feature: Feature,
): Promise<EvalResult> {
  const systemPrompt = loadPrompt("evaluator");

  const acList = feature.acceptance_criteria
    .map((ac, i) => `${i + 1}. ${ac}`)
    .join("\n");

  const prompt = `Evaluiere Feature ${feature.id}: ${feature.title}

Acceptance Criteria:
${acList}

Teste jedes Criterion. Schreibe eval-report.md. Letzte Zeile: "VERDICT: PASS" oder "VERDICT: FAIL".`;

  const result = await runAgent({
    name: `Evaluator[${feature.id}]`,
    prompt,
    systemPrompt,
    // Evaluator has NO Write/Edit tools
    tools: ["Read", "Bash", "Glob", "Grep"],
    cwd,
  });

  const verdict = parseVerdict(result.output);
  return {
    verdict,
    report: result.output,
  };
}

function parseVerdict(output: string): "PASS" | "FAIL" {
  // Check last lines for VERDICT
  const lines = output.split("\n").reverse();
  for (const line of lines) {
    if (line.includes("VERDICT: PASS")) return "PASS";
    if (line.includes("VERDICT: FAIL")) return "FAIL";
  }
  // Default to FAIL if no verdict found
  return "FAIL";
}
