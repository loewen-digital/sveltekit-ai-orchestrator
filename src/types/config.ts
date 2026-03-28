export interface OrchestratorConfig {
  maxRetriesPerFeature: number;
  maxTotalIterations: number;
  timeoutMinutes: number;
  allowedIssueAuthors: string[];
  allowedIssueLabels: string[];
  autoMerge: false;
}

export const DEFAULT_CONFIG: OrchestratorConfig = {
  maxRetriesPerFeature: 3,
  maxTotalIterations: 50,
  timeoutMinutes: 60,
  allowedIssueAuthors: [],
  allowedIssueLabels: ["bug", "feature", "change", "automate"],
  autoMerge: false,
};
