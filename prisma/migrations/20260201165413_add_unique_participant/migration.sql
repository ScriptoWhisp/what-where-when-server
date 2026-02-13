/*
  Warnings:

  - A unique constraint covering the columns `[game_id,team_id]` on the table `game_participants` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "game_participants" ADD COLUMN     "socketId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "game_participants_game_id_team_id_key" ON "game_participants"("game_id", "team_id");
