import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readFeatures,
  writeFeatures,
  addFeature,
  updateFeature,
  getNextFeature,
  detectCircularDependencies,
} from "../../src/utils/features.js";
import type { Feature } from "../../src/types/feature.js";

// Mock logger to suppress output
vi.mock("../../src/utils/logger.js", () => ({
  logDebug: vi.fn(),
  logWarning: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  logSuccess: vi.fn(),
  logAgent: vi.fn(),
  logPhase: vi.fn(),
  initLogDir: vi.fn(),
  setLogLevel: vi.fn(),
  getLogLevel: vi.fn(),
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

describe("features", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "orch-test-"));
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("readFeatures returns empty array when no file", () => {
    expect(readFeatures(tmpDir)).toEqual([]);
  });

  it("writeFeatures + readFeatures roundtrips", () => {
    const features = [makeFeature(), makeFeature({ id: "F002", title: "Second" })];
    writeFeatures(tmpDir, features);
    const result = readFeatures(tmpDir);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("F001");
    expect(result[1]!.id).toBe("F002");
  });

  it("writeFeatures uses 2-space indentation", () => {
    writeFeatures(tmpDir, [makeFeature()]);
    const raw = readFileSync(
      join(tmpDir, ".claude-harness", "features.json"),
      "utf-8",
    );
    expect(raw).toContain('  "schemaVersion"');
  });

  it("addFeature appends to existing features", () => {
    writeFeatures(tmpDir, [makeFeature()]);
    addFeature(tmpDir, makeFeature({ id: "F002" }));
    const result = readFeatures(tmpDir);
    expect(result).toHaveLength(2);
  });

  it("updateFeature updates by id", () => {
    writeFeatures(tmpDir, [makeFeature()]);
    updateFeature(tmpDir, "F001", { passes: true });
    const result = readFeatures(tmpDir);
    expect(result[0]!.passes).toBe(true);
  });

  it("updateFeature throws for missing id", () => {
    writeFeatures(tmpDir, [makeFeature()]);
    expect(() => updateFeature(tmpDir, "F999", { passes: true })).toThrow(
      "Feature F999 not found",
    );
  });

  it("getNextFeature returns lowest priority non-passed feature", () => {
    writeFeatures(tmpDir, [
      makeFeature({ id: "F001", priority: 2 }),
      makeFeature({ id: "F002", priority: 1 }),
    ]);
    const next = getNextFeature(tmpDir);
    expect(next?.id).toBe("F002");
  });

  it("getNextFeature respects dependencies", () => {
    writeFeatures(tmpDir, [
      makeFeature({ id: "F001", priority: 1, passes: false }),
      makeFeature({ id: "F002", priority: 2, depends_on: ["F001"] }),
    ]);
    const next = getNextFeature(tmpDir);
    expect(next?.id).toBe("F001");
  });

  it("getNextFeature skips passed and skipped features", () => {
    writeFeatures(tmpDir, [
      makeFeature({ id: "F001", passes: true }),
      makeFeature({ id: "F002", skipped: true }),
      makeFeature({ id: "F003" }),
    ]);
    const next = getNextFeature(tmpDir);
    expect(next?.id).toBe("F003");
  });

  it("getNextFeature returns undefined when all done", () => {
    writeFeatures(tmpDir, [makeFeature({ passes: true })]);
    expect(getNextFeature(tmpDir)).toBeUndefined();
  });

  it("detects no cycles in acyclic graph", () => {
    const features = [
      makeFeature({ id: "F001" }),
      makeFeature({ id: "F002", depends_on: ["F001"] }),
      makeFeature({ id: "F003", depends_on: ["F002"] }),
    ];
    expect(detectCircularDependencies(features)).toEqual([]);
  });

  it("detects simple two-node cycle", () => {
    const features = [
      makeFeature({ id: "F001", depends_on: ["F002"] }),
      makeFeature({ id: "F002", depends_on: ["F001"] }),
    ];
    const cyclic = detectCircularDependencies(features);
    expect(cyclic).toContain("F001");
    expect(cyclic).toContain("F002");
  });

  it("getNextFeature skips features in cycles", () => {
    writeFeatures(tmpDir, [
      makeFeature({ id: "F001", priority: 1, depends_on: ["F002"] }),
      makeFeature({ id: "F002", priority: 2, depends_on: ["F001"] }),
      makeFeature({ id: "F003", priority: 3 }),
    ]);
    const next = getNextFeature(tmpDir);
    expect(next?.id).toBe("F003");
  });
});
