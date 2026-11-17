import { redirect } from "next/navigation";

// searchParams dépend de la requête (téléphone, erreur) : rendu non statique.
export const instant = false;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "Code incorrect ou expiré. Vérifiez le SMS reçu ou demandez-en un nouveau.",
  server_error: "Une erreur est survenue, merci de réessayer.",
};

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; error?: string; next?: string }>;
}) {
  const { phone, error, next } = await searchParams;
  if (!phone) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 p-6 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Entrez votre code
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Un code à 6 chiffres a été envoyé par SMS au {phone}.
          </p>
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server_error}
          </p>
        )}

        <form action="/login/verify/confirm" method="post" className="space-y-4">
          <input type="hidden" name="phone" value={phone} />
          {next && <input type="hidden" name="next" value={next} />}
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Code reçu par SMS
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
              Si c&apos;est votre première connexion : comment souhaitez-vous être appelé(e) ?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Prénom
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  maxLength={80}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Nom
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  maxLength={80}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            Valider
          </button>
        </form>

        <form action="/login/request-otp" method="post">
          <input type="hidden" name="phone" value={phone} />
          {next && <input type="hidden" name="next" value={next} />}
          <button type="submit" className="w-full text-center text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
            Renvoyer le code
          </button>
        </form>
      </div>
    </div>
  );
}
