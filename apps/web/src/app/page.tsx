import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 p-16 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">Pitzaa</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Partagez vos abonnements, achetez et revendez des cartes cadeaux en toute confiance.
        Paiements en mobile money, zone CEMAC.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
      >
        Se connecter
      </Link>
    </div>
  );
}
