import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: "AgentGate — govern & audit your AI agents",
};

export default async function LandingPage() {
  // Already signed in? Skip the marketing page and route into the app.
  const user = await getCurrentUser();
  if (user) redirect("/onboarding");

  async function signInWithGitHub() {
    "use server";
    await signIn("github", { redirectTo: "/onboarding" });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-24">
      <div className="flex flex-col gap-4">
        <span className="text-sm font-medium uppercase tracking-widest text-zinc-500">
          AgentGate
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Govern and audit every action your AI agents take.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-zinc-400">
          Define allow/deny policies, gate agent actions through a single
          decision API, and keep a complete, queryable audit trail, with
          per-organization isolation and role-based access.
        </p>
      </div>

      <form action={signInWithGitHub}>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-100 px-6 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-300"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          Sign in with GitHub
        </button>
      </form>
    </main>
  );
}
