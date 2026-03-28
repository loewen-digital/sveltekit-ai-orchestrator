import { runAgent, loadPrompt } from "./runner.js";
import type { AgentResult } from "./runner.js";

export async function runPlannerAgent(cwd: string): Promise<AgentResult> {
  const systemPrompt = loadPrompt("planner");

  return runAgent({
    name: "Planner",
    prompt: "Read briefing.md and create .claude-harness/spec.md and .claude-harness/features.json. Foundation features (Auth, DB, Design System) from the starter template are already implemented — do NOT mark them again.",
    systemPrompt,
    tools: ["Read", "Write", "Glob", "Grep"],
    cwd,
  });
}
