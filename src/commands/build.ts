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

export async function runBuild(
  cwd: string,
  options: { skipPlanning?: boolean },
): Promise<void> {
  logPhase("Build Phase");

  // Check for briefing.md
  const briefingPath = join(cwd, "briefing.md");
  if (!existsSync(briefingPath)) {
    logError("briefing.md nicht gefunden. Führe erst 'orchestrate discover' aus.");
    process.exit(1);
  }

  // Run planning if no features.json
  const featuresPath = join(cwd, ".claude-harness", "features.json");
  if (!existsSync(featuresPath) && !options.skipPlanning) {
    logInfo("Keine features.json gefunden — starte Planning Phase...");
    await runPlan(cwd);
  }

  const config = loadConfig(cwd);
  let totalIterations = 0;
  let passCount = 0;
  let skipCount = 0;
  let failCount = 0;

  // Graceful shutdown on Ctrl+C
  let interrupted = false;
  const onSigint = (): void => {
    logWarning("Ctrl+C empfangen — breche nach aktuellem Feature ab...");
    interrupted = true;
  };
  process.on("SIGINT", onSigint);

  try {
    while (totalIterations < config.maxTotalIterations && !interrupted) {
      const feature = getNextFeature(cwd);
      if (!feature) {
        logInfo("Keine weiteren Features zu bearbeiten.");
        break;
      }

      logPhase(`Feature ${feature.id}: ${feature.title}`);
      let attempt = 0;
      let passed = false;
      let evalFeedback: string | undefined;

      while (attempt < config.maxRetriesPerFeature && !passed && !interrupted) {
        attempt++;
        totalIterations++;
        logInfo(`Versuch ${attempt}/${config.maxRetriesPerFeature} (Iteration ${totalIterations}/${config.maxTotalIterations})`);

        // Generator
        logInfo(`Generator startet für ${feature.id}...`);
        await runGeneratorAgent(cwd, feature, evalFeedback);

        // Evaluator
        logInfo(`Evaluator startet für ${feature.id}...`);
        const evalResult = await runEvaluatorAgent(cwd, feature);

        if (evalResult.verdict === "PASS") {
          passed = true;
          passCount++;
          updateFeature(cwd, feature.id, { passes: true });
          appendProgress(cwd, `✅ ${feature.id} ${feature.title} — PASS (Versuch ${attempt})`);
          logSuccess(`${feature.id} PASS (Versuch ${attempt})`);
        } else {
          evalFeedback = evalResult.report;
          appendProgress(cwd, `❌ ${feature.id} ${feature.title} — FAIL (Versuch ${attempt})`);
          logWarning(`${feature.id} FAIL (Versuch ${attempt})`);
        }
      }

      if (!passed && !interrupted) {
        skipCount++;
        failCount++;
        updateFeature(cwd, feature.id, { skipped: true });
        appendProgress(cwd, `⏭️ ${feature.id} ${feature.title} — SKIPPED nach ${attempt} Versuchen`);
        logWarning(`${feature.id} übersprungen nach ${attempt} fehlgeschlagenen Versuchen`);
      }
    }
  } finally {
    process.off("SIGINT", onSigint);
  }

  // Summary
  const features = readFeatures(cwd);
  const totalFeatures = features.filter((f) => !f.skipped).length;

  logPhase("Build Zusammenfassung");
  logInfo(`Features fertig:      ${passCount}/${totalFeatures}`);
  logInfo(`Features übersprungen: ${skipCount}`);
  logInfo(`Total Iterationen:    ${totalIterations}`);

  if (failCount > 0) {
    logWarning(`${failCount} Features konnten nicht implementiert werden.`);
    process.exit(1);
  } else {
    logSuccess("Alle Features erfolgreich implementiert!");
  }
}
