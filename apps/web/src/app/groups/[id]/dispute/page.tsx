import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

export default async function DisputeMembershipPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ membershipPaymentId?: string; error?: string }>;
}) {
  const { id } = await params;
  const { membershipPaymentId, error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    const nextPath = membershipPaymentId
      ? `/groups/${id}/dispute?membershipPaymentId=${membershipPaymentId}`
      : `/groups/${id}/dispute`;
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (!membershipPaymentId) {
    redirect(`/groups/${id}`);
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Signaler un problème d&apos;accès
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Le paiement sera gelé et le propriétaire aura 48h pour répondre. Un administrateur tranchera si
          nécessaire.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Une erreur est survenue, merci de réessayer.
        </p>
      )}

      <form action={`/groups/${id}/dispute/submit`} method="post" className="space-y-4">
        <input type="hidden" name="membershipPaymentId" value={membershipPaymentId} />
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Décrivez le problème
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={4}
            minLength={5}
            maxLength={1000}
            required
            placeholder="Je n'ai pas reçu les identifiants, ou ils ne fonctionnent pas..."
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Envoyer le signalement
        </button>
      </form>
    </div>
  );
}
