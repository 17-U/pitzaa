import { redirect } from "next/navigation";
import { authedFetch, ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatDate } from "@/lib/format";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

interface Message {
  id: string;
  senderId: string;
  content: string;
  flagged: boolean;
  createdAt: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  server_error: "Une erreur est survenue, merci de réessayer.",
};

export default async function MessagesThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/messages/${id}`)}`);
  }

  let messages: Message[];
  try {
    messages = await authedFetch<Message[]>(`/conversations/${id}/messages`);
  } catch (fetchError) {
    if (fetchError instanceof ApiError && (fetchError.status === 403 || fetchError.status === 404)) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-8">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Cette discussion n&apos;existe pas ou vous n&apos;y avez pas accès.
          </p>
        </div>
      );
    }
    throw fetchError;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Discussion</h1>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server_error}
        </p>
      )}

      {messages.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun message pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => {
            const isMine = message.senderId === user.id;
            return (
              <li
                key={message.id}
                className={`max-w-[80%] rounded-lg border px-3 py-2 text-sm ${
                  isMine
                    ? "ml-auto border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isMine ? "Vous" : "Autre partie"} · {formatDate(message.createdAt)}
                </p>
                <p className="mt-1 text-black dark:text-zinc-50">{message.content}</p>
              </li>
            );
          })}
        </ul>
      )}

      <form action={`/messages/${id}/send`} method="post" className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="content" className="sr-only">
            Message
          </label>
          <textarea
            id="content"
            name="content"
            rows={2}
            minLength={1}
            maxLength={2000}
            required
            placeholder="Écrire un message..."
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
        >
          Envoyer
        </button>
      </form>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Les numéros de téléphone, numéros mobile money et liens WhatsApp sont automatiquement masqués.
      </p>
    </div>
  );
}
