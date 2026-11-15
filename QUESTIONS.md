# Questions ouvertes

Liste des points qui nécessitent une décision métier ou une information que je n'ai pas (clé API, doc fournisseur, choix produit). Je continue avec des valeurs d'exemple / hypothèses raisonnables en attendant vos réponses.

## Paiements mobile money

- **Documentation Fapshi** : je n'ai pas (encore) lu la documentation officielle de l'API Fapshi (endpoints `collect`, `getStatus`, `payout`, format des webhooks, signature). L'adaptateur `FapshiProvider` sera écrit derrière l'interface `PaymentProvider` avec des `TODO` explicites tant que la doc n'est pas vérifiée. → À faire en Phase 2 : fournir un lien vers la doc Fapshi à jour, ou les specs d'API (Postman/OpenAPI) si disponibles.
- **Documentation KPay** : même remarque pour `KPayProvider`. Merci de fournir la doc officielle (endpoints, format de signature de webhook, codes d'erreur).
- **Comptes sandbox** : avez-vous des comptes de test (sandbox) Fapshi/KPay pour valider les intégrations avant la production ?

## SMS / OTP

- Aucun fournisseur SMS n'est imposé dans le brief. J'utilise `SMS_PROVIDER=mock` par défaut en développement. Quel fournisseur SMS souhaitez-vous utiliser en production pour le Cameroun/CEMAC (Twilio, Nexmo/Vonage, un agrégateur local type Mega Fon, Nexah, etc.) ?

## Notifications push

- Le brief mentionne « Expo / Firebase ». Utiliserez-vous les notifications push Expo (simple, géré par Expo) ou Firebase Cloud Messaging directement (plus de contrôle, nécessite un projet Firebase) ? Par défaut je pars sur les push Expo en MVP (plus simple avec Expo Router), avec la possibilité de brancher Firebase plus tard.

## Hébergement

- Le brief demande un hébergement « prévu au Cameroun ou avec autorisation de transfert ». Avez-vous déjà un hébergeur/cloud provider pressenti (pour dimensionner le Dockerfile / déploiement en Phase 8) ?

## KYC

- Au MVP la vérification KYC est manuelle (upload + validation admin). Pour le stockage des pièces d'identité/selfies, avez-vous une préférence de stockage (S3-compatible type MinIO auto-hébergé, ou un service cloud) ? Je prévois une interface de stockage abstraite pour rester portable.

## Vérification des cartes cadeaux

- Vérification manuelle au MVP via une interface `GiftCardVerifier`. Si vous avez déjà identifié une API tierce de vérification de solde (par marque de carte), merci de la préciser pour la Phase 4.
