import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatDate, formatXaf } from "@/lib/format";

// Liste filtrable par marque, formulaire d'achat conditionné par la session : rendu non statique.
export const instant = false;

interface Brand {
  id: string;
  name: string;
  country: string;
}

interface Listing {
  id: string;
  sellerId: string;
  brandId: string;
  balanceXaf: number;
  askingPriceXaf: number;
  expiresAt: string | null;
  brand: Brand;
}

const ERROR_MESSAGES: Record<string, string> = {
  own_listing: "Vous ne pouvez pas acheter votre propre annonce.",
  invalid_pin: "PIN incorrect.",
  no_pin: "Définissez votre PIN Pitzaa avant d'acheter (depuis la page Profil).",
  insufficient_balance: "Solde Pitzaa insuffisant pour cet achat.",
  server_error: "Une erreur est survenue, merci de réessayer.",
};

export default async function GiftCardsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string; error?: string }>;
}) {
  const { brandId, error } = await searchParams;
  const user = await getCurrentUser();

  const [brands, listings] = await Promise.all([
    apiFetch<Brand[]>("/gift-card-brands"),
    apiFetch<Listing[]>(`/gift-cards/listings${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ""}`),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Cartes cadeaux en vente
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Achetez une carte cadeau revendue par un autre utilisateur, ou vendez la vôtre.
          </p>
        </div>
        <Link
          href="/gift-cards/create"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Vendre une carte
        </Link>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server_error}
        </p>
      )}

      <form method="get" className="flex items-center gap-3">
        <label htmlFor="brandId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Marque
        </label>
        <select
          id="brandId"
          name="brandId"
          defaultValue={brandId ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Toutes les marques</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name} ({brand.country})
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Filtrer
        </button>
      </form>

      {listings.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucune carte cadeau en vente pour le moment.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {listings.map((listing) => {
            const isOwn = user?.id === listing.sellerId;
            return (
              <li key={listing.id} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{listing.brand.country}</p>
                <p className="text-lg font-medium text-black dark:text-zinc-50">{listing.brand.name}</p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Solde déclaré {formatXaf(listing.balanceXaf)} · Prix {formatXaf(listing.askingPriceXaf)}
                </p>
                {listing.expiresAt && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Expire le {formatDate(listing.expiresAt)}
                  </p>
                )}

                {!user && (
                  <Link
                    href="/login?next=/gift-cards"
                    className="mt-3 inline-block text-sm font-medium text-black underline dark:text-zinc-50"
                  >
                    Se connecter pour acheter
                  </Link>
                )}

                {user && isOwn && (
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">C&apos;est votre annonce.</p>
                )}

                {user && !isOwn && (
                  <form action={`/gift-cards/${listing.id}/buy`} method="post" className="mt-4 space-y-3">
                    <div>
                      <label
                        htmlFor={`method-${listing.id}`}
                        className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        Méthode
                      </label>
                      <select
                        id={`method-${listing.id}`}
                        name="method"
                        required
                        className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        <option value="WALLET">Portefeuille Pitzaa</option>
                        <option value="MOBILE_MONEY">Mobile Money</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        name="operator"
                        aria-label="Opérateur (mobile money)"
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        <option value="MTN_MOMO">MTN Mobile Money</option>
                        <option value="ORANGE_MONEY">Orange Money</option>
                      </select>
                      <input
                        type="tel"
                        name="msisdn"
                        placeholder="+237612345678 (mobile money)"
                        pattern="^\+\d{8,15}$"
                        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <input
                      type="password"
                      name="pin"
                      inputMode="numeric"
                      pattern="\d{4,6}"
                      maxLength={6}
                      placeholder="PIN Pitzaa"
                      required
                      className="w-full max-w-[140px] rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
                    >
                      Acheter
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
