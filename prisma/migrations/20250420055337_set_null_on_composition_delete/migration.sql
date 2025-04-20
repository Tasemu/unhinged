-- DropForeignKey
ALTER TABLE `Event` DROP FOREIGN KEY `Event_compositionId_fkey`;

-- DropIndex
DROP INDEX `Event_compositionId_fkey` ON `Event`;

-- AlterTable
ALTER TABLE `Event` MODIFY `compositionId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_compositionId_fkey` FOREIGN KEY (`compositionId`) REFERENCES `Composition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
