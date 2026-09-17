import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/auth";
import { getActiveOrg } from "@/lib/auth";
import { Nav } from "@/components/Nav";

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
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            AgentGate
          </Link>
          {org ? (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {org.name}
            </span>
          ) : null}
        </div>
        <nav className="flex items-center gap-4 text-sm">
          {org ? (
            <Link href="/settings/team" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Team
            </Link>
          ) : null}
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <Nav />
      <div className="flex-1 bg-zinc-950 text-zinc-200">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
