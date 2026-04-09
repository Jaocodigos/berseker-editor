-- AlterTable
ALTER TABLE `characters` ADD COLUMN `in_adventure` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `type` VARCHAR(191) NOT NULL DEFAULT 'player_character';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `role` VARCHAR(191) NOT NULL DEFAULT 'player';
