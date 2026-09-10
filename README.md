# BPO — Gestão Financeira Multi-Cliente

Sistema web para gestão financeira de múltiplos clientes, desenvolvido com Next.js App Router, Prisma e PostgreSQL. Fork enxuto do "Flow" (gerenciador de tarefas), mantendo apenas o módulo financeiro.

## Como funciona

- Cada **cliente** cadastrado (tabela `equipe`) tem seu próprio financeiro isolado: plano de contas, contas a pagar/receber e balancete.
- Três papéis de acesso (`Usuario.role`):
  - **ADMIN** — opera o sistema, único papel com acesso a Configurações; cadastra usuários e clientes.
  - **EMPRESA** — quem compra o BPO; enxerga o financeiro de todos os clientes, mas não cadastra ninguém.
  - **CLIENTE** — usuário final; só enxerga o financeiro do(s) cliente(s) ao qual foi vinculado em Configurações → Clientes.

## Funcionalidades

- **Balancete** — resumo financeiro do período, gráficos e contratos se encerrando
- **Contas a Pagar / a Receber** — lançamentos com parcelamento, recorrência, anexos e histórico de pagamento
- **Plano de Contas** — categorias de receita/despesa por cliente
- **Gestão de Usuários e Clientes** — restrita ao papel ADMIN

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Linguagem | TypeScript |
| ORM | Prisma 5 |
| Banco de Dados | PostgreSQL |
| Autenticação | NextAuth.js v5 |
| Upload | UploadThing |
| Gráficos | Recharts |

## Como rodar

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Banco de dados — use um banco PRÓPRIO deste projeto, nunca o do "Flow".**
   Opção rápida com Docker (já configurado em `docker-compose.yml`, porta local `5433`):
   ```bash
   docker compose up -d
   ```
   Isso expõe um Postgres vazio em `postgresql://admin_bpo:senha_segura_123@localhost:5433/db_bpo`.

3. **Configure o `.env`** na raiz:
   ```env
   DATABASE_URL="postgresql://admin_bpo:senha_segura_123@localhost:5433/db_bpo"
   AUTH_SECRET="seu_secret_nextauth"
   UPLOADTHING_TOKEN="seu_token_uploadthing"
   ```

4. **Crie o schema e os dados iniciais:**
   ```bash
   npx prisma migrate dev --name init
   npx tsx prisma/bootstrap-local.ts
   ```
   Isso cria um workspace, um usuário ADMIN (`admin@local.test` / `123456`) e um cliente de exemplo.

5. **Inicie:**
   ```bash
   npm run dev
   ```

Acesse [http://localhost:3000](http://localhost:3000) no navegador.

## Comandos úteis

```bash
npm run dev              # Servidor de desenvolvimento (porta 3000)
npm run build            # Build de produção
npx prisma migrate dev   # Criar nova migration
npx prisma studio        # Interface visual do banco
```
