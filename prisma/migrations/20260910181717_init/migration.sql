-- CreateEnum
CREATE TYPE "Recorrencia" AS ENUM ('NAO', 'DIARIAMENTE', 'SEMANALMENTE', 'MENSALMENTE');

-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('DESPESA', 'RECEITA');

-- CreateEnum
CREATE TYPE "StatusLancamento" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateTable
CREATE TABLE "workspace" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipe" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "whatsapp" TEXT,
    "workspace_id" TEXT NOT NULL,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipe_usuario" (
    "equipe_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipe_usuario_pkey" PRIMARY KEY ("equipe_id","usuario_id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "cargo" TEXT,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imagem" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CLIENTE',
    "workspace_id" TEXT NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_contas" (
    "id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plano_contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_financeiro" (
    "id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "descricao" TEXT NOT NULL,
    "beneficiario" TEXT,
    "valor" DECIMAL(15,2) NOT NULL,
    "dt_vencimento" TIMESTAMP(3) NOT NULL,
    "dt_pagamento" TIMESTAMP(3),
    "numero_documento" TEXT,
    "plano_contas_id" TEXT NOT NULL,
    "status" "StatusLancamento" NOT NULL DEFAULT 'PENDENTE',
    "recorrencia" "Recorrencia" NOT NULL DEFAULT 'NAO',
    "numero_parcelas" INTEGER,
    "parcela_atual" INTEGER,
    "grupo_parcela_id" TEXT,
    "lancamento_pai_id" TEXT,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamento_financeiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexo_financeiro" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "dt_upload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexo_financeiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- AddForeignKey
ALTER TABLE "equipe" ADD CONSTRAINT "equipe_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe_usuario" ADD CONSTRAINT "equipe_usuario_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipe_usuario" ADD CONSTRAINT "equipe_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "Usuario_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_contas" ADD CONSTRAINT "plano_contas_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_plano_contas_id_fkey" FOREIGN KEY ("plano_contas_id") REFERENCES "plano_contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_lancamento_pai_id_fkey" FOREIGN KEY ("lancamento_pai_id") REFERENCES "lancamento_financeiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo_financeiro" ADD CONSTRAINT "anexo_financeiro_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamento_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
