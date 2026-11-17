import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";

// Lit les cookies de session à chaque requête : rendu non statique.
export const instant = false;

const NAV_LINKS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/groups/mine", label: "Groupes" },
  { href: "/gift-cards/mine", label: "Cartes cadeaux" },
  { href: "/disputes/mine", label: "Litiges" },
  { href: "/notifications", label: "Notifications" },
  { href: "/wallet", label: "Portefeuille" },
  { href: "/withdrawals", label: "Retraits" },
  { href: "/profile", label: "Profil" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Le middleware a déjà vérifié la session ; ce contrôle est un filet de sécurité
  // (ex: jeton révoqué côté API entre deux requêtes).
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
            Pitzaa
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                {link.label}
              </Link>
            ))}
            <form action="/logout" method="post">
              <button type="submit" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
                Déconnexion
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
