import { MobileMoneyOperator, PaymentProviderName } from '@prisma/client';

export const PAYMENT_PROVIDER_REGISTRY_TOKENS: Record<
  PaymentProviderName,
  string
> = {
  MOCK: 'PAYMENT_PROVIDER_MOCK',
  FAPSHI: 'PAYMENT_PROVIDER_FAPSHI',
  KPAY: 'PAYMENT_PROVIDER_KPAY',
};

export type ProviderCallStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface CollectPaymentParams {
  /** Référence interne (ex: Payment.id) permettant de retrouver la transaction côté Pitzaa. */
  reference: string;
  amountXaf: number;
  msisdn: string;
  operator: MobileMoneyOperator;
  description?: string;
}

export interface CollectPaymentResult {
  providerReference: string;
  status: ProviderCallStatus;
}

export interface PayoutParams {
  reference: string;
  amountXaf: number;
  msisdn: string;
  operator: MobileMoneyOperator;
}

export interface PayoutResult {
  providerReference: string;
  status: ProviderCallStatus;
}

export interface PaymentStatusResult {
  providerReference: string;
  status: ProviderCallStatus;
}

/** Événement de webhook normalisé, une fois la signature du fournisseur vérifiée. */
export interface NormalizedWebhookEvent {
  providerEventId: string;
  providerReference: string;
  status: ProviderCallStatus;
}

export class InvalidWebhookSignatureError extends Error {
  constructor(provider: PaymentProviderName) {
    super(`Signature de webhook invalide pour le fournisseur ${provider}`);
    this.name = 'InvalidWebhookSignatureError';
  }
}

/**
 * Interface unique pour les fournisseurs de paiement mobile money.
 * Toute logique métier doit passer par cette interface, jamais par un appel
 * direct à un SDK fournisseur, pour permettre le routage et les tests via MockProvider.
 */
export interface PaymentProvider {
  readonly name: PaymentProviderName;

  collect(params: CollectPaymentParams): Promise<CollectPaymentResult>;

  getStatus(providerReference: string): Promise<PaymentStatusResult>;

  payout(params: PayoutParams): Promise<PayoutResult>;

  /** Vérifie la signature et normalise le payload. Lève InvalidWebhookSignatureError si invalide. */
  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): NormalizedWebhookEvent;
}
