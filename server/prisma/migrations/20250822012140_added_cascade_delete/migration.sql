-- DropForeignKey
ALTER TABLE `Ability` DROP FOREIGN KEY `Ability_pillarId_fkey`;

-- DropForeignKey
ALTER TABLE `Pillar` DROP FOREIGN KEY `Pillar_characterId_fkey`;

-- AddForeignKey
ALTER TABLE `Pillar` ADD CONSTRAINT `Pillar_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `characters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ability` ADD CONSTRAINT `Ability_pillarId_fkey` FOREIGN KEY (`pillarId`) REFERENCES `Pillar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
