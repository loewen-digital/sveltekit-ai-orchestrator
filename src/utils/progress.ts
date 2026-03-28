import { appendFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

function getProgressPath(cwd: string): string {
  return join(cwd, ".claude-harness", "progress.md");
}

function ensureHarnessDir(cwd: string): void {
  const dir = join(cwd, ".claude-harness");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function appendProgress(cwd: string, message: string): void {
  ensureHarnessDir(cwd);
  const filePath = getProgressPath(cwd);
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  appendFileSync(filePath, line, "utf-8");
  console.log(`📝 ${message}`);
}

export function readProgress(cwd: string): string {
  const filePath = getProgressPath(cwd);
  if (!existsSync(filePath)) {
    return "";
  }
  return readFileSync(filePath, "utf-8");
}
