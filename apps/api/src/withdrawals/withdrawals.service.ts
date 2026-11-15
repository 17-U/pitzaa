import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MobileMoneyOperator } from '@prisma/client';
import {
  MIN_WITHDRAWAL_AMOUNT_XAF,
  WITHDRAWAL_FEE_BELOW_THRESHOLD_XAF,
  WITHDRAWAL_FEE_FREE_THRESHOLD_XAF,
} from '@pitzaa/shared';
import { LedgerService } from '../ledger/ledger.service';
import { OtpService } from '../otp/otp.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateWithdrawalParams {
  userId: string;
  amountXaf: number;
  operator: MobileMoneyOperator;
  destinationMsisdn: string;
  otpCode: string;
}

function computeFeeXaf(amountXaf: number): number {
  return amountXaf >= WITHDRAWAL_FEE_FREE_THRESHOLD_XAF
    ? 0
    : WITHDRAWAL_FEE_BELOW_THRESHOLD_XAF;
}

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly otp: OtpService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /** 2FA obligatoire avant tout retrait : un OTP frais doit être demandé avant cet appel. */
  async requestWithdrawalOtp(userId: string): Promise<{ expiresAt: Date }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return this.otp.request(user.phone, 'WITHDRAWAL', user.locale);
  }

  async createWithdrawal(params: CreateWithdrawalParams) {
    if (params.amountXaf < MIN_WITHDRAWAL_AMOUNT_XAF) {
      throw new BadRequestException(
        `Le retrait minimum est de ${MIN_WITHDRAWAL_AMOUNT_XAF} XAF.`,
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: params.userId },
    });
    await this.otp.verify(user.phone, 'WITHDRAWAL', params.otpCode);

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: params.userId },
    });
    if (!wallet) {
      throw new NotFoundException('Portefeuille introuvable.');
    }

    const feeAmountXaf = computeFeeXaf(params.amountXaf);
    const totalXaf = params.amountXaf + feeAmountXaf;

    if (wallet.availableBalanceXaf < totalXaf) {
      throw new BadRequestException(
        'Solde disponible insuffisant pour ce retrait.',
      );
    }

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.withdrawal.create({
        data: {
          userId: params.userId,
          amountXaf: params.amountXaf,
          feeAmountXaf,
          operator: params.operator,
          destinationMsisdn: params.destinationMsisdn,
        },
      });

      await this.ledger.postEntries(
        tx,
        'WITHDRAWAL',
        [
          {
            accountType: 'USER_AVAILABLE',
            entryType: 'WITHDRAWAL',
            amountXaf: -totalXaf,
            userId: params.userId,
          },
          {
            accountType: 'WITHDRAWAL_CLEARING',
            entryType: 'WITHDRAWAL',
            amountXaf: params.amountXaf,
          },
          {
            accountType: 'PLATFORM_COMMISSION',
            entryType: 'COMMISSION',
            amountXaf: feeAmountXaf,
          },
        ],
        `Retrait ${created.id} demandé par ${params.userId}`,
      );

      return created;
    });

    await this.paymentsService.initiatePayout({
      userId: params.userId,
      amountXaf: withdrawal.amountXaf,
      msisdn: params.destinationMsisdn,
      operator: params.operator,
      withdrawalId: withdrawal.id,
    });

    return this.prisma.withdrawal.findUniqueOrThrow({
      where: { id: withdrawal.id },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
