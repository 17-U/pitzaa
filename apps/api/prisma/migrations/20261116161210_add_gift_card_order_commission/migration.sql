/*
  Warnings:

  - Added the required column `commissionXaf` to the `gift_card_orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "GiftCardOrderStatus" ADD VALUE 'PAYMENT_FAILED';

-- AlterTable
ALTER TABLE "gift_card_orders" ADD COLUMN     "commissionXaf" INTEGER NOT NULL;
