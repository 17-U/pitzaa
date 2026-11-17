import Link from "next/link";
import { redirect } from "next/navigation";
import { authedFetch, ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatDate, formatDisputeRelatedEntity, formatDisputeStatus } from "@/lib/format";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "MODERATOR", "SUPPORT"]);

interface Dispute {
  id: string;
  relatedEntityType: "MEMBERSHIP_PAYMENT" | "GIFT_CARD_ORDER";
  reason: string;
  status: "OPEN" | "UNDER_ARBITRATION";
  createdAt: string;
  responseDeadlineAt: string | null;
  arbitrationDeadlineAt: string | null;
  conversation: { id: string } | null;
}

export default async function AdminPendingDisputesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/disputes/admin/pending");
  }
  if (!ADMIN_ROLES.has(user.role)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Accès réservé aux administrateurs, modérateurs et au support.
        </p>
      </div>
    );
  }

  let disputes: Dispute[];
  try {
    disputes = await authedFetch<Dispute[]>("/disputes/admin/pending");
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Accès réservé aux administrateurs, modérateurs et au support.
          </p>
        </div>
      );
    }
    throw error;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Litiges à trancher
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Consultez la discussion avant de trancher en faveur du plaignant ou de l&apos;autre partie.
        </p>
      </div>

      {disputes.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun litige en attente.</p>
      ) : (
        <ul className="space-y-4">
          {disputes.map((dispute) => (
            <li key={dispute.id} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {formatDisputeRelatedEntity(dispute.relatedEntityType)} · {formatDate(dispute.createdAt)}
                  </p>
                  <p className="mt-1 text-black dark:text-zinc-50">{dispute.reason}</p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {formatDisputeStatus(dispute.status)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {dispute.conversation && (
                  <Link
                    href={`/messages/${dispute.conversation.id}`}
                    className="text-sm font-medium text-black underline hover:no-underline dark:text-zinc-50"
                  >
                    Voir la discussion
                  </Link>
                )}
                <Link
                  href={`/disputes/admin/${dispute.id}/resolve`}
                  className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-black"
                >
                  Trancher
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
