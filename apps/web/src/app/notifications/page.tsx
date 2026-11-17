import { redirect } from "next/navigation";
import { authedFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/current-user";
import { formatDate } from "@/lib/format";

// Lit les cookies de session (redirection si non connecté) : rendu non statique.
export const instant = false;

interface Notification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/notifications");
  }

  const notifications = await authedFetch<Notification[]>("/notifications/mine");
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Notifications</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {unreadCount > 0 ? `${unreadCount} non lue(s)` : "Tout est lu."}
        </p>
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucune notification pour le moment.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`flex items-start justify-between gap-3 px-4 py-3 text-sm ${
                notification.readAt ? "" : "bg-zinc-50 dark:bg-zinc-900"
              }`}
            >
              <div>
                <p className="font-medium text-black dark:text-zinc-50">{notification.title}</p>
                <p className="text-zinc-600 dark:text-zinc-400">{notification.body}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(notification.createdAt)}</p>
              </div>
              {!notification.readAt && (
                <form action={`/notifications/${notification.id}/read`} method="post">
                  <button
                    type="submit"
                    className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Marquer comme lue
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
