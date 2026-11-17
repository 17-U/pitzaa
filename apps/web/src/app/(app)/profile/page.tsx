import { computeDisplayTrustScore } from "@pitzaa/shared";
import { getCurrentUser } from "@/lib/current-user";
import { formatKycStatus } from "@/lib/format";

// Données propres à l'utilisateur connecté (cookies + fetch + searchParams) : rendu non statique.
export const instant = false;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_pin: "Le PIN doit comporter entre 4 et 6 chiffres.",
  server_error: "Une erreur est survenue, merci de réessayer.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  profile_updated: "Profil mis à jour.",
  pin_updated: "PIN mis à jour.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  const trustScore = computeDisplayTrustScore(user.trustScore, new Date(user.createdAt));

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Profil</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{user.phone}</p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server_error}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          {SUCCESS_MESSAGES[success] ?? success}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-zinc-500 dark:text-zinc-400">KYC</p>
          <p className="font-medium text-black dark:text-zinc-50">{formatKycStatus(user.kycStatus)}</p>
        </div>
        <div>
          <p className="text-zinc-500 dark:text-zinc-400">Premium</p>
          <p className="font-medium text-black dark:text-zinc-50">{user.isPremium ? "Oui" : "Non"}</p>
        </div>
        <div>
          <p className="text-zinc-500 dark:text-zinc-400">Score de confiance</p>
          <p className="font-medium text-black dark:text-zinc-50">{trustScore}</p>
        </div>
        <div>
          <p className="text-zinc-500 dark:text-zinc-400">Rôle</p>
          <p className="font-medium text-black dark:text-zinc-50">{user.role}</p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">Informations personnelles</h2>
        <form action="/profile/update" method="post" className="space-y-4">
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
                defaultValue={user.firstName ?? ""}
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
                defaultValue={user.lastName ?? ""}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
          <div>
            <label htmlFor="locale" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Langue
            </label>
            <select
              id="locale"
              name="locale"
              defaultValue={user.locale}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            Enregistrer
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">PIN Pitzaa</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Confirme vos paiements et l&apos;accès aux identifiants partagés. Jamais le code PIN mobile money.
        </p>
        <form action="/profile/pin" method="post" className="flex max-w-xs items-end gap-3">
          <div className="flex-1">
            <label htmlFor="pin" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nouveau PIN (4 à 6 chiffres)
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Mettre à jour
          </button>
        </form>
      </section>
    </div>
  );
}
