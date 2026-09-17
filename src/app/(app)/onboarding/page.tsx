import { redirect } from "next/navigation";
import { z } from "zod";
import { Plan, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser, setActiveOrg, slugify } from "@/lib/auth";

const CreateOrgSchema = z.object({
  name: z.string().trim().min(2, "Organization name is too short").max(60),
});

/** Find a slug not yet taken, appending -2, -3, … when needed. */
async function uniqueSlug(base: string): Promise<string> {
  const seed = base.length > 0 ? base : "org";
  let candidate = seed;
  let n = 1;
   
  while (await prisma.organization.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${seed}-${n}`;
  }
  return candidate;
}

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // Already has an org? Onboarding is done.
  const existing = await prisma.membership.findFirst({ where: { userId: user.id } });
  if (existing) redirect("/dashboard");

  async function createOrg(formData: FormData) {
    "use server";
    const current = await getCurrentUser();
    if (!current) redirect("/");

    const parsed = CreateOrgSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) {
      redirect("/onboarding?error=name");
    }

    const slug = await uniqueSlug(slugify(parsed.data.name));

    const org = await prisma.organization.create({
      data: {
        name: parsed.data.name,
        slug,
        memberships: {
          create: { userId: current.id, role: Role.OWNER },
        },
        subscription: {
          create: { plan: Plan.FREE },
        },
      },
    });

    await setActiveOrg(org.id);
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create your organization</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organizations own agents, policies and their audit trail. You&apos;ll be
          its owner.
        </p>
      </div>
      <form action={createOrg} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Organization name
          <input
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={60}
            placeholder="Acme Inc."
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Create organization
        </button>
      </form>
    </main>
  );
}
