export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  author: string;
  state: "open" | "closed";
}

export interface RepoInfo {
  owner: string;
  repo: string;
}
