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
}
