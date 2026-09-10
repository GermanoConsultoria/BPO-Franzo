-- Cria ENUMs só se não existirem
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoLancamento') THEN
        CREATE TYPE "TipoLancamento" AS ENUM ('DESPESA', 'RECEITA');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusLancamento') THEN
        CREATE TYPE "StatusLancamento" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');
    END IF;
END $$;

-- Cria tabelas se não existirem
CREATE TABLE IF NOT EXISTS "plano_contas" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plano_contas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "lancamento_financeiro" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS "anexo_financeiro" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "dt_upload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anexo_financeiro_pkey" PRIMARY KEY ("id")
);

-- Adiciona FKs só se não existirem
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lancamento_financeiro_plano_contas_id_fkey') THEN
        ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_plano_contas_id_fkey"
            FOREIGN KEY ("plano_contas_id") REFERENCES "plano_contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lancamento_financeiro_lancamento_pai_id_fkey') THEN
        ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_lancamento_pai_id_fkey"
            FOREIGN KEY ("lancamento_pai_id") REFERENCES "lancamento_financeiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anexo_financeiro_lancamento_id_fkey') THEN
        ALTER TABLE "anexo_financeiro" ADD CONSTRAINT "anexo_financeiro_lancamento_id_fkey"
            FOREIGN KEY ("lancamento_id") REFERENCES "lancamento_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;