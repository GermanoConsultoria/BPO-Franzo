-- AlterTable
ALTER TABLE "banco" ADD COLUMN     "saldo_atual" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "saldo_inicial" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "lancamento_financeiro" ADD COLUMN     "saldo_anterior" DECIMAL(15,2),
ADD COLUMN     "saldo_atual" DECIMAL(15,2);

