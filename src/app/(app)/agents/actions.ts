"use server";

import { revalidatePath } from "next/cache";
import { gql, type CreatedAgent } from "@/lib/gql";
import { CREATE_AGENT_MUTATION, REVOKE_AGENT_MUTATION } from "@/lib/queries";

export async function createAgentAction(name: string): Promise<CreatedAgent> {
  const data = await gql<{ createAgent: CreatedAgent }>(CREATE_AGENT_MUTATION, { name });
  revalidatePath("/agents");
  return data.createAgent;
}

export async function revokeAgentAction(id: string): Promise<void> {
  await gql<{ revokeAgent: boolean }>(REVOKE_AGENT_MUTATION, { id });
  revalidatePath("/agents");
}
