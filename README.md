# Flow — Gerenciador de Projetos

Sistema web full-stack de gerenciamento de projetos e tarefas com foco em equipes, desenvolvido com Next.js App Router, Prisma e PostgreSQL.

## Funcionalidades

- **Quadro Kanban** — Projetos com colunas personalizáveis, drag & drop de tarefas e reordenação de etapas
- **Sprint** — Visão semanal e mensal de tarefas com vencimento no período
- **Minhas Tarefas** — Visualização em Quadro, Lista ou Calendário com filtros de projeto, responsável, prioridade e status
- **Dashboards** — Métricas e gráficos de progresso por equipe
- **Portfólio Onblox** — Acompanhamento de fases de implantação por cliente
- **Templates de Tarefas** — Pacotes reutilizáveis com importação direta para projetos
- **Comentários e Anexos** — Cole imagens diretamente com `Ctrl+V`, histórico completo de alterações
- **Gestão de Equipes** — Multi-tenant com isolamento por workspace, roles (OWNER, MANAGER, MEMBER, USER)
- **Recorrência** — Tarefas diárias, semanais e mensais com criação automática ao concluir
- **Auditoria** — Histórico de todas as alterações em tarefas (responsável, coluna, datas, status)

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Linguagem | TypeScript |
| ORM | Prisma 5 |
| Banco de Dados | PostgreSQL (Neon Serverless) |
| Autenticação | NextAuth.js v5 |
| Upload | UploadThing |
| Drag & Drop | react-dnd |
| Gráficos | Recharts |

## Como rodar

1. **Clone e instale as dependências:**
   ```bash
   git clone <url-do-repositorio>
   cd gerenciador_de_projetos
   npm install
   ```

2. **Configure as variáveis de ambiente** — crie um arquivo `.env` na raiz:
   ```env
   DATABASE_URL="sua_url_neon"
   AUTH_SECRET="seu_secret_nextauth"
   UPLOADTHING_TOKEN="seu_token_uploadthing"
   CLIENT_NAME="Nome da Organização"

   # Integração GitHub (opcional — necessária apenas para vincular contas GitHub às equipes)
   APP_URL="https://seu-dominio.com"
   GITHUB_OAUTH_CLIENT_ID="client_id_do_oauth_app_do_github"
   GITHUB_OAUTH_CLIENT_SECRET="client_secret_do_oauth_app_do_github"
   ```

   Para a integração com GitHub funcionar, crie um OAuth App em GitHub → Settings → Developer settings → OAuth Apps, com "Authorization callback URL" apontando para `${APP_URL}/api/integracoes/github/callback`.

3. **Aplique as migrations e inicie:**
   ```bash
   npx prisma migrate deploy
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
