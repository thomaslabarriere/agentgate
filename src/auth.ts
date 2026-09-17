import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

/**
 * Auth.js v5 configuration.
 *
 * - GitHub OAuth provider (credentials from AUTH_GITHUB_ID / AUTH_GITHUB_SECRET).
 * - PrismaAdapter persists users/accounts/sessions in Postgres.
 * - Database session strategy: the session lives in the `Session` table, so a
 *   session lookup always reflects the current DB state (no stale JWT claims).
 *
 * On first sign-in a `User` row is created with no `Membership`; that is the
 * expected pre-onboarding state. Tenancy (which org is active, what role) is
 * resolved separately in `src/lib/auth.ts`, never baked into the token.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    // With the database strategy the adapter hands us the `User` row; surface
    // its id on `session.user.id` so the rest of the app can rely on it.
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
