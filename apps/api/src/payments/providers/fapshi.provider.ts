import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CollectPaymentParams,
  CollectPaymentResult,
  NormalizedWebhookEvent,
  PaymentProvider,
  PaymentStatusResult,
  PayoutParams,
  PayoutResult,
} from './payment-provider.interface';

/**
 * Adaptateur Fapshi (fournisseur principal) — TODO(QUESTIONS.md).
 *
 * Je n'ai pas eu accès à la documentation officielle de l'API Fapshi au moment
 * d'écrire cet adaptateur (endpoints `collect`/`getStatus`/`payout`, format exact
 * des champs, en-têtes d'authentification `FAPSHI_API_USER`/`FAPSHI_API_KEY`,
 * format de signature des webhooks). Plutôt que de deviner des noms d'endpoints
 * ou de champs, chaque méthode est un squelette documenté : à compléter une fois
 * la documentation (ou une collection Postman/OpenAPI) fournie — voir QUESTIONS.md.
 *
 * Ne PAS appeler ce fournisseur en développement/tests : utiliser PAYMENT_PROVIDER=mock
 * (voir MockPaymentProvider) tant que cet adaptateur n'est pas implémenté.
 */
@Injectable()
export class FapshiProvider implements PaymentProvider {
  readonly name = 'FAPSHI' as const;

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.getOrThrow<string>('FAPSHI_BASE_URL');
  }

  private get apiUser(): string {
    return this.config.getOrThrow<string>('FAPSHI_API_USER');
  }

  private get apiKey(): string {
    return this.config.getOrThrow<string>('FAPSHI_API_KEY');
  }

  async collect(_params: CollectPaymentParams): Promise<CollectPaymentResult> {
    // TODO(QUESTIONS.md): appeler l'endpoint de collecte Fapshi (ex. "initiate-pay")
    // avec this.baseUrl / this.apiUser / this.apiKey une fois la doc confirmée.
    void this.baseUrl;
    void this.apiUser;
    void this.apiKey;
    throw new Error(
      'FapshiProvider.collect: non implémenté — voir QUESTIONS.md',
    );
  }

  async getStatus(_providerReference: string): Promise<PaymentStatusResult> {
    // TODO(QUESTIONS.md): appeler l'endpoint de statut Fapshi.
    throw new Error(
      'FapshiProvider.getStatus: non implémenté — voir QUESTIONS.md',
    );
  }

  async payout(_params: PayoutParams): Promise<PayoutResult> {
    // TODO(QUESTIONS.md): appeler l'endpoint de paiement sortant (retrait) Fapshi.
    throw new Error(
      'FapshiProvider.payout: non implémenté — voir QUESTIONS.md',
    );
  }

  parseWebhook(
    _rawBody: Buffer,
    _headers: Record<string, string>,
  ): NormalizedWebhookEvent {
    // TODO(QUESTIONS.md): vérifier la signature du webhook Fapshi (en-tête exact
    // à confirmer) puis normaliser le payload.
    throw new Error(
      'FapshiProvider.parseWebhook: non implémenté — voir QUESTIONS.md',
    );
  }
}
