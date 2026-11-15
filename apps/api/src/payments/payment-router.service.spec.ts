import { ConfigService } from '@nestjs/config';
import { PaymentRouterService } from './payment-router.service';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';

function createConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as unknown as ConfigService;
}

function createRegistry(
  providers: Record<string, { collect: jest.Mock; payout: jest.Mock }>,
): PaymentProviderRegistry {
  return {
    get: (name: string) => providers[name],
  } as unknown as PaymentProviderRegistry;
}

describe('PaymentRouterService', () => {
  it('uses the forced PAYMENT_PROVIDER when set, ignoring primary/fallback', async () => {
    const mock = {
      collect: jest
        .fn()
        .mockResolvedValue({ providerReference: 'r1', status: 'PENDING' }),
      payout: jest.fn(),
    };
    const registry = createRegistry({ MOCK: mock });
    const config = createConfig({ PAYMENT_PROVIDER: 'mock' });
    const router = new PaymentRouterService(registry, config);

    const result = await router.collect({
      reference: 'ref',
      amountXaf: 100,
      msisdn: '+237600000000',
      operator: 'MTN_MOMO',
    });

    expect(result).toEqual({
      providerReference: 'r1',
      status: 'PENDING',
      provider: 'MOCK',
    });
    expect(mock.collect).toHaveBeenCalledTimes(1);
  });

  it('tries the primary provider first and succeeds without touching the fallback', async () => {
    const fapshi = {
      collect: jest
        .fn()
        .mockResolvedValue({ providerReference: 'r1', status: 'PENDING' }),
      payout: jest.fn(),
    };
    const kpay = { collect: jest.fn(), payout: jest.fn() };
    const registry = createRegistry({ FAPSHI: fapshi, KPAY: kpay });
    const config = createConfig({
      PAYMENT_PRIMARY_PROVIDER: 'fapshi',
      PAYMENT_FALLBACK_PROVIDER: 'kpay',
    });
    const router = new PaymentRouterService(registry, config);

    const result = await router.collect({
      reference: 'ref',
      amountXaf: 100,
      msisdn: '+237600000000',
      operator: 'MTN_MOMO',
    });

    expect(result.provider).toBe('FAPSHI');
    expect(kpay.collect).not.toHaveBeenCalled();
  });

  it('falls back to the secondary provider when the primary fails', async () => {
    const fapshi = {
      collect: jest.fn().mockRejectedValue(new Error('fapshi down')),
      payout: jest.fn(),
    };
    const kpay = {
      collect: jest
        .fn()
        .mockResolvedValue({ providerReference: 'r2', status: 'PENDING' }),
      payout: jest.fn(),
    };
    const registry = createRegistry({ FAPSHI: fapshi, KPAY: kpay });
    const config = createConfig({
      PAYMENT_PRIMARY_PROVIDER: 'fapshi',
      PAYMENT_FALLBACK_PROVIDER: 'kpay',
    });
    const router = new PaymentRouterService(registry, config);

    const result = await router.collect({
      reference: 'ref',
      amountXaf: 100,
      msisdn: '+237600000000',
      operator: 'MTN_MOMO',
    });

    expect(result).toEqual({
      providerReference: 'r2',
      status: 'PENDING',
      provider: 'KPAY',
    });
    expect(fapshi.collect).toHaveBeenCalledTimes(1);
  });

  it('throws when every provider in the order fails', async () => {
    const fapshi = {
      collect: jest.fn().mockRejectedValue(new Error('fapshi down')),
      payout: jest.fn(),
    };
    const kpay = {
      collect: jest.fn().mockRejectedValue(new Error('kpay down')),
      payout: jest.fn(),
    };
    const registry = createRegistry({ FAPSHI: fapshi, KPAY: kpay });
    const config = createConfig({
      PAYMENT_PRIMARY_PROVIDER: 'fapshi',
      PAYMENT_FALLBACK_PROVIDER: 'kpay',
    });
    const router = new PaymentRouterService(registry, config);

    await expect(
      router.collect({
        reference: 'ref',
        amountXaf: 100,
        msisdn: '+237600000000',
        operator: 'MTN_MOMO',
      }),
    ).rejects.toThrow('kpay down');
  });

  it('does not duplicate the attempt when primary and fallback are the same provider', async () => {
    const fapshi = {
      collect: jest
        .fn()
        .mockResolvedValue({ providerReference: 'r1', status: 'PENDING' }),
      payout: jest.fn(),
    };
    const registry = createRegistry({ FAPSHI: fapshi });
    const config = createConfig({
      PAYMENT_PRIMARY_PROVIDER: 'fapshi',
      PAYMENT_FALLBACK_PROVIDER: 'fapshi',
    });
    const router = new PaymentRouterService(registry, config);

    expect(router.resolveOrder()).toEqual(['FAPSHI']);
    await router.collect({
      reference: 'ref',
      amountXaf: 100,
      msisdn: '+237600000000',
      operator: 'MTN_MOMO',
    });
    expect(fapshi.collect).toHaveBeenCalledTimes(1);
  });
});
