export interface OrchestratorConfig {
  schemaVersion?: number;
  maxRetriesPerFeature: number;
  maxTotalIterations: number;
  timeoutMinutes: number;
  allowedIssueAuthors: string[];
  allowedIssueLabels: string[];
  autoMerge: false;
}

export const CURRENT_CONFIG_VERSION = 1;

export const DEFAULT_CONFIG: OrchestratorConfig = {
  schemaVersion: CURRENT_CONFIG_VERSION,
  maxRetriesPerFeature: 3,
  maxTotalIterations: 50,
  timeoutMinutes: 60,
  allowedIssueAuthors: [],
  allowedIssueLabels: ["bug", "feature", "change", "automate"],
  autoMerge: false,
};
