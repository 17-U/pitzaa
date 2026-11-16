/*
  Warnings:

  - Added the required column `commissionXaf` to the `membership_payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "membership_payments" ADD COLUMN     "commissionXaf" INTEGER NOT NULL;
