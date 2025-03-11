/*
  Warnings:

  - You are about to alter the column `lootSplitPercentModifier` on the `Configuration` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.

*/
-- AlterTable
ALTER TABLE `Configuration` MODIFY `lootSplitPercentModifier` DOUBLE NULL;
