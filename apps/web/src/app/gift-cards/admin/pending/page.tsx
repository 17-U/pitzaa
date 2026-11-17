import { redirect } from "next/navigation";
import { authedFetch, ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatDate, formatXaf } from "@/lib/format";
import { AdminRevealCodeButton } from "./admin-reveal-code-button";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "MODERATOR"]);

interface Seller {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  kycStatus: string;
  isPremium: boolean;
}

interface PendingListing {
  id: string;
  balanceXaf: number;
  askingPriceXaf: number;
  createdAt: string;
  brand: { name: string; country: string };
  seller: Seller;
}

export default async function AdminPendingListingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/gift-cards/admin/pending");
  }
  if (!ADMIN_ROLES.has(user.role)) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Accès réservé aux administrateurs et modérateurs.
      </p>
    );
  }

  let listings: PendingListing[];
  try {
    listings = await authedFetch<PendingListing[]>("/gift-cards/listings/admin/pending");
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Accès réservé aux administrateurs et modérateurs.
        </p>
      );
    }
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Annonces en attente de vérification
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Consultez le code (consultation journalisée), vérifiez le solde auprès du fournisseur, puis validez
          ou rejetez.
        </p>
      </div>

      {listings.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucune annonce en attente.</p>
      ) : (
        <ul className="space-y-4">
          {listings.map((listing) => (
            <li key={listing.id} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{listing.brand.country}</p>
              <p className="text-lg font-medium text-black dark:text-zinc-50">{listing.brand.name}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Solde déclaré {formatXaf(listing.balanceXaf)} · Prix {formatXaf(listing.askingPriceXaf)} ·{" "}
                {formatDate(listing.createdAt)}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Vendeur : {listing.seller.firstName ?? ""} {listing.seller.lastName ?? ""} ({listing.seller.phone}) ·
                KYC {listing.seller.kycStatus}
                {listing.seller.isPremium ? " · Premium" : ""}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <AdminRevealCodeButton listingId={listing.id} />
                <form action={`/gift-cards/admin/${listing.id}/verify`} method="post">
                  <button
                    type="submit"
                    className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-black"
                  >
                    Valider
                  </button>
                </form>
                <form action={`/gift-cards/admin/${listing.id}/reject`} method="post" className="flex items-center gap-2">
                  <input
                    type="text"
                    name="reason"
                    placeholder="Motif du rejet"
                    minLength={3}
                    maxLength={1000}
                    required
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    Rejeter
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
