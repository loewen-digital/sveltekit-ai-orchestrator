import { logPhase, logError, logSuccess } from "../utils/logger.js";
import { runPolishAgent } from "../agents/polish.js";

export async function runPolish(cwd: string): Promise<void> {
  logPhase("Polish Phase");

  const result = await runPolishAgent(cwd);

  if (result.success) {
    logSuccess("Polish complete.");
  } else {
    logError("Polish failed.");
    process.exit(1);
  }
}
