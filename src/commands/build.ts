import { existsSync } from "node:fs";
import { join } from "node:path";
import { logPhase, logError, logSuccess, logInfo, logWarning } from "../utils/logger.js";
import { runPlan } from "./plan.js";
import { readFeatures, updateFeature } from "../utils/features.js";
import { getNextFeature } from "../utils/features.js";
import { appendProgress } from "../utils/progress.js";
import { loadConfig } from "../utils/config.js";
import { runGeneratorAgent } from "../agents/generator.js";
import { runEvaluatorAgent } from "../agents/evaluator.js";

export interface BuildOptions {
  skipPlanning?: boolean;
  dryRun?: boolean;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60_000) % 60;
  const hours = Math.floor(ms / 3_600_000);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function printProgressBar(passed: number, skipped: number, total: number): void {
  const done = passed + skipped;
  const barWidth = 30;
  const filledPass = Math.round((passed / total) * barWidth);
  const filledSkip = Math.round((skipped / total) * barWidth);
  const empty = barWidth - filledPass - filledSkip;
  const bar = "█".repeat(filledPass) + "░".repeat(filledSkip) + "·".repeat(empty);
  const pct = Math.round((done / total) * 100);
  console.log(`\n  Progress: [${bar}] ${pct}% (${passed} passed, ${skipped} skipped, ${total - done} remaining)\n`);
}

export async function runBuild(
  cwd: string,
  options: BuildOptions,
): Promise<void> {
  logPhase("Build Phase");

  // Check for briefing.md
  const briefingPath = join(cwd, "briefing.md");
  if (!existsSync(briefingPath)) {
    logError("briefing.md not found. Run 'orchestrate discover' first.");
    process.exit(1);
  }

  // Run planning if no features.json
  const featuresPath = join(cwd, ".claude-harness", "features.json");
  if (!existsSync(featuresPath) && !options.skipPlanning) {
    logInfo("No features.json found — starting planning phase...");
    await runPlan(cwd);
  }

  const config = loadConfig(cwd);

  // Dry-run mode: show what would be built without running agents
  if (options.dryRun) {
    logPhase("Dry Run — Preview Only");
    const features = readFeatures(cwd);
    const pending = features.filter((f) => !f.passes && !f.skipped);
    const passed = features.filter((f) => f.passes);
    const skipped = features.filter((f) => f.skipped);

    logInfo(`Total features:   ${features.length}`);
    logInfo(`Already passed:   ${passed.length}`);
    logInfo(`Skipped:          ${skipped.length}`);
    logInfo(`Pending:          ${pending.length}`);
    logInfo(`Max retries/feat: ${config.maxRetriesPerFeature}`);
    logInfo(`Max iterations:   ${config.maxTotalIterations}`);
    logInfo("");

    let order = 1;
    // Show execution order by simulating picks without mutating
    const simPassedIds = new Set(features.filter((f) => f.passes).map((f) => f.id));

    for (const f of pending) {
      const depsReady = f.depends_on.every((d) => simPassedIds.has(d));
      const blocked = !depsReady;
      const depStr = f.depends_on.length > 0 ? ` (depends on: ${f.depends_on.join(", ")})` : "";
      const status = blocked ? "BLOCKED" : `#${order++}`;
      logInfo(`  [${status}] ${f.id}: ${f.title}${depStr}`);
      if (!blocked) {
        simPassedIds.add(f.id);
      }
    }

    logSuccess("Dry run complete — no agents were executed.");
    return;
  }

  let totalIterations = 0;
  let passCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  // Count total actionable features for progress display
  const allFeatures = readFeatures(cwd);
  const totalFeatureCount = allFeatures.filter((f) => !f.passes).length;

  // Graceful shutdown on Ctrl+C
  let interrupted = false;
  const onSigint = (): void => {
    logWarning("Ctrl+C received — stopping after current feature...");
    interrupted = true;
  };
  process.on("SIGINT", onSigint);

  try {
    while (totalIterations < config.maxTotalIterations && !interrupted) {
      const feature = getNextFeature(cwd);
      if (!feature) {
        logInfo("No more features to process.");
        break;
      }

      logPhase(`Feature ${feature.id}: ${feature.title}`);
      printProgressBar(passCount, skipCount, totalFeatureCount);

      let attempt = 0;
      let passed = false;
      let evalFeedback: string | undefined;

      while (attempt < config.maxRetriesPerFeature && !passed && !interrupted) {
        attempt++;
        totalIterations++;
        const elapsed = formatDuration(Date.now() - startTime);
        logInfo(`Attempt ${attempt}/${config.maxRetriesPerFeature} (iteration ${totalIterations}/${config.maxTotalIterations}, elapsed: ${elapsed})`);

        // Generator with error recovery
        logInfo(`Generator starting for ${feature.id}...`);
        try {
          await runGeneratorAgent(cwd, feature, evalFeedback);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          logError(`Generator crashed for ${feature.id}: ${errMsg}`);
          appendProgress(cwd, `💥 ${feature.id} ${feature.title} — GENERATOR CRASH (attempt ${attempt}): ${errMsg}`);
          evalFeedback = `Generator crashed with error: ${errMsg}. Please fix the issue and try again.`;
          continue;
        }

        // Evaluator
        logInfo(`Evaluator starting for ${feature.id}...`);
        try {
          const evalResult = await runEvaluatorAgent(cwd, feature);

          if (evalResult.verdict === "PASS") {
            passed = true;
            passCount++;
            updateFeature(cwd, feature.id, { passes: true });
            appendProgress(cwd, `✅ ${feature.id} ${feature.title} — PASS (attempt ${attempt})`);
            logSuccess(`${feature.id} PASS (attempt ${attempt})`);
          } else {
            evalFeedback = evalResult.report;
            appendProgress(cwd, `❌ ${feature.id} ${feature.title} — FAIL (attempt ${attempt})`);
            logWarning(`${feature.id} FAIL (attempt ${attempt})`);
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          logError(`Evaluator crashed for ${feature.id}: ${errMsg}`);
          appendProgress(cwd, `💥 ${feature.id} ${feature.title} — EVALUATOR CRASH (attempt ${attempt}): ${errMsg}`);
          evalFeedback = `Evaluator crashed with error: ${errMsg}. There may be build or runtime errors to fix.`;
        }
      }

      if (!passed && !interrupted) {
        skipCount++;
        failCount++;
        updateFeature(cwd, feature.id, { skipped: true });
        appendProgress(cwd, `⏭️ ${feature.id} ${feature.title} — SKIPPED after ${attempt} attempts`);
        logWarning(`${feature.id} skipped after ${attempt} failed attempts`);
      }
    }
  } finally {
    process.off("SIGINT", onSigint);
  }

  // Summary
  const features = readFeatures(cwd);
  const totalFeatures = features.filter((f) => !f.skipped).length;
  const elapsed = formatDuration(Date.now() - startTime);

  logPhase("Build Summary");
  printProgressBar(passCount, skipCount, totalFeatureCount);
  logInfo(`Features completed:  ${passCount}/${totalFeatures}`);
  logInfo(`Features skipped:    ${skipCount}`);
  logInfo(`Total iterations:    ${totalIterations}`);
  logInfo(`Total time:          ${elapsed}`);

  if (failCount > 0) {
    logWarning(`${failCount} features could not be implemented.`);
    process.exit(1);
  } else {
    logSuccess("All features implemented successfully!");
  }
}
