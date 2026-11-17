import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatXaf } from "@/lib/format";

// Liste filtrable par service : dépend de searchParams, rendu non statique.
export const instant = false;

interface Service {
  id: string;
  name: string;
  category: string;
  logoUrl: string | null;
  maxSlots: number;
  recommendedPricePerSlotXaf: number;
}

interface GroupSummary {
  id: string;
  pricePerSlotXaf: number;
  totalSlots: number;
  visibility: "PUBLIC" | "PRIVATE";
  autoAcceptJoinRequests: boolean;
  service: Service;
  _count: { memberships: number };
}

export default async function GroupsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ serviceId?: string }>;
}) {
  const { serviceId } = await searchParams;

  const [services, groups] = await Promise.all([
    apiFetch<Service[]>("/services"),
    apiFetch<GroupSummary[]>(`/groups${serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : ""}`),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Groupes de partage
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Rejoignez un groupe pour partager un abonnement, ou créez le vôtre.
          </p>
        </div>
        <Link
          href="/groups/create"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Créer un groupe
        </Link>
      </div>

      <form method="get" className="flex items-center gap-3">
        <label htmlFor="serviceId" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Service
        </label>
        <select
          id="serviceId"
          name="serviceId"
          defaultValue={serviceId ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">Tous les services</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} ({service.category})
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

      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun groupe public pour le moment.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{group.service.category}</p>
              <p className="text-lg font-medium text-black dark:text-zinc-50">{group.service.name}</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {formatXaf(group.pricePerSlotXaf)} / place/mois · {group._count.memberships}/{group.totalSlots} places
              </p>
              {group.autoAcceptJoinRequests && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">Adhésion immédiate</p>
              )}
              <Link
                href={`/groups/${group.id}`}
                className="mt-3 inline-block text-sm font-medium text-black underline hover:no-underline dark:text-zinc-50"
              >
                Voir le groupe
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
