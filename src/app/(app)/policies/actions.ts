"use server";

import { revalidatePath } from "next/cache";
import { gql, type Effect, type Policy } from "@/lib/gql";
import { UPSERT_POLICY_MUTATION, DELETE_POLICY_MUTATION } from "@/lib/queries";

export interface PolicyInput {
  id?: string;
  name: string;
  action: string;
  resource: string;
  subtree: boolean;
  effect: Effect;
  priority: number;
  enabled: boolean;
}

export async function upsertPolicyAction(input: PolicyInput): Promise<Policy> {
  const data = await gql<{ upsertPolicy: Policy }>(UPSERT_POLICY_MUTATION, { input });
  revalidatePath("/policies");
  return data.upsertPolicy;
}

export async function deletePolicyAction(id: string): Promise<void> {
  await gql<{ deletePolicy: boolean }>(DELETE_POLICY_MUTATION, { id });
  revalidatePath("/policies");
}
