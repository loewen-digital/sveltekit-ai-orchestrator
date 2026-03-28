import { existsSync } from "node:fs";
import { join } from "node:path";
import { logPhase, logError, logSuccess, logWarning } from "../utils/logger.js";
import { runDiscoveryAgent } from "../agents/discovery.js";

export async function runDiscover(cwd: string): Promise<void> {
  logPhase("Discovery Phase");

  // Check for idea.md
  const ideaPath = join(cwd, "idea.md");
  if (!existsSync(ideaPath)) {
    logError("idea.md nicht gefunden. Erstelle eine idea.md mit deiner Projektidee.");
    process.exit(1);
  }

  // Warn if briefing.md already exists
  const briefingPath = join(cwd, "briefing.md");
  if (existsSync(briefingPath)) {
    logWarning("briefing.md existiert bereits und wird überschrieben.");
  }

  const result = await runDiscoveryAgent(cwd);

  if (result.success) {
    logSuccess("Discovery abgeschlossen. briefing.md erstellt.");
  } else {
    logError("Discovery fehlgeschlagen.");
    process.exit(1);
  }
}
