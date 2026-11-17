// searchParams dépend de la requête (erreur affichée, redirection) : rendu non statique.
export const instant = false;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_phone: "Numéro invalide. Utilisez le format international, ex: +237612345678.",
  too_many_requests: "Trop de tentatives. Merci de réessayer dans quelques minutes.",
  server_error: "Une erreur est survenue, merci de réessayer.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 p-6 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Connexion à Pitzaa
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Entrez votre numéro, un code à usage unique vous sera envoyé par SMS.
          </p>
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server_error}
          </p>
        )}

        <form action="/login/request-otp" method="post" className="space-y-4">
          {next && <input type="hidden" name="next" value={next} />}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Numéro de téléphone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoFocus
              placeholder="+237612345678"
              pattern="^\+\d{8,15}$"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            Recevoir mon code
          </button>
        </form>
      </div>
    </div>
  );
}
