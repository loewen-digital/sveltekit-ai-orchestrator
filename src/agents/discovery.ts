import { runAgent, loadPrompt } from "./runner.js";
import type { AgentResult } from "./runner.js";

export async function runDiscoveryAgent(cwd: string): Promise<AgentResult> {
  const systemPrompt = loadPrompt("discovery");

  return runAgent({
    name: "Discovery",
    prompt: "Lies idea.md und starte die Discovery Phase. Stelle dem User gezielte Fragen (max 8) und schreibe dann briefing.md.",
    systemPrompt,
    tools: ["Read", "Write", "Glob", "AskUserQuestion"],
    interactive: true,
    cwd,
  });
}
