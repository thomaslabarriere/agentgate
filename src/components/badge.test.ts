import { describe, expect, it } from "vitest";
import {
  badgeClasses,
  variantForEffect,
  variantForGranted,
} from "@/components/ui/variants";

describe("badge variant selection", () => {
  it("maps a granted verdict to allow, denied to deny", () => {
    expect(variantForGranted(true)).toBe("allow");
    expect(variantForGranted(false)).toBe("deny");
  });

  it("maps a policy effect to its variant", () => {
    expect(variantForEffect("ALLOW")).toBe("allow");
    expect(variantForEffect("DENY")).toBe("deny");
  });

  it("resolves a variant to a non-empty class string", () => {
    expect(badgeClasses("allow")).toContain("emerald");
    expect(badgeClasses("deny")).toContain("rose");
    expect(badgeClasses("role")).toContain("indigo");
    expect(badgeClasses("neutral").length).toBeGreaterThan(0);
  });
});
