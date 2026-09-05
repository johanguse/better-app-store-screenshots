import { describe, expect, it } from "vitest";
import { rejectCrossSiteWrite, sniffFontType, sniffImageType } from "./request-guard";

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/project", { method: "POST", headers });
}

describe("rejectCrossSiteWrite", () => {
  it("allows a same-origin JSON request with no extra headers", () => {
    expect(rejectCrossSiteWrite(makeRequest({ "content-type": "application/json" }))).toBeNull();
  });

  it("rejects a non-JSON content type", () => {
    const result = rejectCrossSiteWrite(makeRequest({ "content-type": "text/plain" }));
    expect(result?.status).toBe(415);
  });

  it("allows application/json with a charset suffix", () => {
    expect(
      rejectCrossSiteWrite(makeRequest({ "content-type": "application/json; charset=utf-8" })),
    ).toBeNull();
  });

  it("allows a loopback origin", () => {
    expect(
      rejectCrossSiteWrite(
        makeRequest({ "content-type": "application/json", origin: "http://localhost:3000" }),
      ),
    ).toBeNull();
  });

  it("rejects a non-loopback origin", () => {
    const result = rejectCrossSiteWrite(
      makeRequest({ "content-type": "application/json", origin: "https://evil.example" }),
    );
    expect(result?.status).toBe(403);
  });

  it("rejects a cross-site Sec-Fetch-Site", () => {
    const result = rejectCrossSiteWrite(
      makeRequest({ "content-type": "application/json", "sec-fetch-site": "cross-site" }),
    );
    expect(result?.status).toBe(403);
  });

  it("allows a same-origin Sec-Fetch-Site", () => {
    expect(
      rejectCrossSiteWrite(
        makeRequest({ "content-type": "application/json", "sec-fetch-site": "same-origin" }),
      ),
    ).toBeNull();
  });
});

describe("sniffImageType", () => {
  it("detects a PNG signature", () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(sniffImageType(bytes)).toBe("image/png");
  });

  it("detects a JPEG signature", () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0, 0]);
    expect(sniffImageType(bytes)).toBe("image/jpeg");
  });

  it("returns null for unrecognized bytes", () => {
    expect(sniffImageType(Buffer.from([0, 1, 2, 3]))).toBeNull();
  });
});

describe("sniffFontType", () => {
  it("detects woff2", () => {
    expect(sniffFontType(Buffer.from("wOF2test"))).toBe("font/woff2");
  });

  it("detects woff", () => {
    expect(sniffFontType(Buffer.from("wOFFtest"))).toBe("font/woff");
  });

  it("detects otf", () => {
    expect(sniffFontType(Buffer.from("OTTOtest"))).toBe("font/otf");
  });

  it("detects ttf via binary signature", () => {
    expect(sniffFontType(Buffer.from([0x00, 0x01, 0x00, 0x00]))).toBe("font/ttf");
  });

  it("returns null for unrecognized bytes", () => {
    expect(sniffFontType(Buffer.from("junk"))).toBeNull();
  });
});
