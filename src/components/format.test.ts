import { describe, expect, it } from "vitest";
import { allowRate, formatCount, formatRate } from "@/lib/format";

describe("formatRate", () => {
  it("rounds a 0..1 rate to a whole percentage", () => {
    expect(formatRate(0.8342)).toBe("83%");
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(1)).toBe("100%");
  });

  it("clamps out-of-range values", () => {
    expect(formatRate(1.5)).toBe("100%");
    expect(formatRate(-0.2)).toBe("0%");
  });

  it("guards against non-finite input", () => {
    expect(formatRate(Number.NaN)).toBe("—");
  });
});

describe("allowRate", () => {
  it("computes allow / total", () => {
    expect(allowRate(3, 4)).toBe(0.75);
  });

  it("returns 0 when total is zero", () => {
    expect(allowRate(0, 0)).toBe(0);
  });
});

describe("formatCount", () => {
  it("group-separates integers", () => {
    expect(formatCount(12045)).toBe("12,045");
    expect(formatCount(7)).toBe("7");
  });
});
