# Questions ouvertes

Liste des points qui nécessitent une décision métier ou une information que je n'ai pas (clé API, doc fournisseur, choix produit). Je continue avec des valeurs d'exemple / hypothèses raisonnables en attendant vos réponses.

> **Décision prise** : pas d'application mobile Expo. Tout le produit (site vitrine, espace utilisateur, back-office) est servi en web par `apps/web` (Next.js). `apps/mobile` a été retiré du monorepo.

## Paiements mobile money

- **Documentation Fapshi** : je n'ai pas (encore) lu la documentation officielle de l'API Fapshi (endpoints `collect`, `getStatus`, `payout`, format des webhooks, signature). L'interface `PaymentProvider` (apps/api/src/payments/providers/payment-provider.interface.ts) et le routage Fapshi→KPay sont implémentés et testés via `MockPaymentProvider`, mais `apps/api/src/payments/providers/fapshi.provider.ts` reste un squelette : chaque méthode lève une erreur « non implémenté » avec un `TODO` explicite. → Pour débloquer l'implémentation réelle : un lien vers la doc Fapshi à jour, ou les specs d'API (Postman/OpenAPI) si disponibles.
- **Documentation KPay** : même remarque pour `apps/api/src/payments/providers/kpay.provider.ts`. Merci de fournir la doc officielle (endpoints, format de signature de webhook, codes d'erreur).
- **Comptes sandbox** : avez-vous des comptes de test (sandbox) Fapshi/KPay pour valider les intégrations avant la production ?
- **En attendant** : `PAYMENT_PROVIDER=mock` force l'utilisation de `MockPaymentProvider` pour tout le développement/tests (collecte, retrait, webhooks, idempotence, réconciliation sont tous fonctionnels avec ce fournisseur simulé). Ne pas passer `PAYMENT_PROVIDER=fapshi` ou `kpay` avant que ces adaptateurs soient complétés.

## SMS / OTP

- Aucun fournisseur SMS n'est imposé dans le brief. J'utilise `SMS_PROVIDER=mock` par défaut en développement. Quel fournisseur SMS souhaitez-vous utiliser en production pour le Cameroun/CEMAC (Twilio, Nexmo/Vonage, un agrégateur local type Mega Fon, Nexah, etc.) ?

## Notifications push

- Le brief mentionne « Expo / Firebase », pensé pour le mobile. Sans app mobile, les notifications push se feront en **Web Push** (API navigateur standard, clés VAPID) — moins fiable que du natif sur mobile (dépend du navigateur, pas de push en arrière-plan sur iOS Safari avant iOS 16.4+). Les rappels J-3 de paiement et alertes critiques s'appuieront surtout sur **SMS** et **in-app**. Êtes-vous d'accord avec cette approche, ou souhaitez-vous qu'on prévoie une PWA installable pour fiabiliser les push sur mobile ?

## Hébergement

- Le brief demande un hébergement « prévu au Cameroun ou avec autorisation de transfert ». Avez-vous déjà un hébergeur/cloud provider pressenti (pour dimensionner le Dockerfile / déploiement en Phase 8) ?

## KYC

- Au MVP la vérification KYC est manuelle (upload + validation admin). Pour le stockage des pièces d'identité/selfies, avez-vous une préférence de stockage (S3-compatible type MinIO auto-hébergé, ou un service cloud) ? Je prévois une interface de stockage abstraite pour rester portable.

## Vérification des cartes cadeaux

- Vérification manuelle au MVP via l'interface `GiftCardVerifier` (apps/api/src/gift-cards/verifiers/). `ManualGiftCardVerifier` est le seul fournisseur branché : il ne confirme jamais rien automatiquement, un admin valide via `POST /gift-cards/listings/:id/verify` après avoir consulté le code chiffré via `GET /gift-cards/listings/:id/admin/code` (accès journalisé). Si vous avez déjà identifié une API tierce de vérification de solde (par marque de carte), merci de la préciser pour brancher un futur `GiftCardVerifier` automatisé sans changer le reste du code.

## Commission Premium sur les cartes cadeaux (décision prise)

- Le brief dit « Premium : 1 000 XAF/mois (frais réduits de moitié) » sans préciser si la réduction s'applique aussi à la commission de 8 % sur la revente de cartes cadeaux (qui est à la charge du **vendeur**, alors que la réduction est décrite dans le contexte des frais payés par le **co-abonné**). J'ai choisi d'appliquer la réduction de moitié de façon symétrique : un vendeur Premium paie 4 % au lieu de 8 % (voir `computeGiftCardSaleAmount` dans `packages/shared/src/pricing.ts`). Dites-moi si ce n'est pas l'intention et je retire la réduction côté vendeur.

## Séquestre des paiements d'abonnement en plusieurs mois d'avance (décision prise)

- Pour un paiement de 3 ou 6 mois d'avance, j'ai choisi un séquestre unique de 48h sur la totalité du montant (un seul litige possible pour toute la période), plutôt qu'une libération progressive mois par mois à mesure que chaque période démarre. C'est plus simple et évite de retarder le paiement du propriétaire pour des mois à venir. Dites-moi si vous préférez une libération progressive.
