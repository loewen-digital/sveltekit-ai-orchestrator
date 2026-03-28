import { runAgent, loadPrompt } from "./runner.js";
import type { AgentResult } from "./runner.js";

export async function runPlannerAgent(cwd: string): Promise<AgentResult> {
  const systemPrompt = loadPrompt("planner");

  return runAgent({
    name: "Planner",
    prompt: "Lies briefing.md und erstelle .claude-harness/spec.md sowie .claude-harness/features.json. Foundation-Features (Auth, DB, Design System) aus dem Starter Template sind bereits implementiert — markiere sie NICHT nochmal.",
    systemPrompt,
    tools: ["Read", "Write", "Glob", "Grep"],
    cwd,
  });
}
