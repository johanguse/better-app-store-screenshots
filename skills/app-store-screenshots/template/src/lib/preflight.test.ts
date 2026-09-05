import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "./defaults";
import { runPreflight } from "./preflight";
import type { ProjectState } from "./types";

describe("preflight", () => {
  it("reports placeholder screenshots without blocking a structurally valid project", () => {
    const report = runPreflight(structuredClone(DEFAULT_PROJECT));
    expect(report.errors).toBe(0);
    expect(report.passed).toBe(true);
    expect(report.issues.some((issue) => issue.code === "missing-screenshot")).toBe(true);
  });

  it("blocks store-limit violations", () => {
    const state: ProjectState = structuredClone(DEFAULT_PROJECT);
    const [firstSlide] = state.slidesByDevice.android;
    state.slidesByDevice.android = Array.from({ length: 9 }, (_, index) => ({
      ...structuredClone(firstSlide),
      id: `android-${index}`,
    }));
    const report = runPreflight(state);
    expect(report.errors).toBeGreaterThan(0);
    expect(report.issues.some((issue) => issue.code === "slide-limit")).toBe(true);
  });

  it("flags an empty device deck", () => {
    const state: ProjectState = structuredClone(DEFAULT_PROJECT);
    state.slidesByDevice.macos = [];
    const report = runPreflight(state);
    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.code === "empty-deck")).toBe(true);
  });

  it("flags duplicate slide IDs within a device deck", () => {
    const state: ProjectState = structuredClone(DEFAULT_PROJECT);
    const [firstSlide, secondSlide] = state.slidesByDevice.iphone;
    secondSlide.id = firstSlide.id;
    const report = runPreflight(state);
    expect(report.issues.some((issue) => issue.code === "duplicate-id")).toBe(true);
  });

  it("flags missing localized copy for extra locales", () => {
    const state: ProjectState = structuredClone(DEFAULT_PROJECT);
    state.locales = ["en", "de"];
    const report = runPreflight(state);
    expect(report.issues.some((issue) => issue.code === "missing-copy" && issue.locale === "de")).toBe(true);
  });
});
