import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatXaf } from "@/lib/format";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

interface Service {
  id: string;
  name: string;
  category: string;
  maxSlots: number;
  recommendedPricePerSlotXaf: number;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_service: "Ce service ne permet pas le partage ou n'existe plus.",
  too_many_slots: "Le nombre de places dépasse le maximum autorisé pour ce service.",
  server_error: "Une erreur est survenue, merci de réessayer.",
};

export default async function CreateGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/groups/create");
  }

  const services = await apiFetch<Service[]>("/services");

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Créer un groupe de partage
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Vous ne payez rien en tant que propriétaire : les co-abonnés paient leur place.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server_error}
        </p>
      )}

      <form action="/groups/create/submit" method="post" className="space-y-4">
        <div>
          <label htmlFor="serviceId" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Service
          </label>
          <select
            id="serviceId"
            name="serviceId"
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} — max {service.maxSlots} places, recommandé {formatXaf(service.recommendedPricePerSlotXaf)}
                /place
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pricePerSlotXaf" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Prix par place et par mois (XAF)
          </label>
          <input
            id="pricePerSlotXaf"
            name="pricePerSlotXaf"
            type="number"
            min={0}
            step={1}
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label htmlFor="totalSlots" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nombre de places (vous compris)
          </label>
          <input
            id="totalSlots"
            name="totalSlots"
            type="number"
            min={1}
            max={50}
            step={1}
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Ne peut pas dépasser le maximum autorisé par le service choisi.
          </p>
        </div>

        <div>
          <label htmlFor="visibility" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Visibilité
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue="PRIVATE"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="PRIVATE">Privé (sur invitation)</option>
            <option value="PUBLIC">Public (visible dans la liste des groupes)</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" name="autoAcceptJoinRequests" value="true" className="rounded border-zinc-300" />
          Accepter automatiquement les demandes d&apos;adhésion
        </label>

        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Créer le groupe
        </button>
      </form>
    </div>
  );
}
