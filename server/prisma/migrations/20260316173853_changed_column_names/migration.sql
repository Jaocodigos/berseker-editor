/*
  Warnings:

  - You are about to drop the `Ability` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pillar` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Ability` DROP FOREIGN KEY `Ability_pillarId_fkey`;

-- DropForeignKey
ALTER TABLE `Pillar` DROP FOREIGN KEY `Pillar_characterId_fkey`;

-- DropTable
DROP TABLE `Ability`;

-- DropTable
DROP TABLE `Pillar`;

-- CreateTable
CREATE TABLE `pillar` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `mana` INTEGER NOT NULL,
    `characterId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ability` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NOT NULL,
    `dano` VARCHAR(191) NOT NULL,
    `custo` INTEGER NOT NULL,
    `pillarId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pillar` ADD CONSTRAINT `pillar_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `characters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ability` ADD CONSTRAINT `ability_pillarId_fkey` FOREIGN KEY (`pillarId`) REFERENCES `pillar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
