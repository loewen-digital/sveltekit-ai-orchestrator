// Re-exports for programmatic use
export { runAgent, loadPrompt } from "./agents/runner.js";
export type { AgentOptions, AgentResult } from "./agents/runner.js";

export { runDiscoveryAgent } from "./agents/discovery.js";
export { runPlannerAgent } from "./agents/planner.js";
export { runGeneratorAgent } from "./agents/generator.js";
export { runEvaluatorAgent } from "./agents/evaluator.js";
export type { EvalResult } from "./agents/evaluator.js";
export { runPolishAgent } from "./agents/polish.js";
export { analyzeIssue } from "./agents/issue-analyzer.js";
export type { AnalyzeResult } from "./agents/issue-analyzer.js";

export { readFeatures, writeFeatures, addFeature, updateFeature, getNextFeature } from "./utils/features.js";
export { appendProgress, readProgress } from "./utils/progress.js";
export { loadConfig, formatConfig } from "./utils/config.js";
export { fetchIssue, postComment, getRepoInfo } from "./utils/github.js";
export { logInfo, logSuccess, logError, logWarning, logAgent, logPhase } from "./utils/logger.js";

export type { Feature, FeaturesFile } from "./types/feature.js";
export type { OrchestratorConfig } from "./types/config.js";
export { DEFAULT_CONFIG } from "./types/config.js";
export type { GitHubIssue, RepoInfo } from "./types/github.js";
