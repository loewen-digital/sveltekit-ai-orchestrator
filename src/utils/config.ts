import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { type OrchestratorConfig, DEFAULT_CONFIG } from "../types/config.js";

export function loadConfig(cwd: string): OrchestratorConfig {
  const configPath = join(cwd, ".claude-harness", "config.json");

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(configPath, "utf-8");
  const userConfig = JSON.parse(raw) as Partial<OrchestratorConfig>;

  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    autoMerge: false, // Always enforce false
  };
}

export function formatConfig(config: OrchestratorConfig): string {
  const lines = [
    "📋 Orchestrator Configuration:",
    "",
    `  maxRetriesPerFeature: ${config.maxRetriesPerFeature}`,
    `  maxTotalIterations:   ${config.maxTotalIterations}`,
    `  timeoutMinutes:       ${config.timeoutMinutes}`,
    `  allowedIssueAuthors:  ${config.allowedIssueAuthors.length === 0 ? "(none)" : config.allowedIssueAuthors.join(", ")}`,
    `  allowedIssueLabels:   ${config.allowedIssueLabels.join(", ")}`,
    `  autoMerge:            ${config.autoMerge} (locked)`,
  ];
  return lines.join("\n");
}
