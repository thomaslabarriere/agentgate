import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth";
import { getActiveOrg } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Badge, Button } from "@/components/ui";

/**
 * Shell for the authenticated app: a simple header showing the active org and a
 * sign-out button. Individual pages own their own body and their own tenancy
 * checks (`getActiveOrg` / `requireRole`).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const org = await getActiveOrg();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-200">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-sm text-sm font-semibold tracking-tight text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            AgentGate
          </Link>
          {org ? <Badge variant="neutral">{org.name}</Badge> : null}
        </div>
        <nav className="flex items-center gap-4 text-sm">
          {org ? (
            <Link
              href="/settings/team"
              className="rounded-sm text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            >
              Team
            </Link>
          ) : null}
          <form action={signOutAction}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </nav>
      </header>
      <Nav />
      <div className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
