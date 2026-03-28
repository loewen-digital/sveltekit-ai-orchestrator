import { describe, it, expect, beforeEach } from "vitest";
import { setLogLevel, getLogLevel } from "../../src/utils/logger.js";
import type { LogLevel } from "../../src/utils/logger.js";

describe("logger", () => {
  beforeEach(() => {
    setLogLevel("info"); // Reset to default
  });

  it("defaults to info level", () => {
    expect(getLogLevel()).toBe("info");
  });

  it("setLogLevel changes the current level", () => {
    setLogLevel("debug");
    expect(getLogLevel()).toBe("debug");
  });

  it("setLogLevel accepts all valid levels", () => {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    for (const level of levels) {
      setLogLevel(level);
      expect(getLogLevel()).toBe(level);
    }
  });
});
