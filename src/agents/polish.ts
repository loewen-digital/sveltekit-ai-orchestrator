import { runAgent, loadPrompt } from "./runner.js";
import type { AgentResult } from "./runner.js";

export async function runPolishAgent(cwd: string): Promise<AgentResult> {
  const systemPrompt = loadPrompt("polish");

  return runAgent({
    name: "Polish",
    prompt: "Run the final polish pass: loading states, error states, responsive design, accessibility, build check.",
    systemPrompt,
    tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    cwd,
  });
}
