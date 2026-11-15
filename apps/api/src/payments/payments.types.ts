import { MobileMoneyOperator, PaymentPurpose } from '@prisma/client';

export interface InitiateCollectionParams {
  userId: string;
  amountXaf: number;
  msisdn: string;
  operator: MobileMoneyOperator;
  purpose: PaymentPurpose;
  membershipPaymentId?: string;
  giftCardOrderId?: string;
  description?: string;
}

export interface InitiatePayoutParams {
  userId: string;
  amountXaf: number;
  msisdn: string;
  operator: MobileMoneyOperator;
  withdrawalId: string;
}
