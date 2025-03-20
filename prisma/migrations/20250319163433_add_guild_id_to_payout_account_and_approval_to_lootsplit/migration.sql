/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `LootSplitSession` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `LootSplitSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guildId` to the `PayoutAccount` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `LootSplitSession` DROP COLUMN `expiresAt`,
    ADD COLUMN `approved` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `PayoutAccount` ADD COLUMN `guildId` VARCHAR(191) NOT NULL default '1299785328210608218';
