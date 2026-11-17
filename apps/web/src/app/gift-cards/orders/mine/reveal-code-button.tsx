"use client";

import { useState } from "react";

export function RevealCodeButton({ orderId }: { orderId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReveal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/gift-cards/orders/${orderId}/reveal`, { method: "POST" });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
      } else {
        setCode(data.code ?? "");
      }
    } catch {
      setError("Une erreur est survenue, merci de réessayer.");
    } finally {
      setLoading(false);
    }
  }

  if (code !== null) {
    return <code className="rounded-md bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">{code}</code>;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleReveal}
        disabled={loading}
        className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {loading ? "..." : "Révéler le code"}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
