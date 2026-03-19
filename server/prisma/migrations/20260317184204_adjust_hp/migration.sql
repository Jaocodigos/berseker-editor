/*
  Warnings:

  - You are about to drop the column `hp` on the `characters` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `characters` DROP COLUMN `hp`,
    ADD COLUMN `actual_hp` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `max_hp` INTEGER NOT NULL DEFAULT 0;
