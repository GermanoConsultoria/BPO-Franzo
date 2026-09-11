-- CreateIndex
CREATE INDEX "anexo_financeiro_lancamento_id_idx" ON "anexo_financeiro"("lancamento_id");

-- CreateIndex
CREATE INDEX "equipe_workspace_id_idx" ON "equipe"("workspace_id");

-- CreateIndex
CREATE INDEX "equipe_usuario_usuario_id_idx" ON "equipe_usuario"("usuario_id");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_equipe_id_status_idx" ON "lancamento_financeiro"("equipe_id", "status");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_equipe_id_dt_vencimento_idx" ON "lancamento_financeiro"("equipe_id", "dt_vencimento");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_plano_contas_id_idx" ON "lancamento_financeiro"("plano_contas_id");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_grupo_parcela_id_idx" ON "lancamento_financeiro"("grupo_parcela_id");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_lancamento_pai_id_idx" ON "lancamento_financeiro"("lancamento_pai_id");

-- CreateIndex
CREATE INDEX "plano_contas_equipe_id_idx" ON "plano_contas"("equipe_id");

-- CreateIndex
CREATE INDEX "usuario_workspace_id_idx" ON "usuario"("workspace_id");
