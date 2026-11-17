import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";

// Affiche un lien différent selon la session : lit les cookies à chaque requête.
export const instant = false;

export default async function GroupsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
            Pitzaa
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/groups" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
              Groupes publics
            </Link>
            {user ? (
              <>
                <Link
                  href="/groups/mine"
                  className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Mes groupes
                </Link>
                <Link
                  href="/dashboard"
                  className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Mon compte
                </Link>
              </>
            ) : (
              <Link href="/login" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
                Connexion
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
