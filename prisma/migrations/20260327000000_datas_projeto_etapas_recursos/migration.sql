-- AlterTable: Adiciona campos de datas ao modelo Projeto
ALTER TABLE "projeto" ADD COLUMN IF NOT EXISTS "data_inicio" TIMESTAMP(3);
ALTER TABLE "projeto" ADD COLUMN IF NOT EXISTS "data_prevista_entrega" TIMESTAMP(3);
ALTER TABLE "projeto" ADD COLUMN IF NOT EXISTS "link_fluxo_implantacao" TEXT;

-- AlterTable: Adiciona campos de datas às etapas (ProjetoColuna)
ALTER TABLE "projeto_coluna" ADD COLUMN IF NOT EXISTS "data_inicio" TIMESTAMP(3);
ALTER TABLE "projeto_coluna" ADD COLUMN IF NOT EXISTS "data_fim" TIMESTAMP(3);

-- CreateTable: Recursos/links da equipe
CREATE TABLE IF NOT EXISTS "recurso_equipe" (
    "id" TEXT NOT NULL,
    "equipe_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT,
    "icone" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurso_equipe_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "recurso_equipe" ADD CONSTRAINT "recurso_equipe_equipe_id_fkey"
    FOREIGN KEY ("equipe_id") REFERENCES "equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
