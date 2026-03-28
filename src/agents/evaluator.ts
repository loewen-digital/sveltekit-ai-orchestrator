import { runAgent, loadPrompt } from "./runner.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logWarning } from "../utils/logger.js";
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

  const prompt = `Evaluate feature ${feature.id}: ${feature.title}

Acceptance Criteria:
${acList}

Test each criterion. Write .claude-harness/eval-report.md with the report.

IMPORTANT: The LAST line of eval-report.md MUST look exactly like this (nothing before, nothing after on the line):
VERDICT: PASS
or
VERDICT: FAIL`;

  const result = await runAgent({
    name: `Evaluator[${feature.id}]`,
    prompt,
    systemPrompt,
    // Evaluator has NO Write/Edit tools
    tools: ["Read", "Bash", "Glob", "Grep"],
    cwd,
  });

  const verdict = parseVerdict(result.output, cwd);
  return {
    verdict,
    report: result.output,
  };
}

export function parseVerdict(output: string, cwd?: string): "PASS" | "FAIL" {
  // Primary: read verdict from eval-report.md (structured, not from agent stdout)
  if (cwd) {
    const reportPath = join(cwd, ".claude-harness", "eval-report.md");
    if (existsSync(reportPath)) {
      const report = readFileSync(reportPath, "utf-8").trim();
      const lastLine = report.split("\n").pop()?.trim() ?? "";
      if (lastLine === "VERDICT: PASS") return "PASS";
      if (lastLine === "VERDICT: FAIL") return "FAIL";
      logWarning(
        `eval-report.md last line is not a valid verdict: "${lastLine}"`,
      );
    }
  }

  // Fallback: parse from agent output (last occurrence, exact line match)
  const lines = output.split("\n").reverse();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "VERDICT: PASS") return "PASS";
    if (trimmed === "VERDICT: FAIL") return "FAIL";
  }

  // Default to FAIL if no verdict found
  logWarning("No VERDICT found — defaulting to FAIL");
  return "FAIL";
}
