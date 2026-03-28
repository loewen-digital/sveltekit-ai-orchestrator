import { logPhase, logError, logSuccess } from "../utils/logger.js";
import { runPolishAgent } from "../agents/polish.js";

export async function runPolish(cwd: string): Promise<void> {
  logPhase("Polish Phase");

  const result = await runPolishAgent(cwd);

  if (result.success) {
    logSuccess("Polish abgeschlossen.");
  } else {
    logError("Polish fehlgeschlagen.");
    process.exit(1);
  }
}
