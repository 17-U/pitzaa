import Link from "next/link";
import { redirect } from "next/navigation";
import { authedFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatDate, formatDisputeRelatedEntity, formatDisputeStatus } from "@/lib/format";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

interface Dispute {
  id: string;
  raisedById: string;
  againstId: string | null;
  relatedEntityType: "MEMBERSHIP_PAYMENT" | "GIFT_CARD_ORDER";
  reason: string;
  status: "OPEN" | "AWAITING_RESPONSE" | "UNDER_ARBITRATION" | "RESOLVED_FOR_INITIATOR" | "RESOLVED_FOR_COUNTERPARTY" | "CANCELLED";
  resolutionNotes: string | null;
  createdAt: string;
  conversation: { id: string } | null;
}

export default async function MyDisputesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/disputes/mine");
  }

  const disputes = await authedFetch<Dispute[]>("/disputes/mine");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Mes litiges</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Litiges que j&apos;ai ouverts ou dans lesquels je suis mis en cause.
        </p>
      </div>

      {disputes.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun litige pour le moment.</p>
      ) : (
        <ul className="space-y-4">
          {disputes.map((dispute) => {
            const isRaiser = dispute.raisedById === user.id;
            const isCounterparty = dispute.againstId === user.id;
            return (
              <li key={dispute.id} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {formatDisputeRelatedEntity(dispute.relatedEntityType)} · {formatDate(dispute.createdAt)}
                    </p>
                    <p className="mt-1 text-black dark:text-zinc-50">{dispute.reason}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {isRaiser ? "Vous avez ouvert ce litige" : "Vous êtes mis en cause"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {formatDisputeStatus(dispute.status)}
                  </span>
                </div>

                {dispute.resolutionNotes && (
                  <p className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    Décision : {dispute.resolutionNotes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {dispute.conversation && (
                    <Link
                      href={`/messages/${dispute.conversation.id}`}
                      className="text-sm font-medium text-black underline hover:no-underline dark:text-zinc-50"
                    >
                      Voir la discussion
                    </Link>
                  )}

                  {isCounterparty && dispute.status === "OPEN" && (
                    <Link
                      href={`/disputes/${dispute.id}/respond`}
                      className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-black"
                    >
                      Répondre
                    </Link>
                  )}

                  {isRaiser && dispute.status === "OPEN" && (
                    <form action={`/disputes/${dispute.id}/cancel`} method="post">
                      <button type="submit" className="text-xs text-red-600 underline hover:no-underline dark:text-red-400">
                        Annuler le litige
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
