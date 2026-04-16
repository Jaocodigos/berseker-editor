-- AlterTable
ALTER TABLE `characters` ADD COLUMN `adventure_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `adventures` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adventure_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` VARCHAR(191) NOT NULL DEFAULT 'player',
    `user_id` INTEGER NOT NULL,
    `adventure_id` INTEGER NOT NULL,

    UNIQUE INDEX `adventure_users_user_id_adventure_id_key`(`user_id`, `adventure_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `characters` ADD CONSTRAINT `characters_adventure_id_fkey` FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adventure_users` ADD CONSTRAINT `adventure_users_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adventure_users` ADD CONSTRAINT `adventure_users_adventure_id_fkey` FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
