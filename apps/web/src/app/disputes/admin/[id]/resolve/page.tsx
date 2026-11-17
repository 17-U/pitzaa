import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "MODERATOR", "SUPPORT"]);

export default async function ResolveDisputePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/disputes/admin/${id}/resolve`)}`);
  }
  if (!ADMIN_ROLES.has(user.role)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Accès réservé aux administrateurs, modérateurs et au support.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Trancher le litige
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          « Le plaignant a raison » déclenche un remboursement intégral ; « l&apos;autre partie a raison »
          déclenche la libération normale de l&apos;escrow.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Une erreur est survenue, merci de réessayer.
        </p>
      )}

      <form action={`/disputes/admin/${id}/resolve/submit`} method="post" className="space-y-4">
        <div>
          <label htmlFor="outcome" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Décision
          </label>
          <select
            id="outcome"
            name="outcome"
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="INITIATOR">Le plaignant a raison (remboursement)</option>
            <option value="COUNTERPARTY">L&apos;autre partie a raison (libération normale)</option>
          </select>
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Motif de la décision
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            minLength={3}
            maxLength={2000}
            required
            placeholder="Capture fournie confirmant..."
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Trancher
        </button>
      </form>
    </div>
  );
}
