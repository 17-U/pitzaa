"use client";

import { useState } from "react";

export function VaultRevealForm({ groupId }: { groupId: string }) {
  const [pin, setPin] = useState("");
  const [payload, setPayload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPayload(null);
    try {
      const res = await fetch(`/groups/${groupId}/vault/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await res.json()) as { payload?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
      } else {
        setPayload(data.payload ?? "");
      }
    } catch {
      setError("Une erreur est survenue, merci de réessayer.");
    } finally {
      setLoading(false);
      setPin("");
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {payload !== null ? (
        <pre className="whitespace-pre-wrap rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          {payload || "(aucun identifiant renseigné)"}
        </pre>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div>
            <label htmlFor={`vault-pin-${groupId}`} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              PIN Pitzaa
            </label>
            <input
              id={`vault-pin-${groupId}`}
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              required
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              className="mt-1 w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {loading ? "..." : "Afficher"}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
