/*
  Warnings:

  - You are about to drop the column `startTime` on the `TrialStart` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `TrialStart` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `TrialStart` DROP COLUMN `startTime`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;
