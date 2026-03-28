import { runAgent, loadPrompt } from "./runner.js";
import type { AgentResult } from "./runner.js";

export async function runPolishAgent(cwd: string): Promise<AgentResult> {
  const systemPrompt = loadPrompt("polish");

  return runAgent({
    name: "Polish",
    prompt: "Führe den finalen Polish-Durchgang durch: Loading States, Error States, Responsive Design, Accessibility, Build-Check.",
    systemPrompt,
    tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
    cwd,
  });
}
