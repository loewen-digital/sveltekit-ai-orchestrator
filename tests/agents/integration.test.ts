import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFeatures, readFeatures, getNextFeature, updateFeature } from "../../src/utils/features.js";
import { parseVerdict } from "../../src/agents/evaluator.js";
import type { Feature } from "../../src/types/feature.js";

// Mock the Agent SDK — we never actually call Claude in tests
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(function* () {
    yield { result: "Mock agent completed successfully.\nVERDICT: PASS" };
  }),
}));

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

describe("Agent SDK integration (mocked)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "orch-integration-"));
    mkdirSync(join(tmpDir, ".claude-harness"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runAgent wraps the SDK query call and returns output", async () => {
    const { runAgent } = await import("../../src/agents/runner.js");

    const result = await runAgent({
      name: "TestAgent",
      prompt: "Test prompt",
      systemPrompt: "You are a test agent.",
      tools: ["Read"],
      cwd: tmpDir,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain("Mock agent completed successfully");
  });

  it("parseVerdict correctly extracts PASS from mock agent output", () => {
    const output = "Some analysis...\nVERDICT: PASS";
    expect(parseVerdict(output, tmpDir)).toBe("PASS");
  });

  it("parseVerdict prefers eval-report.md over agent stdout", () => {
    writeFileSync(
      join(tmpDir, ".claude-harness", "eval-report.md"),
      "# Report\nSome issues found.\n\nVERDICT: FAIL",
    );

    const output = "VERDICT: PASS";
    expect(parseVerdict(output, tmpDir)).toBe("FAIL");
  });

  it("simulates full generator→evaluator flow with mock SDK", async () => {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const { runAgent } = await import("../../src/agents/runner.js");

    // Setup features
    const features = [
      makeFeature({ id: "F001", priority: 1 }),
      makeFeature({ id: "F002", priority: 2, depends_on: ["F001"] }),
    ];
    writeFeatures(tmpDir, features);

    // Pick first feature
    const feature = getNextFeature(tmpDir);
    expect(feature?.id).toBe("F001");

    // Simulate generator
    const genResult = await runAgent({
      name: `Generator[${feature!.id}]`,
      prompt: `Implement ${feature!.id}`,
      systemPrompt: "You are a generator.",
      tools: ["Read", "Write", "Edit"],
      cwd: tmpDir,
    });
    expect(genResult.success).toBe(true);

    // Simulate evaluator writing eval-report
    writeFileSync(
      join(tmpDir, ".claude-harness", "eval-report.md"),
      "# Eval Report\n\nAll ACs passed.\n\nVERDICT: PASS",
    );

    const evalResult = await runAgent({
      name: `Evaluator[${feature!.id}]`,
      prompt: `Evaluate ${feature!.id}`,
      systemPrompt: "You are an evaluator.",
      tools: ["Read", "Bash"],
      cwd: tmpDir,
    });
    expect(evalResult.success).toBe(true);

    // Parse verdict
    const verdict = parseVerdict(evalResult.output, tmpDir);
    expect(verdict).toBe("PASS");

    // Update feature state
    updateFeature(tmpDir, feature!.id, { passes: true });

    // F002 should now be unblocked
    const next = getNextFeature(tmpDir);
    expect(next?.id).toBe("F002");

    // Verify query was called (agent SDK was invoked)
    expect(vi.mocked(query)).toHaveBeenCalled();
  });
});
