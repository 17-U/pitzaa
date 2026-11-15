import { BadRequestException } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';

function createFakePrisma() {
  const user = { findUniqueOrThrow: jest.fn() };
  const wallet = { findUnique: jest.fn() };
  const withdrawal = { create: jest.fn(), findUniqueOrThrow: jest.fn() };

  const tx = { withdrawal };
  const prisma = {
    user,
    wallet,
    withdrawal,
    $transaction: jest.fn(
      async (callback: (t: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };

  return { prisma, user, wallet, withdrawal };
}

function createFakeLedger() {
  return { postEntries: jest.fn().mockResolvedValue({ id: 'ltx_1' }) };
}

function createFakeOtp() {
  return {
    request: jest.fn().mockResolvedValue({ expiresAt: new Date() }),
    verify: jest.fn().mockResolvedValue(undefined),
  };
}

function createFakePaymentsService() {
  return {
    initiatePayout: jest
      .fn()
      .mockResolvedValue({ id: 'pay_1', status: 'PENDING' }),
  };
}

describe('WithdrawalsService', () => {
  it('requests a WITHDRAWAL-purpose OTP for the user own phone/locale', async () => {
    const { prisma, user } = createFakePrisma();
    user.findUniqueOrThrow.mockResolvedValue({
      phone: '+237612345678',
      locale: 'fr',
    });
    const otp = createFakeOtp();

    const service = new WithdrawalsService(
      prisma as never,
      createFakeLedger() as never,
      otp as never,
      createFakePaymentsService() as never,
    );
    await service.requestWithdrawalOtp('user_1');

    expect(otp.request).toHaveBeenCalledWith(
      '+237612345678',
      'WITHDRAWAL',
      'fr',
    );
  });

  it('rejects an amount below the minimum withdrawal before even checking the OTP', async () => {
    const { prisma, user } = createFakePrisma();
    user.findUniqueOrThrow.mockResolvedValue({
      phone: '+237612345678',
      locale: 'fr',
    });
    const otp = createFakeOtp();

    const service = new WithdrawalsService(
      prisma as never,
      createFakeLedger() as never,
      otp as never,
      createFakePaymentsService() as never,
    );

    await expect(
      service.createWithdrawal({
        userId: 'user_1',
        amountXaf: 100,
        operator: 'MTN_MOMO',
        destinationMsisdn: '+237612345678',
        otpCode: '123456',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(otp.verify).not.toHaveBeenCalled();
  });

  it('propagates an invalid OTP without touching the balance', async () => {
    const { prisma, user, wallet } = createFakePrisma();
    user.findUniqueOrThrow.mockResolvedValue({
      phone: '+237612345678',
      locale: 'fr',
    });
    const otp = createFakeOtp();
    otp.verify.mockRejectedValue(
      new BadRequestException('Code invalide ou expiré.'),
    );

    const service = new WithdrawalsService(
      prisma as never,
      createFakeLedger() as never,
      otp as never,
      createFakePaymentsService() as never,
    );

    await expect(
      service.createWithdrawal({
        userId: 'user_1',
        amountXaf: 5000,
        operator: 'MTN_MOMO',
        destinationMsisdn: '+237612345678',
        otpCode: '000000',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(wallet.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a withdrawal when the available balance is insufficient', async () => {
    const { prisma, user, wallet } = createFakePrisma();
    user.findUniqueOrThrow.mockResolvedValue({
      phone: '+237612345678',
      locale: 'fr',
    });
    wallet.findUnique.mockResolvedValue({ availableBalanceXaf: 1000 });
    const otp = createFakeOtp();
    const payments = createFakePaymentsService();

    const service = new WithdrawalsService(
      prisma as never,
      createFakeLedger() as never,
      otp as never,
      payments as never,
    );

    await expect(
      service.createWithdrawal({
        userId: 'user_1',
        amountXaf: 5000,
        operator: 'MTN_MOMO',
        destinationMsisdn: '+237612345678',
        otpCode: '123456',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(payments.initiatePayout).not.toHaveBeenCalled();
  });

  it('reserves amount + fee below the free threshold and pays out only the requested amount', async () => {
    const { prisma, user, wallet, withdrawal } = createFakePrisma();
    user.findUniqueOrThrow.mockResolvedValue({
      phone: '+237612345678',
      locale: 'fr',
    });
    wallet.findUnique.mockResolvedValue({ availableBalanceXaf: 10_000 });
    withdrawal.create.mockResolvedValue({
      id: 'wd_1',
      amountXaf: 1000,
      feeAmountXaf: 100,
    });
    withdrawal.findUniqueOrThrow.mockResolvedValue({
      id: 'wd_1',
      status: 'PENDING',
    });
    const otp = createFakeOtp();
    const ledger = createFakeLedger();
    const payments = createFakePaymentsService();

    const service = new WithdrawalsService(
      prisma as never,
      ledger as never,
      otp as never,
      payments as never,
    );

    await service.createWithdrawal({
      userId: 'user_1',
      amountXaf: 1000,
      operator: 'MTN_MOMO',
      destinationMsisdn: '+237612345678',
      otpCode: '123456',
    });

    expect(ledger.postEntries).toHaveBeenCalledWith(
      expect.anything(),
      'WITHDRAWAL',
      [
        {
          accountType: 'USER_AVAILABLE',
          entryType: 'WITHDRAWAL',
          amountXaf: -1100,
          userId: 'user_1',
        },
        {
          accountType: 'WITHDRAWAL_CLEARING',
          entryType: 'WITHDRAWAL',
          amountXaf: 1000,
        },
        {
          accountType: 'PLATFORM_COMMISSION',
          entryType: 'COMMISSION',
          amountXaf: 100,
        },
      ],
      expect.any(String),
    );
    expect(payments.initiatePayout).toHaveBeenCalledWith({
      userId: 'user_1',
      amountXaf: 1000,
      msisdn: '+237612345678',
      operator: 'MTN_MOMO',
      withdrawalId: 'wd_1',
    });
  });

  it('waives the fee at or above the free threshold', async () => {
    const { prisma, user, wallet, withdrawal } = createFakePrisma();
    user.findUniqueOrThrow.mockResolvedValue({
      phone: '+237612345678',
      locale: 'fr',
    });
    wallet.findUnique.mockResolvedValue({ availableBalanceXaf: 20_000 });
    withdrawal.create.mockResolvedValue({
      id: 'wd_2',
      amountXaf: 5000,
      feeAmountXaf: 0,
    });
    withdrawal.findUniqueOrThrow.mockResolvedValue({
      id: 'wd_2',
      status: 'PENDING',
    });
    const otp = createFakeOtp();
    const ledger = createFakeLedger();

    const service = new WithdrawalsService(
      prisma as never,
      ledger as never,
      otp as never,
      createFakePaymentsService() as never,
    );

    await service.createWithdrawal({
      userId: 'user_1',
      amountXaf: 5000,
      operator: 'MTN_MOMO',
      destinationMsisdn: '+237612345678',
      otpCode: '123456',
    });

    expect(ledger.postEntries).toHaveBeenCalledWith(
      expect.anything(),
      'WITHDRAWAL',
      [
        {
          accountType: 'USER_AVAILABLE',
          entryType: 'WITHDRAWAL',
          amountXaf: -5000,
          userId: 'user_1',
        },
        {
          accountType: 'WITHDRAWAL_CLEARING',
          entryType: 'WITHDRAWAL',
          amountXaf: 5000,
        },
        {
          accountType: 'PLATFORM_COMMISSION',
          entryType: 'COMMISSION',
          amountXaf: 0,
        },
      ],
      expect.any(String),
    );
  });
});
