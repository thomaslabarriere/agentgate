import { getCurrentUser, getActiveOrg } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Role, User, Organization } from "@prisma/client";

/**
 * The request context every resolver receives. `user`/`org`/`role` are null
 * when the caller is unauthenticated or has no active org; resolvers authorize
 * against them via `assertRole`.
 */
export interface GraphQLContext {
  user: User | null;
  org: Organization | null;
  role: Role | null;
  prisma: typeof prisma;
}

export async function buildContext(): Promise<GraphQLContext> {
  // Resolving the session/active-org can throw (no session, cookie parsing,
  // Auth.js edge cases). A public GraphQL endpoint must degrade to an
  // unauthenticated context (resolvers then reject via assertRole) rather than
  // surface a 500, so we fail closed to nulls.
  try {
    const user = await getCurrentUser();
    const org = user ? await getActiveOrg() : null;

    let role: Role | null = null;
    if (user && org) {
      const membership = await prisma.membership.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
        select: { role: true },
      });
      role = membership?.role ?? null;
    }

    return { user, org, role, prisma };
  } catch {
    return { user: null, org: null, role: null, prisma };
  }
}
