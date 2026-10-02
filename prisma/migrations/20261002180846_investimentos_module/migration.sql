-- AlterTable
ALTER TABLE "plano_contas" DROP COLUMN "investimento";

-- CreateEnum
CREATE TYPE "TipoInvestimento" AS ENUM ('APORTE', 'RESGATE');

-- CreateTable
CREATE TABLE "investimento" (
    "id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,
    "tipo" "TipoInvestimento" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "dt_movimento" TIMESTAMP(3) NOT NULL,
    "numero_documento" TEXT,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investimento_equipe_id_idx" ON "investimento"("equipe_id");

-- CreateIndex
CREATE INDEX "investimento_equipe_id_dt_movimento_idx" ON "investimento"("equipe_id", "dt_movimento");

-- AddForeignKey
ALTER TABLE "investimento" ADD CONSTRAINT "investimento_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
