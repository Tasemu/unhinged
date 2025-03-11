/*
  Warnings:

  - Added the required column `creatorId` to the `LootSplitSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `participants` to the `LootSplitSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `LootSplitSession` ADD COLUMN `creatorId` VARCHAR(191) NOT NULL,
    ADD COLUMN `participants` VARCHAR(191) NOT NULL;
