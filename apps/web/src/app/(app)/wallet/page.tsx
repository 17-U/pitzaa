import { authedFetch } from "@/lib/api";
import { formatDate, formatLedgerEntryType, formatXaf } from "@/lib/format";

// Données propres à l'utilisateur connecté (cookies + fetch) : rendu non statique.
export const instant = false;

interface Wallet {
  availableBalanceXaf: number;
  escrowBalanceXaf: number;
}

interface LedgerEntry {
  id: string;
  accountType: string;
  entryType: string;
  amountXaf: number;
  createdAt: string;
  transaction: { description: string | null } | null;
}

export default async function WalletPage() {
  const [wallet, history] = await Promise.all([
    authedFetch<Wallet>("/wallet/me"),
    authedFetch<LedgerEntry[]>("/wallet/me/history"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Portefeuille</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Disponible : {formatXaf(wallet.availableBalanceXaf)} · En séquestre : {formatXaf(wallet.escrowBalanceXaf)}
        </p>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucune écriture pour le moment.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-black dark:text-zinc-50">
                    {formatLedgerEntryType(entry.entryType)}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {entry.transaction?.description ?? "—"}
                  </td>
                  <td
                    className={`px-4 py-2 text-right whitespace-nowrap ${
                      entry.amountXaf >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {entry.amountXaf >= 0 ? "+" : ""}
                    {formatXaf(entry.amountXaf)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
