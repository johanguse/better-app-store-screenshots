import { describe, expect, it } from "vitest";
import { cleanHexColor } from "./clean-hex-color";

describe("cleanHexColor", () => {
  it("uppercases a valid lowercase hex color", () => {
    expect(cleanHexColor("#abcdef")).toBe("#ABCDEF");
  });

  it("accepts an already-uppercase hex color", () => {
    expect(cleanHexColor("#ABCDEF")).toBe("#ABCDEF");
  });

  it("trims surrounding whitespace", () => {
    expect(cleanHexColor("  #123456  ")).toBe("#123456");
  });

  it("rejects a value missing the leading #", () => {
    expect(cleanHexColor("123456")).toBeUndefined();
  });

  it("rejects short hex shorthand", () => {
    expect(cleanHexColor("#fff")).toBeUndefined();
  });

  it("rejects non-hex characters", () => {
    expect(cleanHexColor("#gggggg")).toBeUndefined();
  });

  it("rejects non-string input", () => {
    expect(cleanHexColor(123456)).toBeUndefined();
    expect(cleanHexColor(undefined)).toBeUndefined();
    expect(cleanHexColor(null)).toBeUndefined();
  });
});
