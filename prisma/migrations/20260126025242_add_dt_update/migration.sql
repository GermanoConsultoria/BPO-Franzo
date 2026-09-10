/*
  Warnings:

  - You are about to drop the column `prioridade` on the `Tarefa` table. All the data in the column will be lost.
  - You are about to drop the column `projetoId` on the `Tarefa` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Tarefa` table. All the data in the column will be lost.
  - You are about to drop the `MembroWorkspace` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `usuario_id` to the `Projeto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dificuldade_id` to the `Tarefa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prioridade_id` to the `Tarefa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projeto_id` to the `Tarefa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspace_id` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MembroWorkspace" DROP CONSTRAINT "MembroWorkspace_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "MembroWorkspace" DROP CONSTRAINT "MembroWorkspace_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "Tarefa" DROP CONSTRAINT "Tarefa_projetoId_fkey";

-- AlterTable
ALTER TABLE "Projeto" ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "dt_acesso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "usuario_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Tarefa" DROP COLUMN "prioridade",
DROP COLUMN "projetoId",
DROP COLUMN "status",
ADD COLUMN     "coluna_id" TEXT,
ADD COLUMN     "concluida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dificuldade_id" INTEGER NOT NULL,
ADD COLUMN     "dt_conclusao" TIMESTAMP(3),
ADD COLUMN     "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dt_vencimento" TIMESTAMP(3),
ADD COLUMN     "prioridade_id" INTEGER NOT NULL,
ADD COLUMN     "projeto_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cargo" TEXT,
ADD COLUMN     "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "imagem" TEXT,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN     "workspace_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "MembroWorkspace";

-- CreateTable
CREATE TABLE "Coluna" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT,
    "workspace_id" TEXT NOT NULL,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coluna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjetoColuna" (
    "projeto_id" TEXT NOT NULL,
    "coluna_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "ProjetoColuna_pkey" PRIMARY KEY ("projeto_id","coluna_id")
);

-- CreateTable
CREATE TABLE "OpcaoPrioridade" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "OpcaoPrioridade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpcaoDificuldade" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "OpcaoDificuldade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comentario" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "tarefa_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comentario_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coluna" ADD CONSTRAINT "Coluna_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projeto" ADD CONSTRAINT "Projeto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjetoColuna" ADD CONSTRAINT "ProjetoColuna_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjetoColuna" ADD CONSTRAINT "ProjetoColuna_coluna_id_fkey" FOREIGN KEY ("coluna_id") REFERENCES "Coluna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_prioridade_id_fkey" FOREIGN KEY ("prioridade_id") REFERENCES "OpcaoPrioridade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_dificuldade_id_fkey" FOREIGN KEY ("dificuldade_id") REFERENCES "OpcaoDificuldade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "Projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_coluna_id_fkey" FOREIGN KEY ("coluna_id") REFERENCES "Coluna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "Tarefa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
