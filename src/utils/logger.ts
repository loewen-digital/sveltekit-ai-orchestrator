import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let logDir: string | null = null;
let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

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

export function logDebug(message: string): void {
  if (!shouldLog("debug")) return;
  console.log(`🔍 ${message}`);
  writeToFile("DEBUG", message);
}

export function logInfo(message: string): void {
  if (!shouldLog("info")) return;
  console.log(`📋 ${message}`);
  writeToFile("INFO", message);
}

export function logSuccess(message: string): void {
  if (!shouldLog("info")) return;
  console.log(`✅ ${message}`);
  writeToFile("SUCCESS", message);
}

export function logError(message: string): void {
  if (!shouldLog("error")) return;
  console.error(`❌ ${message}`);
  writeToFile("ERROR", message);
}

export function logWarning(message: string): void {
  if (!shouldLog("warn")) return;
  console.warn(`⚠️  ${message}`);
  writeToFile("WARN", message);
}

export function logAgent(agentName: string, message: string): void {
  if (!shouldLog("info")) return;
  console.log(`🤖 [${agentName}] ${message}`);
  writeToFile("AGENT", `[${agentName}] ${message}`);
}

export function logPhase(phase: string): void {
  if (!shouldLog("info")) return;
  const separator = "─".repeat(50);
  console.log(`\n${separator}`);
  console.log(`🚀 ${phase}`);
  console.log(`${separator}\n`);
  writeToFile("PHASE", phase);
}
