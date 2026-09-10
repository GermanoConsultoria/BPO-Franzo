-- CreateTable
CREATE TABLE "usuario_permissao" (
    "usuario_id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_permissao_pkey" PRIMARY KEY ("usuario_id","chave")
);

-- AddForeignKey
ALTER TABLE "usuario_permissao" ADD CONSTRAINT "usuario_permissao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
