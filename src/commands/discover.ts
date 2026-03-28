import { existsSync } from "node:fs";
import { join } from "node:path";
import { logPhase, logError, logSuccess, logWarning } from "../utils/logger.js";
import { runDiscoveryAgent } from "../agents/discovery.js";

export async function runDiscover(cwd: string): Promise<void> {
  logPhase("Discovery Phase");

  // Check for idea.md
  const ideaPath = join(cwd, "idea.md");
  if (!existsSync(ideaPath)) {
    logError("idea.md not found. Create an idea.md with your project idea.");
    process.exit(1);
  }

  // Warn if briefing.md already exists
  const briefingPath = join(cwd, "briefing.md");
  if (existsSync(briefingPath)) {
    logWarning("briefing.md already exists and will be overwritten.");
  }

  const result = await runDiscoveryAgent(cwd);

  if (result.success) {
    logSuccess("Discovery complete. briefing.md created.");
  } else {
    logError("Discovery failed.");
    process.exit(1);
  }
}
