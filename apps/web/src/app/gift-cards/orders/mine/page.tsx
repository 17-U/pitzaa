import Link from "next/link";
import { redirect } from "next/navigation";
import { authedFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatDate, formatGiftCardOrderStatus, formatXaf } from "@/lib/format";
import { RevealCodeButton } from "./reveal-code-button";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

interface Order {
  id: string;
  pricePaidXaf: number;
  status: "PENDING_PAYMENT" | "PAYMENT_FAILED" | "PAID" | "CODE_REVEALED" | "ESCROW_RELEASED" | "DISPUTED" | "REFUNDED";
  createdAt: string;
  listing: { brand: { name: string } };
}

export default async function MyGiftCardOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ boughtOrderId?: string; disputed?: string }>;
}) {
  const { boughtOrderId, disputed } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/gift-cards/orders/mine");
  }

  const orders = await authedFetch<Order[]>("/gift-cards/orders/mine");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Mes achats</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Cartes cadeaux achetées. Le code ne peut être révélé qu&apos;une seule fois.
        </p>
      </div>

      {boughtOrderId && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Achat effectué.
        </p>
      )}
      {disputed && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Votre signalement a été transmis. Le vendeur a 48h pour répondre.
        </p>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Vous n&apos;avez pas encore acheté de carte cadeau.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-black dark:text-zinc-50">{order.listing.brand.name}</p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {formatXaf(order.pricePaidXaf)} · {formatDate(order.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {formatGiftCardOrderStatus(order.status)}
                </span>
                {order.status === "PAID" && <RevealCodeButton orderId={order.id} />}
                {order.status === "CODE_REVEALED" && (
                  <Link
                    href={`/gift-cards/orders/${order.id}/dispute`}
                    className="text-xs font-medium text-red-600 underline hover:no-underline dark:text-red-400"
                  >
                    Signaler un problème
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
