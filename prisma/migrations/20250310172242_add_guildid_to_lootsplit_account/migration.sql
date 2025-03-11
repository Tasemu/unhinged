/*
  Warnings:

  - Added the required column `guildId` to the `PayoutAccount` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `PayoutAccount` ADD COLUMN `guildId` VARCHAR(191) NOT NULL;
