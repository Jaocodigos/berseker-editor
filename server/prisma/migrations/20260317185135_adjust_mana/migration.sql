/*
  Warnings:

  - You are about to drop the column `mana` on the `pillar` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `pillar` DROP COLUMN `mana`,
    ADD COLUMN `actual_mana` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `max_mana` INTEGER NOT NULL DEFAULT 0;
