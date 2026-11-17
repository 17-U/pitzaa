import Link from "next/link";
import { computeMembershipPaymentAmount } from "@pitzaa/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { isDateInFuture } from "@/lib/dates";
import { formatDate, formatXaf } from "@/lib/format";
import { VaultRevealForm } from "./vault-reveal-form";

// Comportement dépend de la session (propriétaire / membre / invité) : rendu non statique.
export const instant = false;

interface Service {
  id: string;
  name: string;
  category: string;
  logoUrl: string | null;
  maxSlots: number;
  sharingRules: string | null;
  recommendedPricePerSlotXaf: number;
}

interface Membership {
  id: string;
  groupId: string;
  userId: string;
  status: "PENDING" | "ACTIVE" | "LEFT" | "REMOVED";
  joinedAt: string | null;
  leftAt: string | null;
  nextPaymentDueAt: string | null;
  createdAt: string;
}

interface GroupDetail {
  id: string;
  serviceId: string;
  ownerId: string;
  pricePerSlotXaf: number;
  totalSlots: number;
  visibility: "PUBLIC" | "PRIVATE";
  status: "ACTIVE" | "CLOSED";
  autoAcceptJoinRequests: boolean;
  service: Service;
  memberships: Membership[];
}

const ERROR_MESSAGES: Record<string, string> = {
  already_pending: "Une demande d'adhésion est déjà en cours pour ce groupe.",
  full: "Ce groupe est complet.",
  insufficient_balance: "Solde Pitzaa insuffisant pour ce paiement.",
  no_pin: "Définissez votre PIN Pitzaa avant de payer (depuis la page Profil).",
  invalid_pin: "PIN incorrect.",
  server_error: "Une erreur est survenue, merci de réessayer.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  payment: "Paiement effectué.",
  vault_updated: "Identifiants enregistrés.",
  group_updated: "Groupe mis à jour.",
  group_closed: "Groupe fermé aux nouvelles adhésions.",
};

const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  ACTIVE: "Actif",
  LEFT: "Parti",
  REMOVED: "Retiré",
};

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; lastPaymentId?: string; disputed?: string }>;
}) {
  const { id } = await params;
  const { error, success, lastPaymentId, disputed } = await searchParams;
  const user = await getCurrentUser();

  let group: GroupDetail;
  try {
    group = await apiFetch<GroupDetail>(`/groups/${id}`);
  } catch (fetchError) {
    if (fetchError instanceof ApiError && fetchError.status === 404) {
      return <p className="text-sm text-zinc-500 dark:text-zinc-400">Groupe introuvable.</p>;
    }
    throw fetchError;
  }

  const isOwner = user?.id === group.ownerId;
  const myMembership = user ? group.memberships.find((m) => m.userId === user.id) : undefined;
  const activeCount = group.memberships.filter((m) => m.status === "ACTIVE").length;
  const pendingMemberships = group.memberships.filter((m) => m.status === "PENDING");
  const canReveal = isOwner || myMembership?.status === "ACTIVE";
  const isLeaveScheduled = Boolean(myMembership?.leftAt && isDateInFuture(myMembership.leftAt));

  const paymentPreviews = user
    ? ([1, 3, 6] as const).map((monthsCount) => ({
        monthsCount,
        ...computeMembershipPaymentAmount(group.pricePerSlotXaf, monthsCount, user.isPremium),
      }))
    : [];

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{group.service.category}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{group.service.name}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {formatXaf(group.pricePerSlotXaf)} / place/mois · {activeCount}/{group.totalSlots} places ·{" "}
          {group.visibility === "PUBLIC" ? "Public" : "Privé"} ·{" "}
          {group.status === "ACTIVE" ? "Actif" : "Fermé"}
        </p>
        {group.service.sharingRules && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{group.service.sharingRules}</p>
        )}
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
      {disputed && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          Votre signalement a été transmis. Le propriétaire a 48h pour répondre.
        </p>
      )}

      {!user && (
        <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <Link href={`/login?next=/groups/${group.id}`} className="font-medium text-black underline dark:text-zinc-50">
              Connectez-vous
            </Link>{" "}
            pour rejoindre ce groupe.
          </p>
        </div>
      )}

      {user && !isOwner && !myMembership && (
        <form action={`/groups/${group.id}/join`} method="post">
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            {group.autoAcceptJoinRequests ? "Rejoindre ce groupe" : "Demander à rejoindre"}
          </button>
        </form>
      )}

      {user && !isOwner && (myMembership?.status === "LEFT" || myMembership?.status === "REMOVED") && (
        <form action={`/groups/${group.id}/join`} method="post">
          <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
            Vous ne faites plus partie de ce groupe ({MEMBERSHIP_STATUS_LABELS[myMembership.status]}).
          </p>
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            Rejoindre à nouveau
          </button>
        </form>
      )}

      {user && !isOwner && myMembership?.status === "PENDING" && (
        <p className="rounded-lg border border-zinc-200 p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          Votre demande d&apos;adhésion est en attente d&apos;acceptation par le propriétaire.
        </p>
      )}

      {user && !isOwner && myMembership?.status === "ACTIVE" && (
        <section className="space-y-6">
          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Membre depuis le {myMembership.joinedAt ? formatDate(myMembership.joinedAt) : "—"}.
              {myMembership.nextPaymentDueAt && (
                <> Prochaine échéance : {formatDate(myMembership.nextPaymentDueAt)}.</>
              )}
            </p>
            {isLeaveScheduled && myMembership.leftAt ? (
              <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                Départ programmé pour le {formatDate(myMembership.leftAt)} (fin de la période déjà payée).
              </p>
            ) : (
              <form action={`/groups/memberships/${myMembership.id}/leave`} method="post" className="mt-3">
                <input type="hidden" name="groupId" value={group.id} />
                <button type="submit" className="text-sm text-red-600 underline hover:no-underline dark:text-red-400">
                  Quitter le groupe
                </button>
              </form>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">Payer ma cotisation</h2>
            <form action={`/groups/${group.id}/pay`} method="post" className="mt-4 space-y-4">
              <input type="hidden" name="membershipId" value={myMembership.id} />
              <div>
                <label htmlFor="monthsCount" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Durée
                </label>
                <select
                  id="monthsCount"
                  name="monthsCount"
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {paymentPreviews.map((preview) => (
                    <option key={preview.monthsCount} value={preview.monthsCount}>
                      {preview.monthsCount} mois — {formatXaf(preview.totalXaf)} (dont {formatXaf(preview.commissionXaf)}{" "}
                      de frais)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="method" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Méthode
                </label>
                <select
                  id="method"
                  name="method"
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="WALLET">Portefeuille Pitzaa</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="operator" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Opérateur (mobile money)
                  </label>
                  <select
                    id="operator"
                    name="operator"
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <option value="MTN_MOMO">MTN Mobile Money</option>
                    <option value="ORANGE_MONEY">Orange Money</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="msisdn" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Numéro (mobile money)
                  </label>
                  <input
                    id="msisdn"
                    name="msisdn"
                    type="tel"
                    placeholder="+237612345678"
                    pattern="^\+\d{8,15}$"
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  PIN Pitzaa
                </label>
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4,6}"
                  maxLength={6}
                  required
                  className="mt-1 w-full max-w-[160px] rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
              >
                Payer
              </button>
            </form>
          </div>

          {lastPaymentId && (
            <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Pas accès au service malgré ce paiement ?{" "}
                <Link
                  href={`/groups/${group.id}/dispute?membershipPaymentId=${lastPaymentId}`}
                  className="font-medium text-black underline dark:text-zinc-50"
                >
                  Signaler un problème
                </Link>
              </p>
            </div>
          )}
        </section>
      )}

      {canReveal && (
        <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-lg font-medium text-black dark:text-zinc-50">Identifiants partagés</h2>
          <VaultRevealForm groupId={group.id} />
        </div>
      )}

      {isOwner && (
        <section className="space-y-6">
          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">Gérer le groupe</h2>
            <form action={`/groups/${group.id}/update`} method="post" className="mt-4 space-y-4">
              <div>
                <label htmlFor="pricePerSlotXaf" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Prix par place (XAF)
                </label>
                <input
                  id="pricePerSlotXaf"
                  name="pricePerSlotXaf"
                  type="number"
                  min={0}
                  defaultValue={group.pricePerSlotXaf}
                  className="mt-1 w-full max-w-[200px] rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label htmlFor="visibility" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Visibilité
                </label>
                <select
                  id="visibility"
                  name="visibility"
                  defaultValue={group.visibility}
                  className="mt-1 w-full max-w-[280px] rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="PRIVATE">Privé (sur invitation)</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  name="autoAcceptJoinRequests"
                  value="true"
                  defaultChecked={group.autoAcceptJoinRequests}
                  className="rounded border-zinc-300"
                />
                Accepter automatiquement les demandes d&apos;adhésion
              </label>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Enregistrer
              </button>
            </form>

            {group.status === "ACTIVE" && (
              <form action={`/groups/${group.id}/close`} method="post" className="mt-4">
                <button type="submit" className="text-sm text-red-600 underline hover:no-underline dark:text-red-400">
                  Fermer le groupe aux nouvelles adhésions
                </button>
              </form>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">Identifiants du service</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Visibles par les membres actifs après paiement.
            </p>
            <form action={`/groups/${group.id}/vault`} method="post" className="mt-3 space-y-3">
              <textarea
                name="payload"
                rows={3}
                maxLength={4000}
                required
                placeholder="identifiant : ... / mot de passe : ..."
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Enregistrer les identifiants
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">
              Demandes d&apos;adhésion en attente ({pendingMemberships.length})
            </h2>
            {pendingMemberships.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Aucune demande en attente.</p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
                {pendingMemberships.map((membership) => (
                  <li key={membership.id} className="flex items-center justify-between py-3 text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Utilisateur {membership.userId.slice(0, 10)}…</span>
                    <div className="flex gap-2">
                      <form action={`/groups/memberships/${membership.id}/accept`} method="post">
                        <input type="hidden" name="groupId" value={group.id} />
                        <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-black">
                          Accepter
                        </button>
                      </form>
                      <form action={`/groups/memberships/${membership.id}/reject`} method="post">
                        <input type="hidden" name="groupId" value={group.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                        >
                          Refuser
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">Membres ({group.memberships.length})</h2>
            <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
              {group.memberships.map((membership) => (
                <li key={membership.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">Utilisateur {membership.userId.slice(0, 10)}…</span>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {MEMBERSHIP_STATUS_LABELS[membership.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
