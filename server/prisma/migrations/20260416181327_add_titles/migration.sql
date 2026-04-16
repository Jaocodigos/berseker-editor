-- AlterTable
ALTER TABLE `characters` ADD COLUMN `title_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `titles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `adventure_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `characters` ADD CONSTRAINT `characters_title_id_fkey` FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `titles` ADD CONSTRAINT `titles_adventure_id_fkey` FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
