# Guia de Contribuição e Operação — Topa Tudo

Este documento descreve os procedimentos oficiais para configurar o ambiente de desenvolvimento, executar testes, realizar builds de produção, gerenciar migrações de banco de dados e publicar atualizações do **Topa Tudo**.

---

## 1. Pré-requisitos do Ambiente

Certifique-se de ter instalado em sua máquina:

- **Node.js**: `v20.x` ou `v22.x` LTS (recomendado `v22+`)
- **Gerenciador de Pacotes**: `npm` (v10+)
- **Git**: Para controle de versão
- **Acesso ao Projeto Supabase**: URL do projeto e chave pública (`ANON_KEY`), além da string de conexão PostgreSQL caso execute migrações ou backups via linha de comando.

---

## 2. Configuração Inicial (Como Rodar Localmente)

### 2.1. Clonar e Instalar Dependências

```bash
git clone <url-do-repositorio> "Topa Tudo"
cd "Topa Tudo"
npm install
```

### 2.2. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo `.env.example` para `.env.local` (ou `.env`):

```bash
cp .env.example .env.local
```

Preencha as variáveis no arquivo `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica-anon
```

> **Nota para scripts administrativos (`scripts/`):** Caso utilize os scripts de migração SQL ou backup direto via Node.js (`npm run backup`), defina também `DATABASE_URL` ou as credenciais equivalentes do PostgreSQL no seu `.env.local`.

### 2.3. Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

O servidor Vite iniciará na porta padrão `5173` com *Hot Module Replacement (HMR)* e exposição na rede local (`host: true`), permitindo testar simultaneamente no computador (`http://localhost:5173`) e em celulares conectados ao mesmo Wi-Fi.

---

## 3. Scripts Disponíveis (`package.json`)

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor de desenvolvimento Vite na porta `5173` (`--host` habilitado). |
| `npm run build` | Executa a checagem de tipos (`tsc -b`) e gera o bundle otimizado de produção + Service Worker PWA na pasta `dist/`. |
| `npm run preview` | Serve localmente o pacote compilado em `dist/` para validação pré-deploy. |
| `npm run backup` | Executa `node scripts/backup-database.mjs` para gerar backup das tabelas do banco de dados. |
| `npm run test:backup` | Executa a suíte de validação da rotação de backups (`node tests/test-backup-rotation.mjs`). |

### Scripts Utilitários Adicionais (`scripts/` e `tests/`)

- **Aplicar Migrações SQL**:
  ```bash
  node scripts/apply-migration.mjs
  ```
- **Testar Geração de Cupom Térmico (Headless / Canvas)**:
  ```bash
  node tests/test-thermal-receipt.mjs
  ```
- **Testar APIs de Produção e Integração Supabase**:
  ```bash
  node tests/test-production-apis.mjs
  ```

---

## 4. Banco de Dados e Migrações (`supabase/migrations/`)

As alterações de schema são versionadas sequencialmente no diretório `supabase/migrations/`:

1. `001_initial_schema.sql` — Criação das 10 tabelas principais (`profiles`, `clients`, `services_catalog`, `inventory`, `inventory_movements`, `orders`, `order_items`, `transactions`, `tools`, `schedule`), views de estoque e RPC `complete_work_order`.
2. `002_fixes_and_security.sql` — Políticas de segurança (RLS), validação de PIN via RPC (`verify_user_pin`) e integridade referencial.
3. `003_signature_pix.sql` — Suporte a assinatura digital (`signature_url`), métodos de pagamento e garantia.
4. `004_performance_indexes.sql` — Índices de performance para filtros de OS, datas de agendamento e movimentações de estoque.

Ao criar uma nova alteração no banco:
- Crie um novo arquivo numerado (ex: `005_descricao_da_mudanca.sql`).
- Atualize as interfaces TypeScript correspondentes em `src/core/types/database.ts`.

---

## 5. Processo de Build e Deploy

### 5.1. Build de Produção

Antes de abrir um Pull Request ou realizar deploy, valide se a compilação TypeScript e o empacotamento Rollup/Vite concluem sem erros:

```bash
npm run build
```

O processo de build realiza:
1. Verificação estrita de tipos (`tsc -b`).
2. Separação inteligente de chunks (`vendor-react` e `vendor-supabase`) configurada em `vite.config.ts`.
3. Geração do Service Worker (`sw.js`) e manifesto PWA (`manifest.webmanifest`) via `vite-plugin-pwa`.

### 5.2. Deploy na Vercel

O projeto está configurado para deploy contínuo na **Vercel** através do arquivo `vercel.json`, que redireciona todas as rotas para `/index.html` (SPA Routing):

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Passos para deploy:
1. Certifique-se de que as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão configuradas no painel da Vercel (*Project Settings → Environment Variables*).
2. Faça push para a branch `main` (para deploy automático via integração Git) ou utilize a Vercel CLI (`vercel --prod`).

### 5.3. Backups Automatizados (GitHub Actions)

O workflow `.github/workflows/daily-backup.yml` executa rotinas periódicas de backup do banco de dados, complementando o gerenciador manual acessível pelos administradores dentro do próprio sistema (`Dashboard` → `Backups`).

---

## 6. Padrões de Código e Diretrizes de UI/UX

1. **Idioma Oficial**: Toda a interface do usuário, mensagens de feedback (Toasts), comentários de negócio e documentação devem estar em **Português do Brasil (PT-BR)** claro e profissional.
2. **Path Aliases**: Utilize sempre o alias `@/` para importações internas (ex: `import { supabase } from '@/core/supabase'`).
3. **Design Mobile-First & Ergonomia de Campo**:
   - Botões de ação primária devem respeitar a altura mínima de toque de `52px` (`min-h-[52px]` ou `min-h-touch`).
   - Utilize a paleta oficial configurada no `tailwind.config.js` (`industrial-*`, `amberAlert-*`, `greenSuccess-*` e tons neutros `slate-*`).
4. **Commits Semânticos (Conventional Commits)**:
   - `feat:` para novas funcionalidades (ex: `feat(os): adicionar filtro por técnico na listagem`)
   - `fix:` para correções de bugs (ex: `fix(pix): normalizar chave EVP em minúsculas`)
   - `docs:` para alterações na documentação
   - `refactor:` ou `perf:` para melhorias de código e desempenho.
