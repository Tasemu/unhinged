-- CreateTable
CREATE TABLE `Configuration` (
    `id` VARCHAR(191) NOT NULL,
    `guildId` VARCHAR(191) NOT NULL,
    `trialRoleId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Configuration_guildId_key`(`guildId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
