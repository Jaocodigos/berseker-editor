-- AlterTable
ALTER TABLE `characters` ADD COLUMN `image_url` TEXT NULL;

-- CreateTable
CREATE TABLE `game_maps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `grid_width` INTEGER NOT NULL DEFAULT 20,
    `grid_height` INTEGER NOT NULL DEFAULT 15,
    `cell_size` INTEGER NOT NULL DEFAULT 40,
    `active` BOOLEAN NOT NULL DEFAULT false,
    `adventure_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pos_x` INTEGER NOT NULL DEFAULT 0,
    `pos_y` INTEGER NOT NULL DEFAULT 0,
    `character_id` INTEGER NOT NULL,
    `game_map_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `game_maps` ADD CONSTRAINT `game_maps_adventure_id_fkey` FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tokens` ADD CONSTRAINT `tokens_character_id_fkey` FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tokens` ADD CONSTRAINT `tokens_game_map_id_fkey` FOREIGN KEY (`game_map_id`) REFERENCES `game_maps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
