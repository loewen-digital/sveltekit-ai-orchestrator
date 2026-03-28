import {
  appendFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  renameSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const MAX_PROGRESS_SIZE_BYTES = 512 * 1024; // 512 KB

function getProgressPath(cwd: string): string {
  return join(cwd, ".claude-harness", "progress.md");
}

function ensureHarnessDir(cwd: string): void {
  const dir = join(cwd, ".claude-harness");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function rotateIfNeeded(filePath: string): void {
  if (!existsSync(filePath)) return;
  try {
    const stats = statSync(filePath);
    if (stats.size > MAX_PROGRESS_SIZE_BYTES) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const archivePath = filePath.replace(".md", `-${timestamp}.md`);
      renameSync(filePath, archivePath);
    }
  } catch {
    // Non-critical — continue without rotation
  }
}

export function appendProgress(cwd: string, message: string): void {
  ensureHarnessDir(cwd);
  const filePath = getProgressPath(cwd);
  rotateIfNeeded(filePath);
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
