"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * Client-side upgrade trigger. POSTs to the checkout route and redirects the
 * browser to the Stripe-hosted Checkout Session URL it returns.
 */
export function UpgradeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data: unknown = await res.json().catch(() => null);
      const url =
        data && typeof data === "object" && "url" in data
          ? (data as { url?: unknown }).url
          : undefined;
      if (!res.ok || typeof url !== "string") {
        const message =
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: unknown }).error)
            : "Could not start checkout. Please try again.";
        setError(message);
        setLoading(false);
        return;
      }
      window.location.assign(url);
    } catch {
      setError("Could not start checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={upgrade} disabled={loading}>
        {loading ? "Starting checkout…" : "Upgrade to Pro"}
      </Button>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
