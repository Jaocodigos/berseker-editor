-- AlterTable: make adventure_id required on characters
ALTER TABLE `characters` MODIFY `adventure_id` INTEGER NOT NULL;

-- AlterTable: drop role column from users
ALTER TABLE `users` DROP COLUMN `role`;
