import { execSync } from "node:child_process";
import { logInfo, logError, logWarning } from "./logger.js";
import type { GitHubIssue, RepoInfo } from "../types/github.js";

let cachedToken: string | undefined;

function getGitHubToken(): string {
  if (cachedToken) return cachedToken;
  const token = process.env["GITHUB_TOKEN"];
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }
  cachedToken = token;
  return token;
}

/** HTTP status codes that should never be retried (client errors except rate limits). */
function isNonRetryableStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 429;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Never retry client errors (4xx) except 429 (rate limit)
      if (isNonRetryableStatus(response.status)) {
        return response;
      }

      // Retry on rate limits (429) and server errors (5xx)
      if (
        response.status === 429 ||
        (response.status >= 500 && response.status < 600)
      ) {
        const retryAfter = response.headers.get("retry-after");
        const delayMs = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(1000 * 2 ** attempt, 30_000);
        logWarning(
          `GitHub API ${response.status} — retry ${attempt + 1}/${maxRetries} in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delayMs = Math.min(1000 * 2 ** attempt, 30_000);
        logWarning(
          `GitHub API network error — retry ${attempt + 1}/${maxRetries} in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError ?? new Error("GitHub API request failed after retries");
}

export function getRepoInfo(cwd: string): RepoInfo {
  try {
    const remote = execSync("git remote get-url origin", {
      cwd,
      encoding: "utf-8",
    }).trim();

    // Handle SSH: git@github.com:owner/repo.git
    const sshMatch = remote.match(/git@github\.com:(.+?)\/(.+?)(?:\.git)?$/);
    if (sshMatch) {
      return { owner: sshMatch[1]!, repo: sshMatch[2]! };
    }

    // Handle HTTPS: https://github.com/owner/repo.git
    const httpsMatch = remote.match(
      /https:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/,
    );
    if (httpsMatch) {
      return { owner: httpsMatch[1]!, repo: httpsMatch[2]! };
    }

    throw new Error(`Could not parse GitHub remote URL: ${remote}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to get repo info: ${msg}`);
  }
}

export async function fetchIssue(
  repoInfo: RepoInfo,
  issueNumber: number,
): Promise<GitHubIssue> {
  const token = getGitHubToken();
  const url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNumber}`;

  logInfo(
    `Fetching issue #${issueNumber} from ${repoInfo.owner}/${repoInfo.repo}`,
  );

  const response = await fetchWithRetry(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "sveltekit-orchestrator",
    },
  });

  if (response.status === 404) {
    throw new Error(`Issue #${issueNumber} not found`);
  }

  if (response.status === 403) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new Error("GitHub API rate limit exceeded");
    }
    throw new Error(
      "GitHub API access forbidden — check your token permissions",
    );
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    number: number;
    title: string;
    body: string | null;
    labels: Array<{ name: string } | string>;
    user: { login: string } | null;
    state: string;
  };

  logInfo(`Fetched issue #${issueNumber}: ${data.title}`);

  return {
    number: data.number,
    title: data.title,
    body: data.body ?? "",
    labels: data.labels.map((l) => (typeof l === "string" ? l : l.name)),
    author: data.user?.login ?? "unknown",
    state: data.state as "open" | "closed",
  };
}

export async function postComment(
  repoInfo: RepoInfo,
  issueNumber: number,
  body: string,
): Promise<void> {
  const token = getGitHubToken();
  const url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNumber}/comments`;

  logInfo(`Posting comment on issue #${issueNumber}`);

  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "sveltekit-orchestrator",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    logError(
      `Failed to post comment: ${response.status} ${response.statusText}`,
    );
    throw new Error(`GitHub API error: ${response.status}`);
  }

  logInfo("Comment posted successfully");
}
