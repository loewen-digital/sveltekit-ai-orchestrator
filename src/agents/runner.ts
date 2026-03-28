import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logAgent, logError, initLogDir } from "../utils/logger.js";

export interface AgentOptions {
  name: string;
  prompt: string;
  systemPrompt: string;
  tools: string[];
  interactive?: boolean;
  cwd?: string;
  timeoutMs?: number;
}

export interface AgentResult {
  output: string;
  success: boolean;
}

export function loadPrompt(promptName: string): string {
  // Try loading from the package's prompts directory
  const possiblePaths = [
    join(import.meta.dirname ?? ".", "prompts", `${promptName}.md`),
    join(
      import.meta.dirname ?? ".",
      "..",
      "src",
      "prompts",
      `${promptName}.md`,
    ),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return readFileSync(p, "utf-8");
    }
  }

  throw new Error(
    `Prompt file not found for: "${promptName}". Tried:\n${possiblePaths.map((p) => `  - ${p}`).join("\n")}`,
  );
}

export async function runAgent(options: AgentOptions): Promise<AgentResult> {
  const {
    name,
    prompt,
    systemPrompt,
    tools,
    interactive = false,
    cwd = process.cwd(),
    timeoutMs = 60 * 60 * 1000, // 60 minutes default
  } = options;

  initLogDir(cwd);
  logAgent(name, "Starting agent run...");

  const outputParts: string[] = [];
  let success = true;

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Agent ${name} timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    // Allow Node to exit even if timeout is pending
    timer.unref();
  });

  try {
    const agentPromise = (async () => {
      for await (const message of query({
        prompt,
        options: {
          cwd,
          allowedTools: tools,
          permissionMode: interactive ? "default" : "acceptEdits",
          settingSources: ["project"],
          model: "claude-opus-4-6",
          systemPrompt,
        },
      })) {
        if ("result" in message) {
          outputParts.push(message.result);
          logAgent(
            name,
            `Completed with result (${message.result.length} chars)`,
          );
        }
      }
    })();

    await Promise.race([agentPromise, timeoutPromise]);
  } catch (error) {
    success = false;
    const errMsg = error instanceof Error ? error.message : String(error);
    logError(`Agent ${name} failed: ${errMsg}`);
    outputParts.push(`ERROR: ${errMsg}`);
  }

  const output = outputParts.join("\n");
  logAgent(
    name,
    success ? "Agent run completed successfully" : "Agent run failed",
  );

  return { output, success };
}
