import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

let logDir: string | null = null;

export function initLogDir(cwd: string): void {
  logDir = join(cwd, ".claude-harness", "logs");
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
}

function writeToFile(level: string, message: string): void {
  if (!logDir) return;
  const timestamp = new Date().toISOString();
  const logFile = join(logDir, `orchestrator-${new Date().toISOString().split("T")[0]}.log`);
  appendFileSync(logFile, `[${timestamp}] [${level}] ${message}\n`);
}

export function logInfo(message: string): void {
  console.log(`📋 ${message}`);
  writeToFile("INFO", message);
}

export function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
  writeToFile("SUCCESS", message);
}

export function logError(message: string): void {
  console.error(`❌ ${message}`);
  writeToFile("ERROR", message);
}

export function logWarning(message: string): void {
  console.warn(`⚠️  ${message}`);
  writeToFile("WARN", message);
}

export function logAgent(agentName: string, message: string): void {
  console.log(`🤖 [${agentName}] ${message}`);
  writeToFile("AGENT", `[${agentName}] ${message}`);
}

export function logPhase(phase: string): void {
  const separator = "─".repeat(50);
  console.log(`\n${separator}`);
  console.log(`🚀 ${phase}`);
  console.log(`${separator}\n`);
  writeToFile("PHASE", phase);
}
