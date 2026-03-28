import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, formatConfig } from "../../src/utils/config.js";
import { DEFAULT_CONFIG } from "../../src/types/config.js";

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
});
