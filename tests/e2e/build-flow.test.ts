import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeFeatures,
  readFeatures,
  getNextFeature,
  updateFeature,
} from "../../src/utils/features.js";
import { appendProgress, readProgress } from "../../src/utils/progress.js";
import { loadConfig } from "../../src/utils/config.js";
import type { Feature } from "../../src/types/feature.js";

// Mock logger to suppress output
vi.mock("../../src/utils/logger.js", () => ({
  logWarning: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  logSuccess: vi.fn(),
  logAgent: vi.fn(),
  logPhase: vi.fn(),
  initLogDir: vi.fn(),
}));

function makeFeature(overrides: Partial<Feature> = {}): Feature {
  return {
    id: "F001",
    title: "Test Feature",
    category: "core",
    description: "A test feature",
    acceptance_criteria: ["AC 1", "AC 2"],
    priority: 1,
    depends_on: [],
    passes: false,
    ...overrides,
  };
}

describe("build flow (e2e, no Agent SDK)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "orch-e2e-"));
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("simulates a full build loop: pick feature, mark pass, pick next", () => {
    const features = [
      makeFeature({ id: "F001", priority: 1, title: "Auth System" }),
      makeFeature({
        id: "F002",
        priority: 2,
        title: "Dashboard",
        depends_on: ["F001"],
      }),
      makeFeature({ id: "F003", priority: 3, title: "Settings" }),
    ];
    writeFeatures(tmpDir, features);

    // Iteration 1: F001 should be picked (lowest priority, no deps)
    const first = getNextFeature(tmpDir);
    expect(first?.id).toBe("F001");

    // Simulate: generator runs, evaluator says PASS
    updateFeature(tmpDir, "F001", { passes: true });
    appendProgress(tmpDir, "✅ F001 Auth System — PASS (Versuch 1)");

    // Iteration 2: F002 is now unblocked (depends_on F001 which passed)
    // But F003 has lower priority (3 vs 2)... actually F002 has priority 2, F003 has priority 3
    // So F002 should be next
    const second = getNextFeature(tmpDir);
    expect(second?.id).toBe("F002");

    updateFeature(tmpDir, "F002", { passes: true });
    appendProgress(tmpDir, "✅ F002 Dashboard — PASS (Versuch 1)");

    // Iteration 3: F003
    const third = getNextFeature(tmpDir);
    expect(third?.id).toBe("F003");

    updateFeature(tmpDir, "F003", { passes: true });
    appendProgress(tmpDir, "✅ F003 Settings — PASS (Versuch 1)");

    // No more features
    expect(getNextFeature(tmpDir)).toBeUndefined();

    // Verify progress log
    const progress = readProgress(tmpDir);
    expect(progress).toContain("F001");
    expect(progress).toContain("F002");
    expect(progress).toContain("F003");
    const lines = progress.trim().split("\n");
    expect(lines).toHaveLength(3);
  });

  it("simulates retry loop: FAIL then PASS", () => {
    writeFeatures(tmpDir, [makeFeature({ id: "F001" })]);
    const config = loadConfig(tmpDir);

    const feature = getNextFeature(tmpDir)!;
    expect(feature).toBeDefined();

    // Attempt 1: FAIL
    appendProgress(tmpDir, `❌ ${feature.id} — FAIL (Versuch 1)`);

    // Attempt 2: PASS
    updateFeature(tmpDir, feature.id, { passes: true });
    appendProgress(tmpDir, `✅ ${feature.id} — PASS (Versuch 2)`);

    // Feature is done
    expect(getNextFeature(tmpDir)).toBeUndefined();
    expect(config.maxRetriesPerFeature).toBeGreaterThanOrEqual(2);
  });

  it("simulates skip after max retries", () => {
    writeFeatures(tmpDir, [
      makeFeature({ id: "F001", priority: 1 }),
      makeFeature({ id: "F002", priority: 2 }),
    ]);

    // Simulate F001 failing all retries
    updateFeature(tmpDir, "F001", { skipped: true });
    appendProgress(tmpDir, "⏭️ F001 — SKIPPED nach 3 Versuchen");

    // F002 should still be available
    const next = getNextFeature(tmpDir);
    expect(next?.id).toBe("F002");
  });

  it("blocked feature stays blocked until dependency passes", () => {
    writeFeatures(tmpDir, [
      makeFeature({ id: "F001", priority: 1 }),
      makeFeature({ id: "F002", priority: 2, depends_on: ["F001"] }),
    ]);

    // F001 is first (F002 is blocked)
    expect(getNextFeature(tmpDir)?.id).toBe("F001");

    // Skip F001 — F002 stays blocked because dep didn't pass
    updateFeature(tmpDir, "F001", { skipped: true });
    // F002 depends on F001 which is skipped (not passed), so it should not be available
    const features = readFeatures(tmpDir);
    const f001 = features.find((f) => f.id === "F001")!;
    expect(f001.skipped).toBe(true);
    expect(f001.passes).toBe(false);
    // getNextFeature checks passes, not skipped for dependency resolution
    expect(getNextFeature(tmpDir)).toBeUndefined();
  });

  it("config + features + progress work together", () => {
    // Write custom config
    writeFileSync(
      join(tmpDir, ".claude-harness", "config.json"),
      JSON.stringify({ maxRetriesPerFeature: 5, timeoutMinutes: 120 }),
    );

    const config = loadConfig(tmpDir);
    expect(config.maxRetriesPerFeature).toBe(5);
    expect(config.timeoutMinutes).toBe(120);
    expect(config.autoMerge).toBe(false);

    // Write features
    writeFeatures(tmpDir, [makeFeature()]);
    expect(readFeatures(tmpDir)).toHaveLength(1);

    // Write progress
    appendProgress(tmpDir, "Test entry");
    expect(readProgress(tmpDir)).toContain("Test entry");
  });
});
