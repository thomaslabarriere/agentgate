"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getActiveOrg,
  getCurrentUser,
  requireRole,
  setActiveOrg,
} from "@/lib/auth";

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["ADMIN", "MEMBER"]),
});

/**
 * Invite a member by email. ADMIN+ only (enforced via requireRole against the
 * active org). Creates a pending Invitation; the invitee accepts via the link.
 */
export async function inviteMember(formData: FormData): Promise<void> {
  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");

  // Authorization: only ADMIN or OWNER may invite.
  await requireRole(org.id, Role.ADMIN);

  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    redirect("/settings/team?error=invite");
  }

  await prisma.invitation.upsert({
    where: {
      email_organizationId: { email: parsed.data.email, organizationId: org.id },
    },
    update: { role: parsed.data.role },
    create: {
      email: parsed.data.email,
      role: parsed.data.role,
      organizationId: org.id,
    },
  });

  revalidatePath("/settings/team");
}

/** Cancel a pending invitation. ADMIN+ only. */
export async function cancelInvitation(formData: FormData): Promise<void> {
  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");
  await requireRole(org.id, Role.ADMIN);

  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) return;

  // Scope the delete to the active org so an id from another tenant can't match.
  await prisma.invitation.deleteMany({
    where: { id: invitationId, organizationId: org.id },
  });

  revalidatePath("/settings/team");
}

/** Switch the caller's active organization. Only to an org they belong to. */
export async function switchOrg(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const orgId = String(formData.get("orgId") ?? "");
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
  });
  if (!membership) {
    redirect("/settings/team?error=switch");
  }

  await setActiveOrg(orgId);
  redirect("/settings/team");
}
