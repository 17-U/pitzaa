import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProviderName } from '@prisma/client';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import {
  CollectPaymentParams,
  CollectPaymentResult,
  PaymentProvider,
  PayoutParams,
  PayoutResult,
} from './providers/payment-provider.interface';

function toProviderName(value: string): PaymentProviderName {
  return value.toUpperCase() as PaymentProviderName;
}

/**
 * Route les appels de paiement vers un fournisseur. En développement/tests,
 * `PAYMENT_PROVIDER` force un fournisseur unique (ex: mock). En production,
 * on tente `PAYMENT_PRIMARY_PROVIDER` puis, en cas d'échec, `PAYMENT_FALLBACK_PROVIDER`.
 */
@Injectable()
export class PaymentRouterService {
  private readonly logger = new Logger(PaymentRouterService.name);

  constructor(
    private readonly registry: PaymentProviderRegistry,
    private readonly config: ConfigService,
  ) {}

  async collect(
    params: CollectPaymentParams,
  ): Promise<CollectPaymentResult & { provider: PaymentProviderName }> {
    return this.attempt((provider) => provider.collect(params));
  }

  async payout(
    params: PayoutParams,
  ): Promise<PayoutResult & { provider: PaymentProviderName }> {
    return this.attempt((provider) => provider.payout(params));
  }

  /** Fournisseur qui sera tenté en premier — utilisé pour journaliser une tentative avant son issue. */
  resolveOrder(): PaymentProviderName[] {
    const forced = this.config.get<string>('PAYMENT_PROVIDER', '');
    if (forced && forced.toLowerCase() !== 'auto') {
      return [toProviderName(forced)];
    }

    const primary = toProviderName(
      this.config.get<string>('PAYMENT_PRIMARY_PROVIDER', 'fapshi'),
    );
    const fallback = toProviderName(
      this.config.get<string>('PAYMENT_FALLBACK_PROVIDER', 'kpay'),
    );
    return primary === fallback ? [primary] : [primary, fallback];
  }

  private async attempt<R>(
    call: (provider: PaymentProvider) => Promise<R>,
  ): Promise<R & { provider: PaymentProviderName }> {
    const order = this.resolveOrder();
    let lastError: unknown;

    for (const name of order) {
      try {
        const provider = this.registry.get(name);
        const result = await call(provider);
        return { ...result, provider: name };
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Échec du fournisseur ${name}, bascule éventuelle sur le suivant`,
          error as Error,
        );
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Tous les fournisseurs de paiement ont échoué.');
  }
}
