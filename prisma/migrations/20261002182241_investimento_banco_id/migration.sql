-- AlterTable
ALTER TABLE "investimento" ADD COLUMN     "banco_id" TEXT;

-- CreateIndex
CREATE INDEX "investimento_banco_id_idx" ON "investimento"("banco_id");

-- AddForeignKey
ALTER TABLE "investimento" ADD CONSTRAINT "investimento_banco_id_fkey" FOREIGN KEY ("banco_id") REFERENCES "banco"("id") ON DELETE SET NULL ON UPDATE CASCADE;
