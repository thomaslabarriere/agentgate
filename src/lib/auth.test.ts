import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { roleAtLeast, slugify } from "@/lib/auth";

describe("roleAtLeast", () => {
  it("treats every role as at least itself", () => {
    expect(roleAtLeast(Role.OWNER, Role.OWNER)).toBe(true);
    expect(roleAtLeast(Role.ADMIN, Role.ADMIN)).toBe(true);
    expect(roleAtLeast(Role.MEMBER, Role.MEMBER)).toBe(true);
  });

  it("ranks OWNER > ADMIN > MEMBER (higher meets lower minimums)", () => {
    expect(roleAtLeast(Role.OWNER, Role.ADMIN)).toBe(true);
    expect(roleAtLeast(Role.OWNER, Role.MEMBER)).toBe(true);
    expect(roleAtLeast(Role.ADMIN, Role.MEMBER)).toBe(true);
  });

  it("fails when the role is below the minimum", () => {
    expect(roleAtLeast(Role.ADMIN, Role.OWNER)).toBe(false);
    expect(roleAtLeast(Role.MEMBER, Role.OWNER)).toBe(false);
    expect(roleAtLeast(Role.MEMBER, Role.ADMIN)).toBe(false);
  });
});

describe("slugify", () => {
  it("lowercases", () => {
    expect(slugify("Acme")).toBe("acme");
  });

  it("turns spaces into dashes", () => {
    expect(slugify("Acme Inc")).toBe("acme-inc");
  });

  it("strips non-alphanumeric characters", () => {
    expect(slugify("Acme, Inc.!")).toBe("acme-inc");
    expect(slugify("Hello_World")).toBe("helloworld");
  });

  it("collapses runs of dashes and trims edge dashes", () => {
    expect(slugify("  Acme   Inc  ")).toBe("acme-inc");
    expect(slugify("Acme -- Inc")).toBe("acme-inc");
    expect(slugify("--Acme--")).toBe("acme");
  });

  it("keeps digits", () => {
    expect(slugify("Team 42")).toBe("team-42");
  });

  it("handles a name that reduces to nothing", () => {
    expect(slugify("!!!")).toBe("");
  });
});
