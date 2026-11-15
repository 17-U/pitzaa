import { ConfigService } from '@nestjs/config';
import { InvalidWebhookSignatureError } from './payment-provider.interface';
import { MockPaymentProvider } from './mock-payment.provider';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider;

  beforeEach(() => {
    provider = new MockPaymentProvider(new ConfigService());
  });

  it('starts a collection as PENDING and resolves to SUCCEEDED shortly after for a normal number', async () => {
    const { providerReference, status } = await provider.collect({
      reference: 'ref-1',
      amountXaf: 1000,
      msisdn: '+237690000002',
      operator: 'MTN_MOMO',
    });
    expect(status).toBe('PENDING');

    await wait(100);
    const result = await provider.getStatus(providerReference);
    expect(result.status).toBe('SUCCEEDED');
  });

  it('resolves to FAILED for a number ending in the failure test suffix', async () => {
    const { providerReference } = await provider.collect({
      reference: 'ref-2',
      amountXaf: 1000,
      msisdn: '+237690000000',
      operator: 'MTN_MOMO',
    });

    const result = await provider.getStatus(providerReference);
    expect(result.status).toBe('FAILED');
  });

  it('stays PENDING forever for a number ending in the stuck test suffix', async () => {
    const { providerReference } = await provider.collect({
      reference: 'ref-3',
      amountXaf: 1000,
      msisdn: '+237690001111',
      operator: 'MTN_MOMO',
    });

    await wait(100);
    const result = await provider.getStatus(providerReference);
    expect(result.status).toBe('PENDING');
  });

  it('applies the same resolution rules to payouts', async () => {
    const { providerReference } = await provider.payout({
      reference: 'ref-4',
      amountXaf: 1000,
      msisdn: '+237690000000',
      operator: 'ORANGE_MONEY',
    });

    const result = await provider.getStatus(providerReference);
    expect(result.status).toBe('FAILED');
  });

  it('returns FAILED for an unknown provider reference', async () => {
    const result = await provider.getStatus('unknown-ref');
    expect(result.status).toBe('FAILED');
  });

  it('forceResolve lets tests fast-forward a transaction to a given status', async () => {
    const { providerReference } = await provider.collect({
      reference: 'ref-5',
      amountXaf: 1000,
      msisdn: '+237690009999',
      operator: 'MTN_MOMO',
    });

    provider.forceResolve(providerReference, 'SUCCEEDED');
    const result = await provider.getStatus(providerReference);
    expect(result.status).toBe('SUCCEEDED');
  });

  describe('parseWebhook', () => {
    const secret = 'mock_webhook_secret';

    it('parses a correctly signed webhook', () => {
      const body = Buffer.from(
        JSON.stringify({
          eventId: 'evt_1',
          providerReference: 'mock_abc',
          status: 'SUCCEEDED',
        }),
      );
      const event = provider.parseWebhook(body, { 'x-mock-signature': secret });
      expect(event).toEqual({
        providerEventId: 'evt_1',
        providerReference: 'mock_abc',
        status: 'SUCCEEDED',
      });
    });

    it('rejects a webhook with an incorrect signature', () => {
      const body = Buffer.from(
        JSON.stringify({
          eventId: 'evt_1',
          providerReference: 'mock_abc',
          status: 'SUCCEEDED',
        }),
      );
      expect(() =>
        provider.parseWebhook(body, { 'x-mock-signature': 'wrong' }),
      ).toThrow(InvalidWebhookSignatureError);
    });
  });
});
