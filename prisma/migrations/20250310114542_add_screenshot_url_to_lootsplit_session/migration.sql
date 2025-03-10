/*
  Warnings:

  - Added the required column `screenshotUrl` to the `LootSplitSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `LootSplitSession` ADD COLUMN `screenshotUrl` VARCHAR(191) NOT NULL;
