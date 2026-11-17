import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

export default async function DisputeGiftCardOrderPage({
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
    redirect(`/login?next=${encodeURIComponent(`/gift-cards/orders/${id}/dispute`)}`);
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Signaler un problème
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          La commande sera gelée et le vendeur aura 48h pour répondre. Un administrateur tranchera si
          nécessaire.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Une erreur est survenue, merci de réessayer.
        </p>
      )}

      <form action={`/gift-cards/orders/${id}/dispute/submit`} method="post" className="space-y-4">
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
            placeholder="Le code est invalide, déjà utilisé, le solde ne correspond pas..."
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
