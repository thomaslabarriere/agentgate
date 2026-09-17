import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role, type Organization, type Membership, type User } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * The shared session + tenancy contract (see CONTRACT.md). Every piece of
 * org-scoped server code funnels through `getActiveOrg()` and `requireRole()`
 * so that tenant isolation and RBAC live in exactly one place.
 */

/** Cookie holding the active organization id. */
export const ACTIVE_ORG_COOKIE = "org";

/** Where an unauthenticated caller is sent. Sign-in lives on the marketing page. */
export const SIGN_IN_PATH = "/";

// --- Pure, unit-testable helpers -------------------------------------------

/** Rank of each role; higher outranks lower. OWNER > ADMIN > MEMBER. */
const ROLE_RANK: Record<Role, number> = {
  [Role.OWNER]: 3,
  [Role.ADMIN]: 2,
  [Role.MEMBER]: 1,
};

/** True when `role` is at least as privileged as `min` (OWNER>ADMIN>MEMBER). */
export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/**
 * Derive a URL-safe slug from an organization name: lowercase, spaces become
 * dashes, non-alphanumeric characters are stripped, and runs of dashes collapse
 * to one (with any leading/trailing dashes trimmed).
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- Session / tenancy (DB-backed) -----------------------------------------

/** The signed-in `User` row, or null when unauthenticated. */
export async function getCurrentUser(): Promise<User | null> {
  // Imported lazily so the pure helpers above stay importable without pulling
  // in the Auth.js runtime (keeps unit tests dependency-free and fast).
  const { auth } = await import("@/auth");
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

/**
 * The caller's active organization: the org named by the `org` cookie when the
 * user is a member of it, otherwise their first membership's org, else null.
 */
export async function getActiveOrg(): Promise<Organization | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  if (cookieOrgId) {
    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: cookieOrgId } },
      include: { organization: true },
    });
    if (membership) return membership.organization;
  }

  const first = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  return first?.organization ?? null;
}

/**
 * Server-action helper: set the active-org cookie. The caller is responsible
 * for having verified membership (e.g. via the switch action).
 */
export async function setActiveOrg(orgId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

/**
 * Load the current user's membership for `orgId` and assert it meets `min`.
 * Redirects to sign-in when unauthenticated; throws when the user is not a
 * member or their role is below `min`.
 */
export async function requireRole(orgId: string, min: Role): Promise<Membership> {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN_PATH);

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!membership) {
    throw new Error("Forbidden: you are not a member of this organization");
  }
  if (!roleAtLeast(membership.role, min)) {
    throw new Error(`Forbidden: this action requires the ${min} role`);
  }
  return membership;
}
