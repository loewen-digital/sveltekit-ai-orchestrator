import { runAgent, loadPrompt } from "./runner.js";
import type { AgentResult } from "./runner.js";

export async function runDiscoveryAgent(cwd: string): Promise<AgentResult> {
  const systemPrompt = loadPrompt("discovery");

  return runAgent({
    name: "Discovery",
    prompt: "Read idea.md and start the discovery phase. Ask the user targeted questions (max 8), then write briefing.md.",
    systemPrompt,
    tools: ["Read", "Write", "Glob", "AskUserQuestion"],
    interactive: true,
    cwd,
  });
}
