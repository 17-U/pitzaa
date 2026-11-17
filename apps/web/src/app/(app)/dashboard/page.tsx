import Link from "next/link";
import { authedFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatDate, formatLedgerEntryType, formatXaf } from "@/lib/format";

// Données propres à l'utilisateur connecté (cookies + fetch) : rendu non statique.
export const instant = false;

interface Wallet {
  availableBalanceXaf: number;
  escrowBalanceXaf: number;
}

interface LedgerEntry {
  id: string;
  entryType: string;
  amountXaf: number;
  createdAt: string;
  transaction: { description: string | null } | null;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [wallet, history] = await Promise.all([
    authedFetch<Wallet>("/wallet/me"),
    authedFetch<LedgerEntry[]>("/wallet/me/history"),
  ]);
  const recentHistory = history.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Bonjour{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Voici un résumé de votre portefeuille Pitzaa.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Solde disponible</p>
          <p className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
            {formatXaf(wallet.availableBalanceXaf)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">En séquestre</p>
          <p className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
            {formatXaf(wallet.escrowBalanceXaf)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/withdrawals"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Faire un retrait
        </Link>
        <Link
          href="/wallet"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Voir l&apos;historique complet
        </Link>
        <Link
          href="/groups"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Parcourir les groupes de partage
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">Activité récente</h2>
        {recentHistory.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Aucune activité pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {recentHistory.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-black dark:text-zinc-50">{formatLedgerEntryType(entry.entryType)}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">{formatDate(entry.createdAt)}</p>
                </div>
                <p className={entry.amountXaf >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {entry.amountXaf >= 0 ? "+" : ""}
                  {formatXaf(entry.amountXaf)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Les cartes cadeaux et les litiges seront disponibles ici dans de prochaines étapes.
      </p>
    </div>
  );
}
