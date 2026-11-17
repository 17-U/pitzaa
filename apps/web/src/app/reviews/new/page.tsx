import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

const ERROR_MESSAGES: Record<string, string> = {
  already_reviewed: "Vous avez déjà laissé un avis pour cette transaction.",
  server_error: "Une erreur est survenue, merci de réessayer.",
};

export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ membershipPaymentId?: string; giftCardOrderId?: string; error?: string }>;
}) {
  const { membershipPaymentId, giftCardOrderId, error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    const query = membershipPaymentId
      ? `?membershipPaymentId=${membershipPaymentId}`
      : `?giftCardOrderId=${giftCardOrderId}`;
    redirect(`/login?next=${encodeURIComponent(`/reviews/new${query}`)}`);
  }
  if (!membershipPaymentId && !giftCardOrderId) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Laisser un avis</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Votre avis est visible publiquement et influence le score de confiance de l&apos;autre partie.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server_error}
        </p>
      )}

      <form action="/reviews/new/submit" method="post" className="space-y-4">
        {membershipPaymentId && <input type="hidden" name="membershipPaymentId" value={membershipPaymentId} />}
        {giftCardOrderId && <input type="hidden" name="giftCardOrderId" value={giftCardOrderId} />}
        <div>
          <label htmlFor="rating" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Note
          </label>
          <select
            id="rating"
            name="rating"
            required
            defaultValue="5"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="5">5 — Excellent</option>
            <option value="4">4 — Bien</option>
            <option value="3">3 — Correct</option>
            <option value="2">2 — Décevant</option>
            <option value="1">1 — Très mauvais</option>
          </select>
        </div>
        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Commentaire (optionnel)
          </label>
          <textarea
            id="comment"
            name="comment"
            rows={4}
            maxLength={1000}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Envoyer l&apos;avis
        </button>
      </form>
    </div>
  );
}
