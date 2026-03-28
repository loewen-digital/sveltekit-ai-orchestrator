import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendProgress, readProgress } from "../../src/utils/progress.js";

describe("progress", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("readProgress returns empty string when no file", () => {
    expect(readProgress(tmpDir)).toBe("");
  });

  it("appendProgress creates file and adds timestamped entry", () => {
    appendProgress(tmpDir, "✅ F001 Test — PASS");
    const content = readProgress(tmpDir);
    expect(content).toContain("F001 Test — PASS");
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
  });

  it("appendProgress is append-only", () => {
    appendProgress(tmpDir, "First");
    appendProgress(tmpDir, "Second");
    const content = readProgress(tmpDir);
    expect(content).toContain("First");
    expect(content).toContain("Second");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});
