-- AlterTable
ALTER TABLE "lancamento_financeiro" ADD COLUMN     "banco_id" TEXT;

-- CreateTable
CREATE TABLE "banco" (
    "id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banco_equipe_id_idx" ON "banco"("equipe_id");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_banco_id_idx" ON "lancamento_financeiro"("banco_id");

-- AddForeignKey
ALTER TABLE "banco" ADD CONSTRAINT "banco_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_banco_id_fkey" FOREIGN KEY ("banco_id") REFERENCES "banco"("id") ON DELETE SET NULL ON UPDATE CASCADE;

