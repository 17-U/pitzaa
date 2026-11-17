import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

export default async function RespondDisputePage({
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
    redirect(`/login?next=${encodeURIComponent(`/disputes/${id}/respond`)}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Répondre au litige
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Votre réponse sera visible par l&apos;autre partie et, si besoin, par un administrateur.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Une erreur est survenue, merci de réessayer.
        </p>
      )}

      <form action={`/disputes/${id}/respond/submit`} method="post" className="space-y-4">
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Votre réponse
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            minLength={5}
            maxLength={2000}
            required
            placeholder="L'invitation a bien été envoyée le... / le code a bien été vérifié..."
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Envoyer la réponse
        </button>
      </form>
    </div>
  );
}
