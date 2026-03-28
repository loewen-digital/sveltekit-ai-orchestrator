import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseVerdict } from "../../src/agents/evaluator.js";

describe("parseVerdict", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads PASS from eval-report.md last line", () => {
    writeFileSync(
      join(tmpDir, ".claude-harness", "eval-report.md"),
      "# Report\n\nAll tests passed.\n\nVERDICT: PASS",
    );
    expect(parseVerdict("", tmpDir)).toBe("PASS");
  });

  it("reads FAIL from eval-report.md last line", () => {
    writeFileSync(
      join(tmpDir, ".claude-harness", "eval-report.md"),
      "# Report\n\nAC 2 failed.\n\nVERDICT: FAIL",
    );
    expect(parseVerdict("", tmpDir)).toBe("FAIL");
  });

  it("falls back to agent output when eval-report.md is missing", () => {
    expect(parseVerdict("Some output\nVERDICT: PASS", tmpDir)).toBe("PASS");
  });

  it("falls back to agent output when eval-report.md has no verdict", () => {
    writeFileSync(
      join(tmpDir, ".claude-harness", "eval-report.md"),
      "# Report\n\nNo verdict here.",
    );
    expect(parseVerdict("Agent says\nVERDICT: FAIL", tmpDir)).toBe("FAIL");
  });

  it("defaults to FAIL when no verdict found anywhere", () => {
    expect(parseVerdict("No verdict here", tmpDir)).toBe("FAIL");
  });

  it("defaults to FAIL without cwd", () => {
    expect(parseVerdict("No verdict")).toBe("FAIL");
  });

  it("uses exact line match, ignoring VERDICT in code blocks", () => {
    const output = [
      "```",
      "The agent wrote VERDICT: PASS in a code block",
      "```",
      "VERDICT: FAIL",
    ].join("\n");
    expect(parseVerdict(output)).toBe("FAIL");
  });

  it("prefers eval-report.md over agent output", () => {
    writeFileSync(
      join(tmpDir, ".claude-harness", "eval-report.md"),
      "VERDICT: FAIL",
    );
    // Agent output says PASS but file says FAIL — file wins
    expect(parseVerdict("VERDICT: PASS", tmpDir)).toBe("FAIL");
  });
});
