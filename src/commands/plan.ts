import { existsSync } from "node:fs";
import { join } from "node:path";
import { logPhase, logError, logSuccess, logInfo } from "../utils/logger.js";
import { runPlannerAgent } from "../agents/planner.js";
import { readFeatures } from "../utils/features.js";

export async function runPlan(cwd: string): Promise<void> {
  logPhase("Planning Phase");

  const briefingPath = join(cwd, "briefing.md");
  if (!existsSync(briefingPath)) {
    logError("briefing.md not found. Run 'orchestrate discover' first.");
    process.exit(1);
  }

  const result = await runPlannerAgent(cwd);

  if (!result.success) {
    logError("Planning failed.");
    process.exit(1);
  }

  // Show summary
  const features = readFeatures(cwd);
  const categories = new Map<string, number>();
  for (const f of features) {
    categories.set(f.category, (categories.get(f.category) ?? 0) + 1);
  }

  logSuccess(`Planning complete: ${features.length} features planned`);
  for (const [cat, count] of categories) {
    logInfo(`  ${cat}: ${count} features`);
  }
}
