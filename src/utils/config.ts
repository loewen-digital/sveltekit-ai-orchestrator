import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { type OrchestratorConfig, DEFAULT_CONFIG } from "../types/config.js";
import { logWarning } from "./logger.js";

function clampWithWarning(
  name: string,
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    if (value !== undefined) {
      logWarning(
        `Config "${name}" ist keine gültige Zahl (${String(value)}), nutze Default: ${fallback}`,
      );
    }
    return fallback;
  }
  if (value < min || value > max) {
    logWarning(
      `Config "${name}" = ${value} ist außerhalb des Bereichs [${min}–${max}], clamped.`,
    );
    return Math.max(min, Math.min(max, value));
  }
  return value;
}

export function loadConfig(cwd: string): OrchestratorConfig {
  const configPath = join(cwd, ".claude-harness", "config.json");

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(configPath, "utf-8");
  const userConfig = JSON.parse(raw) as Partial<OrchestratorConfig>;

  return validateConfig({
    ...DEFAULT_CONFIG,
    ...userConfig,
    autoMerge: false, // Always enforce false
  });
}

function validateConfig(config: OrchestratorConfig): OrchestratorConfig {
  return {
    maxRetriesPerFeature: clampWithWarning(
      "maxRetriesPerFeature",
      config.maxRetriesPerFeature,
      1,
      10,
      DEFAULT_CONFIG.maxRetriesPerFeature,
    ),
    maxTotalIterations: clampWithWarning(
      "maxTotalIterations",
      config.maxTotalIterations,
      1,
      500,
      DEFAULT_CONFIG.maxTotalIterations,
    ),
    timeoutMinutes: clampWithWarning(
      "timeoutMinutes",
      config.timeoutMinutes,
      1,
      480,
      DEFAULT_CONFIG.timeoutMinutes,
    ),
    allowedIssueAuthors: Array.isArray(config.allowedIssueAuthors)
      ? config.allowedIssueAuthors.filter(
          (a): a is string => typeof a === "string",
        )
      : DEFAULT_CONFIG.allowedIssueAuthors,
    allowedIssueLabels: Array.isArray(config.allowedIssueLabels)
      ? config.allowedIssueLabels.filter(
          (l): l is string => typeof l === "string",
        )
      : DEFAULT_CONFIG.allowedIssueLabels,
    autoMerge: false,
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
