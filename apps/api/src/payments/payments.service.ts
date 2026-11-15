import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Payment } from '@prisma/client';
import { SUBSCRIPTION_ESCROW_RELEASE_HOURS } from '@pitzaa/shared';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTransaction } from '../prisma/prisma.types';
import { PaymentRouterService } from './payment-router.service';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';
import {
  InitiateCollectionParams,
  InitiatePayoutParams,
} from './payments.types';

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: PaymentRouterService,
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly ledger: LedgerService,
  ) {}

  async initiateCollection(params: InitiateCollectionParams): Promise<Payment> {
    const payment = await this.prisma.payment.create({
      data: {
        userId: params.userId,
        provider: this.router.resolveOrder()[0],
        direction: 'COLLECTION',
        purpose: params.purpose,
        amountXaf: params.amountXaf,
        idempotencyKey: randomUUID(),
        membershipPaymentId: params.membershipPaymentId,
        giftCardOrderId: params.giftCardOrderId,
      },
    });

    try {
      const result = await this.router.collect({
        reference: payment.id,
        amountXaf: params.amountXaf,
        msisdn: params.msisdn,
        operator: params.operator,
        description: params.description,
      });

      return this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          provider: result.provider,
          providerReference: result.providerReference,
          status: result.status === 'FAILED' ? 'FAILED' : 'PENDING',
        },
      });
    } catch (error) {
      this.logger.error(
        `Échec de la collecte pour le paiement ${payment.id}`,
        error as Error,
      );
      return this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureReason: (error as Error).message },
      });
    }
  }

  async initiatePayout(params: InitiatePayoutParams): Promise<Payment> {
    const payment = await this.prisma.payment.create({
      data: {
        userId: params.userId,
        provider: this.router.resolveOrder()[0],
        direction: 'PAYOUT',
        purpose: 'WITHDRAWAL',
        amountXaf: params.amountXaf,
        idempotencyKey: randomUUID(),
        withdrawalId: params.withdrawalId,
      },
    });

    try {
      const result = await this.router.payout({
        reference: payment.id,
        amountXaf: params.amountXaf,
        msisdn: params.msisdn,
        operator: params.operator,
      });

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          provider: result.provider,
          providerReference: result.providerReference,
        },
      });

      if (result.status === 'FAILED') {
        // Échec immédiat (synchrone) : on rembourse tout de suite, comme pour un échec
        // découvert plus tard via webhook/polling (confirmPendingPayment → applyFailure).
        return this.prisma.$transaction((tx) =>
          this.applyPayoutFailure(tx, updated),
        );
      }

      return this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'PENDING' },
      });
    } catch (error) {
      this.logger.error(
        `Échec du paiement sortant pour le paiement ${payment.id}`,
        error as Error,
      );
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { failureReason: (error as Error).message },
      });
      return this.prisma.$transaction((tx) =>
        this.applyPayoutFailure(tx, updated),
      );
    }
  }

  /**
   * Confirme un paiement en attente en interrogeant le fournisseur (getStatus),
   * jamais en faisant confiance au seul contenu d'un webhook. Idempotent : un
   * paiement déjà dans un état terminal (SUCCEEDED/FAILED) n'est jamais retraité.
   */
  async confirmPendingPayment(paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });

    if (payment.status === 'SUCCEEDED' || payment.status === 'FAILED') {
      return payment;
    }
    if (!payment.providerReference) {
      this.logger.warn(
        `Paiement ${paymentId} sans providerReference, confirmation ignorée`,
      );
      return payment;
    }

    const statusResult = await this.providerRegistry
      .get(payment.provider)
      .getStatus(payment.providerReference);

    return this.prisma.$transaction(async (tx) => {
      const fresh = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
      });
      if (
        fresh.status === 'SUCCEEDED' ||
        fresh.status === 'FAILED' ||
        statusResult.status === 'PENDING'
      ) {
        return fresh;
      }
      if (statusResult.status === 'FAILED') {
        return this.applyFailure(tx, fresh);
      }
      return this.applySuccess(tx, fresh);
    });
  }

  private async applySuccess(
    tx: PrismaTransaction,
    payment: Payment,
  ): Promise<Payment> {
    if (payment.direction === 'PAYOUT') {
      if (payment.withdrawalId) {
        await tx.withdrawal.update({
          where: { id: payment.withdrawalId },
          data: { status: 'SUCCEEDED', processedAt: new Date() },
        });
      }
      return tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED' },
      });
    }

    const beneficiaryId = await this.resolveBeneficiary(tx, payment);

    if (beneficiaryId) {
      const ledgerType =
        payment.purpose === 'GIFT_CARD_PURCHASE'
          ? 'GIFT_CARD_PURCHASE_COLLECTION'
          : 'MEMBERSHIP_PAYMENT_COLLECTION';
      await this.ledger.postEntries(
        tx,
        ledgerType,
        [
          {
            accountType: 'PAYMENT_PROVIDER',
            entryType: 'PAYMENT_COLLECTED',
            amountXaf: -payment.amountXaf,
          },
          {
            accountType: 'USER_ESCROW',
            entryType: 'ESCROW_HOLD',
            amountXaf: payment.amountXaf,
            userId: beneficiaryId,
          },
        ],
        `Paiement ${payment.id} collecté, mis en séquestre pour ${beneficiaryId}`,
      );

      if (payment.membershipPaymentId) {
        await tx.membershipPayment.update({
          where: { id: payment.membershipPaymentId },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            escrowReleaseAt: addHours(
              new Date(),
              SUBSCRIPTION_ESCROW_RELEASE_HOURS,
            ),
          },
        });
      } else if (payment.giftCardOrderId) {
        // Le séquestre des cartes cadeaux démarre à la révélation du code (Phase 4),
        // pas à la confirmation du paiement : escrowReleaseAt n'est pas encore défini ici.
        await tx.giftCardOrder.update({
          where: { id: payment.giftCardOrderId },
          data: { status: 'PAID' },
        });
      }
    } else {
      await this.ledger.postEntries(
        tx,
        'PREMIUM_SUBSCRIPTION_FEE',
        [
          {
            accountType: 'PAYMENT_PROVIDER',
            entryType: 'PAYMENT_COLLECTED',
            amountXaf: -payment.amountXaf,
          },
          {
            accountType: 'PLATFORM_COMMISSION',
            entryType: 'PREMIUM_FEE',
            amountXaf: payment.amountXaf,
          },
        ],
        `Paiement ${payment.id} (${payment.purpose}) encaissé directement`,
      );
    }

    return tx.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCEEDED' },
    });
  }

  private async applyFailure(
    tx: PrismaTransaction,
    payment: Payment,
  ): Promise<Payment> {
    if (payment.direction === 'PAYOUT' && payment.withdrawalId) {
      return this.applyPayoutFailure(tx, payment);
    }
    if (payment.membershipPaymentId) {
      await tx.membershipPayment.update({
        where: { id: payment.membershipPaymentId },
        data: { status: 'FAILED' },
      });
    }

    return tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureReason:
          'Paiement refusé ou échoué chez le fournisseur mobile money',
      },
    });
  }

  /** Annule la réservation faite à la création du retrait : rembourse le solde disponible du titulaire. */
  private async applyPayoutFailure(
    tx: PrismaTransaction,
    payment: Payment,
  ): Promise<Payment> {
    const withdrawal = await tx.withdrawal.findUniqueOrThrow({
      where: { id: payment.withdrawalId as string },
    });

    await this.ledger.postEntries(
      tx,
      'REFUND',
      [
        {
          accountType: 'USER_AVAILABLE',
          entryType: 'REFUND',
          amountXaf: withdrawal.amountXaf + withdrawal.feeAmountXaf,
          userId: withdrawal.userId,
        },
        {
          accountType: 'WITHDRAWAL_CLEARING',
          entryType: 'REFUND',
          amountXaf: -withdrawal.amountXaf,
        },
        {
          accountType: 'PLATFORM_COMMISSION',
          entryType: 'REFUND',
          amountXaf: -withdrawal.feeAmountXaf,
        },
      ],
      `Retrait ${withdrawal.id} échoué chez le fournisseur, remboursement du solde`,
    );

    await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: 'FAILED',
        failureReason:
          'Échec du paiement sortant chez le fournisseur mobile money',
      },
    });

    return tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failureReason:
          'Paiement refusé ou échoué chez le fournisseur mobile money',
      },
    });
  }

  private async resolveBeneficiary(
    tx: PrismaTransaction,
    payment: Payment,
  ): Promise<string | null> {
    if (payment.membershipPaymentId) {
      const membershipPayment = await tx.membershipPayment.findUnique({
        where: { id: payment.membershipPaymentId },
        include: { membership: { include: { group: true } } },
      });
      return membershipPayment?.membership.group.ownerId ?? null;
    }
    if (payment.giftCardOrderId) {
      const order = await tx.giftCardOrder.findUnique({
        where: { id: payment.giftCardOrderId },
        include: { listing: true },
      });
      return order?.listing.sellerId ?? null;
    }
    return null;
  }
}
