import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, formatConfig } from "../../src/utils/config.js";
import { DEFAULT_CONFIG } from "../../src/types/config.js";

// Suppress logWarning output during tests
vi.mock("../../src/utils/logger.js", () => ({
  logWarning: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  logSuccess: vi.fn(),
  logAgent: vi.fn(),
  logPhase: vi.fn(),
  initLogDir: vi.fn(),
}));

describe("config", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when no config file exists", () => {
    const config = loadConfig(tmpDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("merges user config with defaults", () => {
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude-harness", "config.json"),
      JSON.stringify({ maxRetriesPerFeature: 5 }),
    );
    const config = loadConfig(tmpDir);
    expect(config.maxRetriesPerFeature).toBe(5);
    expect(config.maxTotalIterations).toBe(50); // default preserved
  });

  it("always enforces autoMerge: false", () => {
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude-harness", "config.json"),
      JSON.stringify({ autoMerge: true }),
    );
    const config = loadConfig(tmpDir);
    expect(config.autoMerge).toBe(false);
  });

  it("formatConfig returns readable string", () => {
    const output = formatConfig(DEFAULT_CONFIG);
    expect(output).toContain("maxRetriesPerFeature");
    expect(output).toContain("autoMerge");
    expect(output).toContain("(locked)");
  });

  it("clamps negative maxRetriesPerFeature to 1", () => {
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude-harness", "config.json"),
      JSON.stringify({ maxRetriesPerFeature: -5 }),
    );
    const config = loadConfig(tmpDir);
    expect(config.maxRetriesPerFeature).toBe(1);
  });

  it("clamps excessively high maxRetriesPerFeature to 10", () => {
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude-harness", "config.json"),
      JSON.stringify({ maxRetriesPerFeature: 999 }),
    );
    const config = loadConfig(tmpDir);
    expect(config.maxRetriesPerFeature).toBe(10);
  });

  it("clamps negative timeoutMinutes to 1", () => {
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude-harness", "config.json"),
      JSON.stringify({ timeoutMinutes: -10 }),
    );
    const config = loadConfig(tmpDir);
    expect(config.timeoutMinutes).toBe(1);
  });

  it("clamps timeoutMinutes above 480 to 480", () => {
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude-harness", "config.json"),
      JSON.stringify({ timeoutMinutes: 9999 }),
    );
    const config = loadConfig(tmpDir);
    expect(config.timeoutMinutes).toBe(480);
  });

  it("falls back to default for non-numeric values", () => {
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude-harness", "config.json"),
      JSON.stringify({
        maxRetriesPerFeature: "not a number",
        maxTotalIterations: null,
      }),
    );
    const config = loadConfig(tmpDir);
    expect(config.maxRetriesPerFeature).toBe(
      DEFAULT_CONFIG.maxRetriesPerFeature,
    );
    expect(config.maxTotalIterations).toBe(DEFAULT_CONFIG.maxTotalIterations);
  });

  it("filters non-string entries from allowedIssueAuthors", () => {
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude-harness", "config.json"),
      JSON.stringify({
        allowedIssueAuthors: ["valid", 123, null, "also-valid"],
      }),
    );
    const config = loadConfig(tmpDir);
    expect(config.allowedIssueAuthors).toEqual(["valid", "also-valid"]);
  });

  it("falls back to default for non-array allowedIssueLabels", () => {
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude-harness", "config.json"),
      JSON.stringify({ allowedIssueLabels: "not-an-array" }),
    );
    const config = loadConfig(tmpDir);
    expect(config.allowedIssueLabels).toEqual(
      DEFAULT_CONFIG.allowedIssueLabels,
    );
  });
});
