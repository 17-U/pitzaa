import { PaymentsService } from './payments.service';

function createFakePrisma() {
  const payment = {
    create: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  };
  const withdrawal = {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  };
  const membershipPayment = {
    update: jest.fn(),
    findUnique: jest.fn(),
  };
  const giftCardOrder = {
    update: jest.fn(),
    findUnique: jest.fn(),
  };

  const tx = { payment, withdrawal, membershipPayment, giftCardOrder };

  const prisma = {
    ...tx,
    $transaction: jest.fn(
      async (callback: (t: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };

  return { prisma, payment, withdrawal, membershipPayment, giftCardOrder };
}

function createFakeRouter(order: string[] = ['MOCK']) {
  return {
    resolveOrder: jest.fn().mockReturnValue(order),
    collect: jest.fn(),
    payout: jest.fn(),
  };
}

function createFakeRegistry(getStatus: jest.Mock) {
  return { get: jest.fn().mockReturnValue({ getStatus }) };
}

function createFakeLedger() {
  return { postEntries: jest.fn().mockResolvedValue({ id: 'ltx_1' }) };
}

function basePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay_1',
    userId: 'user_1',
    provider: 'MOCK',
    providerReference: 'mock_ref_1',
    direction: 'COLLECTION',
    purpose: 'MEMBERSHIP_PAYMENT',
    amountXaf: 2500,
    status: 'PENDING',
    idempotencyKey: 'idem_1',
    membershipPaymentId: null,
    giftCardOrderId: null,
    withdrawalId: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('PaymentsService', () => {
  describe('initiateCollection', () => {
    it('creates a pending payment and records the provider result', async () => {
      const { prisma, payment } = createFakePrisma();
      payment.create.mockResolvedValue(
        basePayment({ status: 'PENDING', providerReference: null }),
      );
      payment.update.mockResolvedValue(
        basePayment({
          status: 'PENDING',
          provider: 'MOCK',
          providerReference: 'r1',
        }),
      );
      const router = createFakeRouter();
      router.collect.mockResolvedValue({
        provider: 'MOCK',
        providerReference: 'r1',
        status: 'PENDING',
      });

      const service = new PaymentsService(
        prisma as never,
        router as never,
        createFakeRegistry(jest.fn()) as never,
        createFakeLedger() as never,
      );

      const result = await service.initiateCollection({
        userId: 'user_1',
        amountXaf: 2500,
        msisdn: '+237690000002',
        operator: 'MTN_MOMO',
        purpose: 'MEMBERSHIP_PAYMENT',
        membershipPaymentId: 'mp_1',
      });

      expect(result.status).toBe('PENDING');
      expect(payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_1' },
        data: { provider: 'MOCK', providerReference: 'r1', status: 'PENDING' },
      });
    });

    it('marks the payment as FAILED when every provider fails', async () => {
      const { prisma, payment } = createFakePrisma();
      payment.create.mockResolvedValue(basePayment());
      payment.update.mockResolvedValue(basePayment({ status: 'FAILED' }));
      const router = createFakeRouter();
      router.collect.mockRejectedValue(new Error('all providers down'));

      const service = new PaymentsService(
        prisma as never,
        router as never,
        createFakeRegistry(jest.fn()) as never,
        createFakeLedger() as never,
      );

      await service.initiateCollection({
        userId: 'user_1',
        amountXaf: 2500,
        msisdn: '+237690000002',
        operator: 'MTN_MOMO',
        purpose: 'MEMBERSHIP_PAYMENT',
      });

      expect(payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_1' },
        data: { status: 'FAILED', failureReason: 'all providers down' },
      });
    });
  });

  describe('initiatePayout', () => {
    it('refunds the reserved balance immediately when the payout fails synchronously', async () => {
      const { prisma, payment, withdrawal } = createFakePrisma();
      payment.create.mockResolvedValue(
        basePayment({
          direction: 'PAYOUT',
          withdrawalId: 'wd_1',
          purpose: 'WITHDRAWAL',
        }),
      );
      payment.update.mockResolvedValue(
        basePayment({
          direction: 'PAYOUT',
          withdrawalId: 'wd_1',
          purpose: 'WITHDRAWAL',
          provider: 'MOCK',
          providerReference: 'r2',
        }),
      );
      withdrawal.findUniqueOrThrow.mockResolvedValue({
        id: 'wd_1',
        userId: 'user_1',
        amountXaf: 2000,
        feeAmountXaf: 100,
      });
      const router = createFakeRouter();
      router.payout.mockResolvedValue({
        provider: 'MOCK',
        providerReference: 'r2',
        status: 'FAILED',
      });
      const ledger = createFakeLedger();

      const service = new PaymentsService(
        prisma as never,
        router as never,
        createFakeRegistry(jest.fn()) as never,
        ledger as never,
      );

      await service.initiatePayout({
        userId: 'user_1',
        amountXaf: 2000,
        msisdn: '+237690000000',
        operator: 'MTN_MOMO',
        withdrawalId: 'wd_1',
      });

      expect(ledger.postEntries).toHaveBeenCalledWith(
        expect.anything(),
        'REFUND',
        [
          {
            accountType: 'USER_AVAILABLE',
            entryType: 'REFUND',
            amountXaf: 2100,
            userId: 'user_1',
          },
          {
            accountType: 'WITHDRAWAL_CLEARING',
            entryType: 'REFUND',
            amountXaf: -2000,
          },
          {
            accountType: 'PLATFORM_COMMISSION',
            entryType: 'REFUND',
            amountXaf: -100,
          },
        ],
        expect.any(String),
      );
      expect(withdrawal.update).toHaveBeenCalledWith({
        where: { id: 'wd_1' },
        data: { status: 'FAILED', failureReason: expect.any(String) },
      });
    });
  });

  describe('confirmPendingPayment', () => {
    it('is a no-op for a payment already in a terminal state', async () => {
      const { prisma, payment } = createFakePrisma();
      payment.findUniqueOrThrow.mockResolvedValue(
        basePayment({ status: 'SUCCEEDED' }),
      );
      const getStatus = jest.fn();

      const service = new PaymentsService(
        prisma as never,
        createFakeRouter() as never,
        createFakeRegistry(getStatus) as never,
        createFakeLedger() as never,
      );

      const result = await service.confirmPendingPayment('pay_1');

      expect(result.status).toBe('SUCCEEDED');
      expect(getStatus).not.toHaveBeenCalled();
    });

    it('does nothing while the provider still reports PENDING', async () => {
      const { prisma, payment } = createFakePrisma();
      const pending = basePayment({ status: 'PENDING' });
      payment.findUniqueOrThrow.mockResolvedValue(pending);
      const getStatus = jest.fn().mockResolvedValue({
        providerReference: 'mock_ref_1',
        status: 'PENDING',
      });
      const ledger = createFakeLedger();

      const service = new PaymentsService(
        prisma as never,
        createFakeRouter() as never,
        createFakeRegistry(getStatus) as never,
        ledger as never,
      );

      await service.confirmPendingPayment('pay_1');

      expect(ledger.postEntries).not.toHaveBeenCalled();
      expect(payment.update).not.toHaveBeenCalled();
    });

    it('holds the collected amount in the escrow of the resolved beneficiary on success', async () => {
      const { prisma, payment, membershipPayment } = createFakePrisma();
      payment.findUniqueOrThrow.mockResolvedValue(
        basePayment({ status: 'PENDING', membershipPaymentId: 'mp_1' }),
      );
      membershipPayment.findUnique.mockResolvedValue({
        membership: { group: { ownerId: 'owner_1' } },
      });
      const getStatus = jest.fn().mockResolvedValue({
        providerReference: 'mock_ref_1',
        status: 'SUCCEEDED',
      });
      const ledger = createFakeLedger();
      payment.update.mockResolvedValue(basePayment({ status: 'SUCCEEDED' }));

      const service = new PaymentsService(
        prisma as never,
        createFakeRouter() as never,
        createFakeRegistry(getStatus) as never,
        ledger as never,
      );

      const result = await service.confirmPendingPayment('pay_1');

      expect(ledger.postEntries).toHaveBeenCalledWith(
        expect.anything(),
        'MEMBERSHIP_PAYMENT_COLLECTION',
        [
          {
            accountType: 'PAYMENT_PROVIDER',
            entryType: 'PAYMENT_COLLECTED',
            amountXaf: -2500,
          },
          {
            accountType: 'USER_ESCROW',
            entryType: 'ESCROW_HOLD',
            amountXaf: 2500,
            userId: 'owner_1',
          },
        ],
        expect.any(String),
      );
      expect(membershipPayment.update).toHaveBeenCalledWith({
        where: { id: 'mp_1' },
        data: {
          status: 'PAID',
          paidAt: expect.any(Date),
          escrowReleaseAt: expect.any(Date),
        },
      });
      expect(result.status).toBe('SUCCEEDED');
    });

    it('books a direct platform fee when there is no beneficiary to hold in escrow', async () => {
      const { prisma, payment } = createFakePrisma();
      payment.findUniqueOrThrow.mockResolvedValue(
        basePayment({ status: 'PENDING', purpose: 'PREMIUM_SUBSCRIPTION' }),
      );
      const getStatus = jest.fn().mockResolvedValue({
        providerReference: 'mock_ref_1',
        status: 'SUCCEEDED',
      });
      const ledger = createFakeLedger();
      payment.update.mockResolvedValue(basePayment({ status: 'SUCCEEDED' }));

      const service = new PaymentsService(
        prisma as never,
        createFakeRouter() as never,
        createFakeRegistry(getStatus) as never,
        ledger as never,
      );

      await service.confirmPendingPayment('pay_1');

      expect(ledger.postEntries).toHaveBeenCalledWith(
        expect.anything(),
        'PREMIUM_SUBSCRIPTION_FEE',
        [
          {
            accountType: 'PAYMENT_PROVIDER',
            entryType: 'PAYMENT_COLLECTED',
            amountXaf: -2500,
          },
          {
            accountType: 'PLATFORM_COMMISSION',
            entryType: 'PREMIUM_FEE',
            amountXaf: 2500,
          },
        ],
        expect.any(String),
      );
    });

    it('marks the withdrawal as succeeded without touching the ledger on a successful payout', async () => {
      const { prisma, payment, withdrawal } = createFakePrisma();
      payment.findUniqueOrThrow.mockResolvedValue(
        basePayment({
          status: 'PENDING',
          direction: 'PAYOUT',
          withdrawalId: 'wd_1',
          purpose: 'WITHDRAWAL',
        }),
      );
      const getStatus = jest.fn().mockResolvedValue({
        providerReference: 'mock_ref_1',
        status: 'SUCCEEDED',
      });
      const ledger = createFakeLedger();
      payment.update.mockResolvedValue(
        basePayment({ status: 'SUCCEEDED', direction: 'PAYOUT' }),
      );

      const service = new PaymentsService(
        prisma as never,
        createFakeRouter() as never,
        createFakeRegistry(getStatus) as never,
        ledger as never,
      );

      await service.confirmPendingPayment('pay_1');

      expect(withdrawal.update).toHaveBeenCalledWith({
        where: { id: 'wd_1' },
        data: { status: 'SUCCEEDED', processedAt: expect.any(Date) },
      });
      expect(ledger.postEntries).not.toHaveBeenCalled();
    });

    it('refunds the reserved balance when the provider reports a failed payout asynchronously', async () => {
      const { prisma, payment, withdrawal } = createFakePrisma();
      payment.findUniqueOrThrow.mockResolvedValue(
        basePayment({
          status: 'PENDING',
          direction: 'PAYOUT',
          withdrawalId: 'wd_1',
          purpose: 'WITHDRAWAL',
        }),
      );
      withdrawal.findUniqueOrThrow.mockResolvedValue({
        id: 'wd_1',
        userId: 'user_1',
        amountXaf: 2000,
        feeAmountXaf: 100,
      });
      const getStatus = jest.fn().mockResolvedValue({
        providerReference: 'mock_ref_1',
        status: 'FAILED',
      });
      const ledger = createFakeLedger();
      payment.update.mockResolvedValue(
        basePayment({ status: 'FAILED', direction: 'PAYOUT' }),
      );

      const service = new PaymentsService(
        prisma as never,
        createFakeRouter() as never,
        createFakeRegistry(getStatus) as never,
        ledger as never,
      );

      await service.confirmPendingPayment('pay_1');

      expect(ledger.postEntries).toHaveBeenCalledWith(
        expect.anything(),
        'REFUND',
        expect.any(Array),
        expect.any(String),
      );
      expect(withdrawal.update).toHaveBeenCalledWith({
        where: { id: 'wd_1' },
        data: { status: 'FAILED', failureReason: expect.any(String) },
      });
    });

    it('marks a linked membership payment as failed without touching the ledger on a failed collection', async () => {
      const { prisma, payment, membershipPayment } = createFakePrisma();
      payment.findUniqueOrThrow.mockResolvedValue(
        basePayment({ status: 'PENDING', membershipPaymentId: 'mp_1' }),
      );
      const getStatus = jest.fn().mockResolvedValue({
        providerReference: 'mock_ref_1',
        status: 'FAILED',
      });
      const ledger = createFakeLedger();
      payment.update.mockResolvedValue(basePayment({ status: 'FAILED' }));

      const service = new PaymentsService(
        prisma as never,
        createFakeRouter() as never,
        createFakeRegistry(getStatus) as never,
        ledger as never,
      );

      await service.confirmPendingPayment('pay_1');

      expect(membershipPayment.update).toHaveBeenCalledWith({
        where: { id: 'mp_1' },
        data: { status: 'FAILED' },
      });
      expect(ledger.postEntries).not.toHaveBeenCalled();
    });
  });
});
