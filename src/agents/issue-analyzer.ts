import { runAgent, loadPrompt } from "./runner.js";
import type { Feature } from "../types/feature.js";
import type { GitHubIssue } from "../types/github.js";
import { logError } from "../utils/logger.js";

export interface AnalyzeResult {
  feature: Feature | null;
  needsClarification: boolean;
  clarificationMessage?: string;
}

export async function analyzeIssue(
  cwd: string,
  issue: GitHubIssue,
): Promise<AnalyzeResult> {
  const systemPrompt = loadPrompt("issue-analyzer");

  const prompt = `Analysiere dieses GitHub Issue:

Issue #${issue.number}: ${issue.title}
Labels: ${issue.labels.join(", ") || "(keine)"}

${issue.body}

Gib NUR valides JSON zurück. Wenn zu unklar: { "NEEDS_CLARIFICATION": "deine Rückfrage" }`;

  const result = await runAgent({
    name: `IssueAnalyzer[#${issue.number}]`,
    prompt,
    systemPrompt,
    tools: ["Read", "Glob", "Grep"],
    cwd,
  });

  return parseAnalyzerOutput(result.output, issue.number);
}

function parseAnalyzerOutput(output: string, issueNumber: number): AnalyzeResult {
  // Try to extract JSON from the output
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    logError("Issue analyzer did not return valid JSON");
    return {
      feature: null,
      needsClarification: true,
      clarificationMessage: "Der Issue Analyzer konnte keine strukturierte Analyse erstellen. Bitte präzisiere das Issue.",
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if ("NEEDS_CLARIFICATION" in parsed) {
      return {
        feature: null,
        needsClarification: true,
        clarificationMessage: String(parsed["NEEDS_CLARIFICATION"]),
      };
    }

    const feature: Feature = {
      id: String(parsed["id"] ?? `M${String(issueNumber).padStart(3, "0")}`),
      title: String(parsed["title"] ?? ""),
      category: (parsed["category"] as Feature["category"]) ?? "core",
      description: String(parsed["description"] ?? ""),
      acceptance_criteria: Array.isArray(parsed["acceptance_criteria"])
        ? (parsed["acceptance_criteria"] as string[])
        : [],
      priority: Number(parsed["priority"] ?? 2),
      depends_on: Array.isArray(parsed["depends_on"])
        ? (parsed["depends_on"] as string[])
        : [],
      passes: false,
      source_issue: issueNumber,
    };

    return { feature, needsClarification: false };
  } catch (error) {
    logError(`Failed to parse issue analyzer output: ${error}`);
    return {
      feature: null,
      needsClarification: true,
      clarificationMessage: "Konnte die Issue-Analyse nicht parsen.",
    };
  }
}
