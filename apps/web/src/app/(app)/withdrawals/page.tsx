import {
  MIN_WITHDRAWAL_AMOUNT_XAF,
  WITHDRAWAL_FEE_BELOW_THRESHOLD_XAF,
  WITHDRAWAL_FEE_FREE_THRESHOLD_XAF,
} from "@pitzaa/shared";
import { authedFetch } from "@/lib/api";
import { formatDate, formatWithdrawalStatus, formatXaf } from "@/lib/format";

// Données propres à l'utilisateur connecté (cookies + fetch + searchParams) : rendu non statique.
export const instant = false;

interface Withdrawal {
  id: string;
  amountXaf: number;
  feeAmountXaf: number;
  operator: string;
  destinationMsisdn: string;
  status: string;
  createdAt: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_otp: "Code OTP invalide ou expiré.",
  insufficient_balance: "Solde disponible insuffisant.",
  server_error: "Une erreur est survenue, merci de réessayer.",
};

export default async function WithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ otpRequested?: string; error?: string }>;
}) {
  const { otpRequested, error } = await searchParams;
  const withdrawals = await authedFetch<Withdrawal[]>("/withdrawals");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Retraits</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Retrait minimum {formatXaf(MIN_WITHDRAWAL_AMOUNT_XAF)}. Frais de {formatXaf(WITHDRAWAL_FEE_BELOW_THRESHOLD_XAF)}{" "}
          en dessous de {formatXaf(WITHDRAWAL_FEE_FREE_THRESHOLD_XAF)}, gratuit au-delà.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server_error}
        </p>
      )}

      {otpRequested ? (
        <form action="/withdrawals/create" method="post" className="max-w-sm space-y-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Un code de confirmation vous a été envoyé par SMS.
          </p>
          <div>
            <label htmlFor="amountXaf" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Montant (XAF)
            </label>
            <input
              id="amountXaf"
              name="amountXaf"
              type="number"
              min={MIN_WITHDRAWAL_AMOUNT_XAF}
              step={1}
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="operator" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Opérateur
            </label>
            <select
              id="operator"
              name="operator"
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="MTN_MOMO">MTN Mobile Money</option>
              <option value="ORANGE_MONEY">Orange Money</option>
            </select>
          </div>
          <div>
            <label htmlFor="destinationMsisdn" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Numéro de destination
            </label>
            <input
              id="destinationMsisdn"
              name="destinationMsisdn"
              type="tel"
              required
              placeholder="+237612345678"
              pattern="^\+\d{8,15}$"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="otpCode" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Code de confirmation (SMS)
            </label>
            <input
              id="otpCode"
              name="otpCode"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-center tracking-widest outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            Confirmer le retrait
          </button>
        </form>
      ) : (
        <form action="/withdrawals/otp" method="post">
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
          >
            Demander un retrait
          </button>
        </form>
      )}

      <div>
        <h2 className="text-lg font-medium text-black dark:text-zinc-50">Historique</h2>
        {withdrawals.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Aucun retrait pour le moment.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {withdrawals.map((withdrawal) => (
              <li key={withdrawal.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-black dark:text-zinc-50">
                    {formatXaf(withdrawal.amountXaf)} vers {withdrawal.destinationMsisdn}
                  </p>
                  <p className="text-zinc-500 dark:text-zinc-400">{formatDate(withdrawal.createdAt)}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {formatWithdrawalStatus(withdrawal.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
