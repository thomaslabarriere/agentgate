"use server";

import { revalidatePath } from "next/cache";
import { gql, type Webhook } from "@/lib/gql";
import { CREATE_WEBHOOK_MUTATION, DELETE_WEBHOOK_MUTATION } from "@/lib/queries";

export async function createWebhookAction(url: string, event: string): Promise<Webhook> {
  const data = await gql<{ createWebhook: Webhook }>(CREATE_WEBHOOK_MUTATION, { url, event });
  revalidatePath("/settings/webhooks");
  return data.createWebhook;
}

export async function deleteWebhookAction(id: string): Promise<void> {
  await gql<{ deleteWebhook: boolean }>(DELETE_WEBHOOK_MUTATION, { id });
  revalidatePath("/settings/webhooks");
}
