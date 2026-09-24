# Documentação Oficial — Topa Tudo

Bem-vindo à documentação técnica e arquitetural do **Topa Tudo**, a plataforma integrada de gestão operacional, Ordens de Serviço (OS), controle de estoque, agenda técnica, gestão de ferramentas e faturamento instantâneo desenvolvida sob medida para a **Topa Tudo Comércio & Prestação de Serviços** (CNPJ `17.411.775/0001-52`).

---

## Sumário Rápido da Documentação

- **[Visão Geral e Arquitetura (`docs/index.md`)](./index.md)** — Stack tecnológica, arquitetura de pastas, módulos e banco de dados.
- **[Roadmap do Produto (`docs/roadmap.md`)](./roadmap.md)** — Funcionalidades concluídas em produção e planejamento de evolução futura.
- **[Referência de APIs: PIX e Recibos (`docs/api.md`)](./api.md)** — Especificação técnica dos motores de BR Code PIX (EMV/CRC16), Cupom Térmico HD (Canvas 80mm), WhatsApp e Impressão A4.
- **[Guia de Contribuição e Deploy (`docs/contributing.md`)](./contributing.md)** — Configuração de ambiente local, scripts de banco, build, testes e publicação.

---

## 1. Visão Geral do Projeto

O **Topa Tudo** é um **Progressive Web App (PWA)** *mobile-first* e *desktop-ready* projetado para conectar a operação de campo (técnicos) e a administração central em tempo real.

### Principais Objetivos de Negócio
- **Agilidade em Campo**: Interface ergonômica com áreas de toque mínimas de `52px` (`min-h-touch`), permitindo uso rápido em smartphones durante atendimentos externos.
- **Ciclo Completo da Ordem de Serviço**: Da abertura do orçamento ou agendamento até a execução com fotos (Antes/Depois), baixa automática de materiais, coleta de assinatura digital na tela e emissão de comprovante.
- **Faturamento Instantâneo**: Geração nativa de **QR Code PIX (Padrão EMV Banco Central)** e **Cupom Térmico Digital de 80mm em Alta Definição (PNG)** para envio imediato no WhatsApp ou impressão térmica.
- **Rastreabilidade de Insumos e Patrimônio**: Controle de estoque com cálculo de saldo em tempo real, alerta de estoque mínimo e rastreamento de empréstimo de ferramentas por técnico.

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão / Detalhes |
| :--- | :--- | :--- |
| **Frontend Core** | **React 19** + **TypeScript** | `react@^19.0.0`, `typescript@^5.7.3` (Tipagem estrita de ponta a ponta) |
| **Build & Bundler** | **Vite 6** + **Vite PWA** | `vite@^6.2.0`, `vite-plugin-pwa@^0.21.1` (Service Worker `autoUpdate` e manifesto instalável) |
| **Estilização & UI** | **Tailwind CSS 3** + **Lucide Icons** | `tailwindcss@^3.4.17`, `lucide-react@^1.16.0`, paleta customizada `industrial`, `amberAlert` e `greenSuccess` |
| **Backend & BaaS** | **Supabase** (PostgreSQL + Storage) | `@supabase/supabase-js@^2.49.1`, RPCs transacionais em PL/pgSQL e Buckets de mídia/backup |
| **Pagamentos & Recibos** | **HTML5 Canvas 2D** + **QRCode** | `qrcode@^1.5.4`, gerador próprio de payload EMV BR Code PIX (CRC16-CCITT) e Barcode Code 128B |
| **Infraestrutura & Deploy** | **Vercel** + **GitHub Actions** | SPA Routing via `vercel.json` e rotina automatizada de backup diário (`daily-backup.yml`) |

---

## 3. Arquitetura Técnica

O projeto adota uma arquitetura modular orientada a domínio (*Feature-Sliced / Modular Architecture*), separando o núcleo reutilizável (`src/core/`) dos módulos de negócio (`src/features/`).

### 3.1. Estrutura de Diretórios

```text
Topa Tudo/
├── docs/                       # Documentação oficial técnica e de arquitetura
├── public/                     # Assets estáticos e ícones PWA (192x192, 512x512)
├── scripts/                    # Scripts Node.js para migração, seed e backup PostgreSQL
├── supabase/
│   └── migrations/             # Migrações SQL versionadas (001 a 004)
├── tests/                      # Suites de testes de API, recibo térmico, carga e backup
└── src/
    ├── App.tsx                 # Orquestrador de rotas por abas com Code-Splitting (React.lazy)
    ├── main.tsx                # Ponto de entrada da aplicação React 19
    ├── core/                   # Camada de infraestrutura, utilitários e estado global
    │   ├── supabase.ts         # Cliente Supabase, upload de mídia e chamadas RPC
    │   ├── context/            # AuthContext (login por PIN + cache) e ToastContext
    │   ├── hooks/              # Hooks utilitários (useOnlineStatus)
    │   ├── services/           # Serviço de snapshot e restauração (backupService.ts)
    │   ├── types/              # Contratos TypeScript do banco (database.ts)
    │   ├── ui/                 # Componentes base (Logo vetorial, SignaturePad)
    │   └── utils/              # Motores de PIX, Recibo Térmico, Impressão A4, WhatsApp, Moeda e Data
    └── features/               # Módulos funcionais carregados sob demanda
        ├── auth/               # LoginScreen (Autenticação rápida por perfil + PIN)
        ├── layout/             # AppLayout, Header, BottomNav e AdminDrawer
        ├── os/                 # Gestão de OS, Itens, Fotos, Detalhes e Modal de Cupom Térmico
        ├── agenda/             # AgendaView (Calendário operacional de visitas técnicas)
        ├── clientes/           # ClientList (CRM de clientes e histórico)
        ├── estoque/            # EstoqueScreen (Inventário, entradas/saídas e alertas)
        ├── financeiro/         # FinancialView (Fluxo de caixa, receitas, despesas e anexos)
        ├── ferramentas/        # ToolsView (Controle de cautela e manutenção de ferramentas)
        ├── dashboard/          # DashboardView (KPIs executivos e BackupManagerModal)
        └── config/             # ServicesCatalogView e TechManagementView
```

### 3.2. Fluxo de Autenticação e Controle de Acesso (RBAC)
1. **Seleção de Perfil e PIN**: Na tela inicial (`LoginScreen.tsx`), o colaborador seleciona seu perfil ativo e insere seu PIN numérico.
2. **Validação Segura no Banco**: O `AuthContext` invoca a RPC PostgreSQL `verify_user_pin(p_user_id, p_pin)`, evitando trafegar hashes ou senhas em texto aberto na listagem de perfis.
3. **Resiliência Local**: Os perfis ativos e a sessão corrente são sincronizados no `localStorage` (`topatudo_cached_profiles` e `topatudo_cached_current_profile`), garantindo inicialização instantânea mesmo em conexões instáveis.
4. **Perfis de Acesso (`ProfileRole`)**:
   - `adm`: Acesso integral a todos os 9 módulos, incluindo Dashboard Executivo, Fluxo Financeiro, Catálogo de Serviços, Gestão de Técnicos e Backups.
   - `tecnico`: Foco operacional nas Ordens de Serviço, Agenda, Clientes, Estoque e Ferramentas.

### 3.3. Conclusão Atômica de Ordem de Serviço (`complete_work_order`)
Para garantir consistência transacional, a finalização de uma OS utiliza a stored procedure `complete_work_order(p_order_id)` no Supabase:
- Atualiza o status da OS para `concluido` e registra o timestamp `completed_at`.
- Deduz automaticamente do estoque (`inventory_movements` do tipo `saida`) todos os itens da OS cuja origem (`source`) seja `'estoque'`.
- Gera automaticamente o lançamento financeiro correspondente na tabela `transactions` (`type = 'receita'`, `status = 'confirmado'`).

---

## 4. Componentes e Módulos Principais

Todas as 9 visões principais utilizam *Code-Splitting* nativo (`React.lazy` + `Suspense`) em `src/App.tsx`, reduzindo o bundle inicial para carregamento imediato em redes móveis 3G/4G:

1. **Ordens de Serviço (`src/features/os/`)**:
   - `OSList.tsx`: Painel de acompanhamento com filtros por status (`orcamento`, `agendado`, `em_andamento`, `concluido`, `cancelado`) e busca rápida.
   - `OrderFormModal.tsx` & `OrderItemsManager.tsx`: Criação/edição de OS, vínculo com catálogo de serviços e adição de peças do estoque ou compra avulsa.
   - `OrderPhotoUpload.tsx`: Captura e compressão de fotos "Antes" e "Depois" enviadas ao bucket `topatudo-media`.
   - `OrderDetailModal.tsx`: Visão 360º da OS, coleta de assinatura no `SignaturePad.tsx`, acionamento de impressão A4 e abertura do recibo térmico.
   - `ThermalReceiptModal.tsx`: Visualizador interativo do cupom térmico de 80mm com envio inteligente para WhatsApp (Web Share API no celular ou cópia para área de transferência no PC).
2. **Agenda Operacional (`src/features/agenda/AgendaView.tsx`)**:
   - Cronograma diário e semanal de atendimentos por técnico, com disparo rápido de mensagem *"Estou a caminho"* via WhatsApp.
3. **Gestão de Clientes (`src/features/clientes/ClientList.tsx`)**:
   - Cadastro unificado com telefone formatado, endereço de atendimento e observações técnicas.
4. **Controle de Estoque (`src/features/estoque/EstoqueScreen.tsx`)**:
   - Baseado na view consolidada `InventoryStockView` (`entradas`, `saidas`, `saldo_atual`), com indicadores visuais de estoque crítico (`saldo_atual <= min_stock`).
5. **Gestão Financeira (`src/features/financeiro/FinancialView.tsx`)**:
   - Controle de entradas e saídas, categorização de despesas operacionais, status de liquidação e comprovantes anexados.
6. **Controle de Ferramentas (`src/features/ferramentas/ToolsView.tsx`)**:
   - Rastreamento de patrimônio técnico (`disponivel`, `emprestada`, `manutencao`) vinculado ao técnico responsável.
7. **Dashboard & Backups (`src/features/dashboard/`)**:
   - Indicadores estratégicos de faturamento, ticket médio e produtividade, além do `BackupManagerModal.tsx` para exportação e restauração de snapshots JSON das 10 tabelas centrais no bucket `topatudo-backups`.
8. **Configurações Administrativas (`src/features/config/`)**:
   - `ServicesCatalogView.tsx`: Padronização de preços e categorias de serviços.
   - `TechManagementView.tsx`: Cadastro de operadores, definição de papéis (`adm` / `tecnico`) e redefinição de PIN.
