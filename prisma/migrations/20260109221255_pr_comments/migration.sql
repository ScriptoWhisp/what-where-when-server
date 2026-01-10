/*
  Warnings:

  - Made the column `submitted_at` on table `answers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_available` on table `game_participants` required. This step will fail if there are existing NULL values in that column.
  - Made the column `modified_at` on table `games` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "answers" ALTER COLUMN "submitted_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "game_participants" ALTER COLUMN "is_available" SET NOT NULL,
ALTER COLUMN "is_available" SET DEFAULT true;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "modified_at" SET NOT NULL,
ALTER COLUMN "modified_at" SET DEFAULT CURRENT_TIMESTAMP;
