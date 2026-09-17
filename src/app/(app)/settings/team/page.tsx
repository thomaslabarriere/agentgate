import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveOrg, getCurrentUser, roleAtLeast } from "@/lib/auth";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { cancelInvitation, inviteMember, switchOrg } from "./actions";

export const metadata = { title: "Team — AgentGate" };

const inputCls =
  "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none";

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
  // Member management is OWNER-only per the tenancy contract.
  const canManage = roleAtLeast(myMembership.role, Role.OWNER);

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        description={`Members of ${org.name}.`}
      />

      {myMemberships.length > 1 ? (
        <Card>
          <CardHeader title="Active organization" />
          <CardBody>
            <form action={switchOrg} className="flex items-center gap-2">
              <select name="orgId" defaultValue={org.id} className={inputCls}>
                {myMemberships.map((m) => (
                  <option key={m.organizationId} value={m.organizationId}>
                    {m.organization.name}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary">
                Switch
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Members" subtitle={`${members.length} in this organization`} />
        <CardBody>
          <ul className="divide-y divide-zinc-800/60">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-zinc-200">
                  {m.user.name ?? m.user.email ?? "Unknown user"}
                </span>
                <Badge variant="role">{m.role}</Badge>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader
            title="Invite a member"
            subtitle="Send an invitation link to a teammate's email"
          />
          <CardBody className="space-y-4">
            <form
              action={inviteMember}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-300">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="teammate@example.com"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-zinc-300">
                Role
                <select name="role" defaultValue={Role.MEMBER} className={inputCls}>
                  <option value={Role.MEMBER}>MEMBER</option>
                  <option value={Role.ADMIN}>ADMIN</option>
                </select>
              </label>
              <Button type="submit">Invite</Button>
            </form>

            {invitations.length > 0 ? (
              <ul className="divide-y divide-zinc-800/60 border-t border-zinc-800/60">
                {invitations.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between py-2.5"
                  >
                    <span className="flex items-center gap-2 text-sm text-zinc-200">
                      {inv.email}
                      <Badge variant="neutral">{inv.role}</Badge>
                    </span>
                    <form action={cancelInvitation}>
                      <input type="hidden" name="invitationId" value={inv.id} />
                      <Button type="submit" variant="danger">
                        Cancel
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500">No pending invitations.</p>
            )}
          </CardBody>
        </Card>
      ) : (
        <EmptyState
          title="Member management is owner-only"
          hint="Ask an organization owner to invite or remove members."
        />
      )}
    </div>
  );
}
