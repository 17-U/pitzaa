import { Injectable } from '@nestjs/common';
import { PaymentProviderName } from '@prisma/client';
import { FapshiProvider } from './fapshi.provider';
import { KPayProvider } from './kpay.provider';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProvider } from './payment-provider.interface';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: Record<PaymentProviderName, PaymentProvider>;

  constructor(
    mock: MockPaymentProvider,
    fapshi: FapshiProvider,
    kpay: KPayProvider,
  ) {
    this.providers = { MOCK: mock, FAPSHI: fapshi, KPAY: kpay };
  }

  get(name: PaymentProviderName): PaymentProvider {
    return this.providers[name];
  }
}
