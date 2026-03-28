-- CreateEnum
CREATE TYPE "DuelStatus" AS ENUM ('WAITING', 'SEEDING', 'ACTIVE', 'COMPLETED', 'SETTLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "total_wins" INTEGER NOT NULL DEFAULT 0,
    "total_losses" INTEGER NOT NULL DEFAULT 0,
    "total_draws" INTEGER NOT NULL DEFAULT 0,
    "total_earned" BIGINT NOT NULL DEFAULT 0,
    "total_staked" BIGINT NOT NULL DEFAULT 0,
    "win_streak" INTEGER NOT NULL DEFAULT 0,
    "best_streak" INTEGER NOT NULL DEFAULT 0,
    "avg_score" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duels" (
    "id" TEXT NOT NULL,
    "duel_id" INTEGER,
    "join_code" TEXT NOT NULL,
    "stake" BIGINT NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" "DuelStatus" NOT NULL DEFAULT 'WAITING',
    "seed" TEXT,
    "tx_hash" TEXT,
    "player1_address" TEXT NOT NULL,
    "player2_address" TEXT,
    "winner_address" TEXT,
    "winner_score" INTEGER,
    "loser_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "duels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_submissions" (
    "id" TEXT NOT NULL,
    "duel_db_id" TEXT NOT NULL,
    "player_address" TEXT NOT NULL,
    "answers" INTEGER[],
    "score" INTEGER NOT NULL,
    "total_time" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_address_key" ON "players"("address");

-- CreateIndex
CREATE UNIQUE INDEX "duels_duel_id_key" ON "duels"("duel_id");

-- CreateIndex
CREATE UNIQUE INDEX "duels_join_code_key" ON "duels"("join_code");

-- CreateIndex
CREATE INDEX "duels_status_idx" ON "duels"("status");

-- CreateIndex
CREATE INDEX "duels_player1_address_idx" ON "duels"("player1_address");

-- CreateIndex
CREATE INDEX "duels_player2_address_idx" ON "duels"("player2_address");

-- CreateIndex
CREATE INDEX "duels_created_at_idx" ON "duels"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "game_submissions_duel_db_id_player_address_key" ON "game_submissions"("duel_db_id", "player_address");

-- AddForeignKey
ALTER TABLE "duels" ADD CONSTRAINT "duels_player1_address_fkey" FOREIGN KEY ("player1_address") REFERENCES "players"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duels" ADD CONSTRAINT "duels_player2_address_fkey" FOREIGN KEY ("player2_address") REFERENCES "players"("address") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duels" ADD CONSTRAINT "duels_winner_address_fkey" FOREIGN KEY ("winner_address") REFERENCES "players"("address") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_submissions" ADD CONSTRAINT "game_submissions_duel_db_id_fkey" FOREIGN KEY ("duel_db_id") REFERENCES "duels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_submissions" ADD CONSTRAINT "game_submissions_player_address_fkey" FOREIGN KEY ("player_address") REFERENCES "players"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
