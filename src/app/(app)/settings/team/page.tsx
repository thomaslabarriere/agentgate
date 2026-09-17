import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveOrg, getCurrentUser, roleAtLeast } from "@/lib/auth";
import { cancelInvitation, inviteMember, switchOrg } from "./actions";

export const metadata = { title: "Team — AgentGate" };

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");

  // Current user's membership in the active org (also gates the invite form).
  const myMembership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
  });
  if (!myMembership) redirect("/onboarding");
  const canManage = roleAtLeast(myMembership.role, Role.ADMIN);

  const [members, invitations, myMemberships] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: org.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.membership.findMany({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Members of <span className="font-medium">{org.name}</span>.
        </p>
      </div>

      {myMemberships.length > 1 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Active organization</h2>
          <form action={switchOrg} className="flex items-center gap-2">
            <select
              name="orgId"
              defaultValue={org.id}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {myMemberships.map((m) => (
                <option key={m.organizationId} value={m.organizationId}>
                  {m.organization.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Switch
            </button>
          </form>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Members</h2>
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm">
                {m.user.name ?? m.user.email ?? "Unknown user"}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {canManage ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Invite a member</h2>
          <form action={inviteMember} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Email
              <input
                name="email"
                type="email"
                required
                placeholder="teammate@example.com"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Role
              <select
                name="role"
                defaultValue={Role.MEMBER}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value={Role.MEMBER}>MEMBER</option>
                <option value={Role.ADMIN}>ADMIN</option>
              </select>
            </label>
            <button
              type="submit"
              className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Invite
            </button>
          </form>

          {invitations.length > 0 ? (
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">
                    {inv.email}
                    <span className="ml-2 text-xs text-zinc-500">{inv.role}</span>
                  </span>
                  <form action={cancelInvitation}>
                    <input type="hidden" name="invitationId" value={inv.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Cancel
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">No pending invitations.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
