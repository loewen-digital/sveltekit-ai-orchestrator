import { execSync } from "node:child_process";
import { logPhase, logError, logSuccess, logInfo, logWarning } from "../utils/logger.js";
import { loadConfig } from "../utils/config.js";
import { addFeature, updateFeature } from "../utils/features.js";
import { appendProgress } from "../utils/progress.js";
import { fetchIssue, postComment, getRepoInfo } from "../utils/github.js";
import { analyzeIssue } from "../agents/issue-analyzer.js";
import { runGeneratorAgent } from "../agents/generator.js";
import { runEvaluatorAgent } from "../agents/evaluator.js";

export async function runMaintain(cwd: string, issueNumber: number): Promise<void> {
  logPhase(`Maintenance: Issue #${issueNumber}`);

  const config = loadConfig(cwd);
  const repoInfo = getRepoInfo(cwd);

  // Fetch issue
  const issue = await fetchIssue(repoInfo, issueNumber);

  // Safety: Check allowed authors
  if (config.allowedIssueAuthors.length > 0) {
    if (!config.allowedIssueAuthors.includes(issue.author)) {
      logError(`Issue-Autor "${issue.author}" ist nicht in der allowedIssueAuthors Liste.`);
      process.exit(1);
    }
  }

  // Analyze issue
  logInfo("Issue analysieren...");
  const analysis = await analyzeIssue(cwd, issue);

  if (analysis.needsClarification) {
    logWarning("Issue ist zu unklar — poste Rückfrage...");
    await postComment(
      repoInfo,
      issueNumber,
      `🤖 **Automatische Analyse**\n\nDieses Issue benötigt mehr Details:\n\n${analysis.clarificationMessage}\n\n---\n*Generiert von sveltekit-orchestrator*`,
    );
    process.exit(0);
  }

  if (!analysis.feature) {
    logError("Issue-Analyse hat kein Feature erstellt.");
    process.exit(1);
  }

  // Create feature branch
  const branchName = `auto/issue-${issueNumber}`;
  logInfo(`Feature Branch erstellen: ${branchName}`);
  try {
    execSync(`git checkout -b ${branchName}`, { cwd, stdio: "pipe" });
  } catch {
    // Branch might already exist
    execSync(`git checkout ${branchName}`, { cwd, stdio: "pipe" });
  }

  // Add feature to features.json
  addFeature(cwd, analysis.feature);

  // Build loop
  const feature = analysis.feature;
  let attempt = 0;
  let passed = false;
  let evalFeedback: string | undefined;

  const timeout = setTimeout(() => {
    logError(`Timeout nach ${config.timeoutMinutes} Minuten`);
    process.exit(1);
  }, config.timeoutMinutes * 60 * 1000);
  timeout.unref();

  while (attempt < config.maxRetriesPerFeature && !passed) {
    attempt++;
    logInfo(`Generator/Evaluator Versuch ${attempt}/${config.maxRetriesPerFeature}`);

    await runGeneratorAgent(cwd, feature, evalFeedback);
    const evalResult = await runEvaluatorAgent(cwd, feature);

    if (evalResult.verdict === "PASS") {
      passed = true;
      updateFeature(cwd, feature.id, { passes: true });
      appendProgress(cwd, `✅ ${feature.id} (Issue #${issueNumber}) — PASS (Versuch ${attempt})`);
    } else {
      evalFeedback = evalResult.report;
      appendProgress(cwd, `❌ ${feature.id} (Issue #${issueNumber}) — FAIL (Versuch ${attempt})`);
    }
  }

  clearTimeout(timeout);

  if (passed) {
    // Commit + Push
    logInfo("Änderungen committen und pushen...");
    execSync("git add -A", { cwd, stdio: "pipe" });
    execSync(
      `git commit -m "feat: resolve #${issueNumber} — ${feature.title}"`,
      { cwd, stdio: "pipe" },
    );
    execSync(`git push -u origin ${branchName}`, { cwd, stdio: "pipe" });

    // Comment on issue
    const acList = feature.acceptance_criteria.map((ac) => `- ✅ ${ac}`).join("\n");
    await postComment(
      repoInfo,
      issueNumber,
      `🤖 **Automatisch implementiert**\n\nAlle Acceptance Criteria getestet und bestanden:\n\n${acList}\n\nBranch: \`${branchName}\`\n\n---\n*Generiert von sveltekit-orchestrator*`,
    );

    logSuccess(`Issue #${issueNumber} erfolgreich bearbeitet. Branch: ${branchName}`);
  } else {
    // Comment failure on issue
    await postComment(
      repoInfo,
      issueNumber,
      `🤖 **Automatische Implementierung fehlgeschlagen**\n\nNach ${attempt} Versuchen konnte das Issue nicht vollständig gelöst werden.\n\nLetzter Eval Report:\n\`\`\`\n${evalFeedback?.slice(0, 2000) ?? "Kein Report verfügbar"}\n\`\`\`\n\n---\n*Generiert von sveltekit-orchestrator*`,
    );

    logError(`Issue #${issueNumber} konnte nach ${attempt} Versuchen nicht gelöst werden.`);
    process.exit(1);
  }
}
