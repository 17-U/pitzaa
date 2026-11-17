import { redirect } from "next/navigation";
import { computeGiftCardSaleAmount } from "@pitzaa/shared";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatXaf } from "@/lib/format";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

interface Brand {
  id: string;
  name: string;
  country: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  resale_not_allowed: "La revente de cette marque n'est pas autorisée.",
  monthly_cap: "Plafond de 300 000 XAF/mois atteint sans KYC renforcé. Contactez le support pour une vérification.",
  server_error: "Une erreur est survenue, merci de réessayer.",
};

export default async function CreateListingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/gift-cards/create");
  }

  const brands = await apiFetch<Brand[]>("/gift-card-brands");
  const samplePreview = computeGiftCardSaleAmount(10_000, user.isPremium);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Vendre une carte cadeau
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Un administrateur vérifie manuellement le code avant publication. Commission de{" "}
          {formatXaf(samplePreview.commissionXaf)} pour {formatXaf(10_000)} de vente
          {user.isPremium ? " (tarif Premium)" : ""}.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server_error}
        </p>
      )}

      <form action="/gift-cards/create/submit" method="post" className="space-y-4">
        <div>
          <label htmlFor="brandId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Marque
          </label>
          <select
            id="brandId"
            name="brandId"
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name} ({brand.country})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="balanceXaf" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Solde de la carte (XAF)
          </label>
          <input
            id="balanceXaf"
            name="balanceXaf"
            type="number"
            min={1}
            step={1}
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="askingPriceXaf" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Prix de vente demandé (XAF)
          </label>
          <input
            id="askingPriceXaf"
            name="askingPriceXaf"
            type="number"
            min={1}
            step={1}
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="expiresAt" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Date d&apos;expiration (optionnel)
          </label>
          <input
            id="expiresAt"
            name="expiresAt"
            type="date"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="code" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Code de la carte
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Chiffré immédiatement, visible uniquement par un administrateur lors de la vérification puis par
            l&apos;acheteur après paiement.
          </p>
        </div>

        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Soumettre pour vérification
        </button>
      </form>
    </div>
  );
}
