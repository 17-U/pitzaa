import Link from "next/link";
import { redirect } from "next/navigation";
import { authedFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatXaf } from "@/lib/format";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

interface Service {
  id: string;
  name: string;
  category: string;
}

interface GroupSummary {
  id: string;
  pricePerSlotXaf: number;
  totalSlots: number;
  status: "ACTIVE" | "CLOSED";
  service: Service;
}

interface MyGroups {
  owned: GroupSummary[];
  joined: GroupSummary[];
}

function GroupList({ groups, emptyLabel }: { groups: GroupSummary[]; emptyLabel: string }) {
  if (groups.length === 0) {
    return <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>;
  }
  return (
    <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {groups.map((group) => (
        <li key={group.id} className="flex items-center justify-between px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-black dark:text-zinc-50">{group.service.name}</p>
            <p className="text-zinc-500 dark:text-zinc-400">
              {formatXaf(group.pricePerSlotXaf)} / place/mois · {group.status === "ACTIVE" ? "Actif" : "Fermé"}
            </p>
          </div>
          <Link href={`/groups/${group.id}`} className="font-medium text-black underline hover:no-underline dark:text-zinc-50">
            Voir
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function MyGroupsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/groups/mine");
  }

  const { owned, joined } = await authedFetch<MyGroups>("/groups/mine");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Mes groupes</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Groupes que vous possédez ou avez rejoints.</p>
        </div>
        <Link
          href="/groups/create"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Créer un groupe
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">Groupes que je possède</h2>
        <GroupList groups={owned} emptyLabel="Vous ne possédez aucun groupe pour le moment." />
      </div>

      <div>
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">Groupes que j&apos;ai rejoints</h2>
        <GroupList groups={joined} emptyLabel="Vous n'avez rejoint aucun groupe pour le moment." />
      </div>

      <Link
        href="/groups"
        className="inline-block text-sm font-medium text-black underline hover:no-underline dark:text-zinc-50"
      >
        Parcourir les groupes publics
      </Link>
    </div>
  );
}
