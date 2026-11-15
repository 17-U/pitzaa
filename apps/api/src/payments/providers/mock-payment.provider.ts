import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CollectPaymentParams,
  CollectPaymentResult,
  InvalidWebhookSignatureError,
  NormalizedWebhookEvent,
  PaymentProvider,
  PaymentStatusResult,
  PayoutParams,
  PayoutResult,
  ProviderCallStatus,
} from './payment-provider.interface';

interface MockEntry {
  finalStatus: ProviderCallStatus;
  resolveAt: number;
}

/** Numéro de test déclenchant un échec immédiat (ex: +23761234<0000>). */
const FAILURE_SUFFIX = '0000';
/** Numéro de test qui reste indéfiniment en attente (simule un délai/timeout fournisseur). */
const STUCK_SUFFIX = '1111';
/** Délai simulé avant qu'un succès/échec normal ne soit visible via getStatus(). */
const RESOLUTION_DELAY_MS = 50;

/**
 * Fournisseur de paiement simulé pour le développement et les tests : aucun appel
 * réseau réel, comportement déterministe piloté par le suffixe du numéro mobile money.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK' as const;

  private readonly entries = new Map<string, MockEntry>();

  constructor(private readonly config: ConfigService) {}

  async collect(params: CollectPaymentParams): Promise<CollectPaymentResult> {
    const providerReference = `mock_${randomUUID()}`;
    this.entries.set(providerReference, this.resolveFor(params.msisdn));
    return { providerReference, status: 'PENDING' };
  }

  async payout(params: PayoutParams): Promise<PayoutResult> {
    const providerReference = `mock_${randomUUID()}`;
    this.entries.set(providerReference, this.resolveFor(params.msisdn));
    return { providerReference, status: 'PENDING' };
  }

  async getStatus(providerReference: string): Promise<PaymentStatusResult> {
    const entry = this.entries.get(providerReference);
    if (!entry) {
      return { providerReference, status: 'FAILED' };
    }
    const status =
      Date.now() >= entry.resolveAt ? entry.finalStatus : 'PENDING';
    return { providerReference, status };
  }

  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): NormalizedWebhookEvent {
    const expectedSecret = this.config.get<string>(
      'MOCK_WEBHOOK_SECRET',
      'mock_webhook_secret',
    );
    if (headers['x-mock-signature'] !== expectedSecret) {
      throw new InvalidWebhookSignatureError('MOCK');
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as {
      eventId: string;
      providerReference: string;
      status: ProviderCallStatus;
    };

    return {
      providerEventId: payload.eventId,
      providerReference: payload.providerReference,
      status: payload.status,
    };
  }

  /** Permet aux tests de forcer la résolution immédiate d'une transaction donnée. */
  forceResolve(providerReference: string, status: ProviderCallStatus): void {
    this.entries.set(providerReference, {
      finalStatus: status,
      resolveAt: Date.now(),
    });
  }

  private resolveFor(msisdn: string): MockEntry {
    if (msisdn.endsWith(FAILURE_SUFFIX)) {
      return { finalStatus: 'FAILED', resolveAt: Date.now() };
    }
    if (msisdn.endsWith(STUCK_SUFFIX)) {
      return { finalStatus: 'PENDING', resolveAt: Number.POSITIVE_INFINITY };
    }
    return {
      finalStatus: 'SUCCEEDED',
      resolveAt: Date.now() + RESOLUTION_DELAY_MS,
    };
  }
}
