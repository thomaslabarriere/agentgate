import { describe, expect, it } from "vitest";
import { planForPriceId, statusIsActive } from "@/lib/stripe";

describe("planForPriceId", () => {
  const PRO = "price_pro_123";

  it("maps the configured PRO price to PRO", () => {
    expect(planForPriceId(PRO, PRO)).toBe("PRO");
  });

  it("maps a different price to FREE", () => {
    expect(planForPriceId("price_other", PRO)).toBe("FREE");
  });

  it("is FREE when the price id is missing", () => {
    expect(planForPriceId(null, PRO)).toBe("FREE");
    expect(planForPriceId(undefined, PRO)).toBe("FREE");
    expect(planForPriceId("", PRO)).toBe("FREE");
  });

  it("is FREE when the configured PRO price is missing (never guesses PRO)", () => {
    expect(planForPriceId(PRO, null)).toBe("FREE");
    expect(planForPriceId(PRO, undefined)).toBe("FREE");
    expect(planForPriceId(PRO, "")).toBe("FREE");
  });

  it("does not treat two empty strings as a PRO match", () => {
    expect(planForPriceId("", "")).toBe("FREE");
  });
});

describe("statusIsActive", () => {
  it("treats active and trialing as active", () => {
    expect(statusIsActive("active")).toBe(true);
    expect(statusIsActive("trialing")).toBe(true);
  });

  it("treats every other status as inactive", () => {
    for (const s of [
      "past_due",
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
    ]) {
      expect(statusIsActive(s)).toBe(false);
    }
  });

  it("is inactive for null/undefined/empty", () => {
    expect(statusIsActive(null)).toBe(false);
    expect(statusIsActive(undefined)).toBe(false);
    expect(statusIsActive("")).toBe(false);
  });
});
