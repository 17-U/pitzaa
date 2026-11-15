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
 * Adaptateur KPay (fournisseur de secours) — TODO(QUESTIONS.md).
 *
 * Même remarque que pour FapshiProvider : documentation officielle non disponible
 * au moment d'écrire cet adaptateur. Squelette à compléter — voir QUESTIONS.md.
 *
 * Ne PAS appeler ce fournisseur en développement/tests : utiliser PAYMENT_PROVIDER=mock
 * (voir MockPaymentProvider) tant que cet adaptateur n'est pas implémenté.
 */
@Injectable()
export class KPayProvider implements PaymentProvider {
  readonly name = 'KPAY' as const;

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.getOrThrow<string>('KPAY_BASE_URL');
  }

  private get apiKey(): string {
    return this.config.getOrThrow<string>('KPAY_API_KEY');
  }

  private get secretKey(): string {
    return this.config.getOrThrow<string>('KPAY_SECRET_KEY');
  }

  async collect(_params: CollectPaymentParams): Promise<CollectPaymentResult> {
    // TODO(QUESTIONS.md): appeler l'endpoint de collecte KPay.
    void this.baseUrl;
    void this.apiKey;
    void this.secretKey;
    throw new Error('KPayProvider.collect: non implémenté — voir QUESTIONS.md');
  }

  async getStatus(_providerReference: string): Promise<PaymentStatusResult> {
    // TODO(QUESTIONS.md): appeler l'endpoint de statut KPay.
    throw new Error(
      'KPayProvider.getStatus: non implémenté — voir QUESTIONS.md',
    );
  }

  async payout(_params: PayoutParams): Promise<PayoutResult> {
    // TODO(QUESTIONS.md): appeler l'endpoint de paiement sortant (retrait) KPay.
    throw new Error('KPayProvider.payout: non implémenté — voir QUESTIONS.md');
  }

  parseWebhook(
    _rawBody: Buffer,
    _headers: Record<string, string>,
  ): NormalizedWebhookEvent {
    // TODO(QUESTIONS.md): vérifier la signature du webhook KPay puis normaliser le payload.
    throw new Error(
      'KPayProvider.parseWebhook: non implémenté — voir QUESTIONS.md',
    );
  }
}
