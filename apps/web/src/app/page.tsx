import type { ReactElement, SVGProps } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatXaf } from "@/lib/format";

function IconShield(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 21s7.5-3.5 7.5-9.5V5.5L12 3 4.5 5.5v6C4.5 17.5 12 21 12 21z" />
    </svg>
  );
}

function IconGift(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 12v9H4v-9" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function IconWallet(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </svg>
  );
}

function IconMessage(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
    </svg>
  );
}

function IconStar(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2.5l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 18.3 5.8 21.6 7 14.7l-5-4.9 6.9-1L12 2.5z" />
    </svg>
  );
}

function IconScale(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3v17" />
      <path d="M7 20h10" />
      <path d="M5 7h14" />
      <path d="M12 7 5 7l-2.5 5.5a3 3 0 0 0 5.9 0L5 7" />
      <path d="M19 7l2.5 5.5a3 3 0 0 1-5.9 0L19 7" />
    </svg>
  );
}

function VaultPreviewCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-stone-500">Groupe actif</p>
          <p className="mt-0.5 text-base font-medium text-stone-900">Canal+ Access</p>
        </div>
        <div className="flex -space-x-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-700 text-[11px] font-medium text-white ring-2 ring-white">
            A.M
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-700 text-[11px] font-medium text-white ring-2 ring-white">
            S.B
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-800 text-[11px] font-medium text-white ring-2 ring-white">
            J.K
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200 text-[11px] font-medium text-stone-600 ring-2 ring-white">
            +2
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-stone-900/8 pt-4">
        <div className="flex items-center gap-1.5 text-xs text-emerald-700">
          <IconShield className="h-4 w-4" />
          <span>Coffre-fort sécurisé</span>
        </div>
        <p className="text-sm font-medium text-stone-900 tabular-nums">{formatXaf(2500)} / mois</p>
      </div>
    </div>
  );
}

interface FeatureRowProps {
  icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
  imageSrc: string;
  imageAlt: string;
  reverse?: boolean;
}

function FeatureRow({ icon: Icon, title, body, href, linkLabel, imageSrc, imageAlt, reverse }: FeatureRowProps) {
  return (
    <div className="grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-20">
      <div className={reverse ? "md:order-2" : undefined}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
          <Image src={imageSrc} alt={imageAlt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </div>
      </div>
      <div className={reverse ? "md:order-1" : undefined}>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="mt-4 text-2xl font-medium text-stone-900 dark:text-stone-50">{title}</h3>
        <p className="mt-3 max-w-md text-stone-600 dark:text-stone-400">{body}</p>
        <Link
          href={href}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 transition-colors duration-150 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-400"
        >
          {linkLabel}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

interface TrustItemProps {
  icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
  title: string;
  body: string;
}

function TrustItem({ icon: Icon, title, body }: TrustItemProps) {
  return (
    <div>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 text-sm font-medium text-stone-900 dark:text-stone-50">{title}</p>
      <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">{body}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden bg-stone-950">
        <Image
          src="/images/hero-share.jpg"
          alt="Un groupe d'amis attablés, souriants, en train de regarder un abonnement partagé sur un téléphone"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-950/75 to-stone-950/40" />

        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="text-lg font-medium text-stone-50 font-serif">Pitzaa</span>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/groups" className="text-stone-200 transition-colors duration-150 hover:text-white">
              Groupes
            </Link>
            <Link href="/gift-cards" className="text-stone-200 transition-colors duration-150 hover:text-white">
              Cartes cadeaux
            </Link>
            <Link href="/login" className="font-medium text-stone-50 transition-colors duration-150 hover:text-white">
              Se connecter
            </Link>
          </nav>
        </header>

        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="animate-fade-up">
              <h1 className="text-[42px] leading-[1.05] font-normal tracking-[-0.02em] text-stone-50 font-serif md:text-[60px] lg:text-[68px]">
                Partagez vos abonnements
                <br />
                Vendez vos cartes cadeaux
                <br />
                Payés en mobile money
              </h1>
              <p className="mt-6 max-w-xl text-lg text-stone-200/90">
                La marketplace pour partager le coût d&apos;un abonnement entre amis et acheter ou revendre des
                cartes cadeaux, paiements en mobile money, zone CEMAC.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center rounded-lg bg-stone-50 px-6 text-sm font-medium text-stone-900 transition-colors duration-150 hover:bg-stone-200"
                >
                  Commencer
                </Link>
                <Link
                  href="/groups"
                  className="text-sm font-medium text-stone-100 underline-offset-4 transition-colors duration-150 hover:text-white hover:underline"
                >
                  Voir les groupes
                </Link>
              </div>
            </div>
            <div className="animate-fade-up lg:ml-auto" style={{ animationDelay: "100ms" }}>
              <VaultPreviewCard />
            </div>
          </div>
        </div>
      </section>

      <main className="bg-stone-50 dark:bg-stone-950">
        <div className="mx-auto max-w-6xl px-6">
          <FeatureRow
            icon={IconGift}
            title="Achetez et revendez des cartes cadeaux"
            body="Chaque code est vérifié avant sa mise en vente. En cas de litige, les fonds restent en séquestre jusqu'à résolution."
            href="/gift-cards"
            linkLabel="Voir les cartes cadeaux"
            imageSrc="/images/feature-giftcards.jpg"
            imageAlt="Une main tenant une petite carte cadeau emballée, nœud rouge, sur un fond chaleureux"
          />
          <FeatureRow
            icon={IconWallet}
            title="Retirez vos gains en mobile money"
            body="Les paiements et les retraits passent par mobile money, en franc CFA, sans compte bancaire nécessaire."
            href="/wallet"
            linkLabel="Gérer mon portefeuille"
            imageSrc="/images/feature-mobile-money.jpg"
            imageAlt="Une main sortant des billets de banque d'une poche"
            reverse
          />
        </div>

        <div className="border-t border-stone-200 dark:border-stone-800">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-16 sm:grid-cols-3 md:py-20">
            <TrustItem
              icon={IconMessage}
              title="Messagerie intégrée"
              body="Échangez directement avec l'autre partie pendant une transaction."
            />
            <TrustItem
              icon={IconStar}
              title="Avis après chaque transaction"
              body="Chaque échange peut être noté pour construire la confiance entre membres."
            />
            <TrustItem
              icon={IconScale}
              title="Résolution des litiges"
              body="Un arbitrage dédié tranche en cas de désaccord sur une commande."
            />
          </div>
        </div>

        <div className="border-t border-stone-200 bg-white py-20 text-center dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto max-w-xl px-6">
            <h2 className="text-2xl font-normal text-stone-900 font-serif md:text-3xl dark:text-stone-50">
              Prêt à partager votre premier abonnement
            </h2>
            <p className="mt-3 text-stone-600 dark:text-stone-400">
              Un numéro de téléphone suffit pour commencer, aucune carte bancaire requise.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-12 items-center rounded-lg bg-stone-900 px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-stone-800 dark:bg-stone-50 dark:text-stone-900 dark:hover:bg-stone-200"
            >
              Commencer
            </Link>
          </div>
        </div>

        <footer className="bg-stone-50 py-8 text-center text-xs text-stone-500 dark:bg-stone-950">
          <p>Pitzaa — zone CEMAC</p>
        </footer>
      </main>
    </div>
  );
}
