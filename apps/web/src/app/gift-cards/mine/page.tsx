import Link from "next/link";
import { redirect } from "next/navigation";
import { authedFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatDate, formatGiftCardListingStatus, formatXaf } from "@/lib/format";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

interface Order {
  id: string;
  status: "PENDING_PAYMENT" | "PAYMENT_FAILED" | "PAID" | "CODE_REVEALED" | "ESCROW_RELEASED" | "DISPUTED" | "REFUNDED";
  conversation: { id: string } | null;
}

interface Listing {
  id: string;
  balanceXaf: number;
  askingPriceXaf: number;
  status: "PENDING_VERIFICATION" | "LISTED" | "REJECTED" | "SOLD" | "CANCELLED";
  rejectionReason: string | null;
  createdAt: string;
  brand: { name: string };
  order: Order | null;
}

const CANCELLABLE_STATUSES = new Set(["PENDING_VERIFICATION", "LISTED"]);
const REVIEWABLE_ORDER_STATUSES = new Set(["ESCROW_RELEASED", "REFUNDED"]);

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ createdListingId?: string }>;
}) {
  const { createdListingId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/gift-cards/mine");
  }

  const listings = await authedFetch<Listing[]>("/gift-cards/listings/mine");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Mes annonces</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Toutes vos cartes cadeaux mises en vente.</p>
      </div>

      {createdListingId && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Annonce soumise pour vérification.
        </p>
      )}

      {listings.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Vous n&apos;avez pas encore d&apos;annonce.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {listings.map((listing) => (
            <li key={listing.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-black dark:text-zinc-50">{listing.brand.name}</p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {formatXaf(listing.askingPriceXaf)} (solde {formatXaf(listing.balanceXaf)}) · {formatDate(listing.createdAt)}
                </p>
                {listing.rejectionReason && (
                  <p className="text-red-600 dark:text-red-400">Rejetée : {listing.rejectionReason}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {formatGiftCardListingStatus(listing.status)}
                </span>
                {CANCELLABLE_STATUSES.has(listing.status) && (
                  <form action={`/gift-cards/${listing.id}/cancel`} method="post">
                    <button type="submit" className="text-xs text-red-600 underline hover:no-underline dark:text-red-400">
                      Annuler
                    </button>
                  </form>
                )}
                {listing.order?.conversation && (
                  <Link
                    href={`/messages/${listing.order.conversation.id}`}
                    className="text-xs font-medium text-black underline hover:no-underline dark:text-zinc-50"
                  >
                    Discussion
                  </Link>
                )}
                {listing.order && REVIEWABLE_ORDER_STATUSES.has(listing.order.status) && (
                  <Link
                    href={`/reviews/new?giftCardOrderId=${listing.order.id}`}
                    className="text-xs font-medium text-black underline hover:no-underline dark:text-zinc-50"
                  >
                    Laisser un avis
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
