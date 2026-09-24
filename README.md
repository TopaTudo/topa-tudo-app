# Topa Tudo — Sistema de Gestão Operacional & Ordens de Serviço

Plataforma oficial de operação de campo, Ordens de Serviço (OS), controle de estoque, agenda técnica, fluxo financeiro e emissão de comprovantes digitais da **Topa Tudo Comércio & Prestação de Serviços** (CNPJ `17.411.775/0001-52`).

Construído como um **Progressive Web App (PWA)** de alta performance com **React 19**, **Vite 6**, **Tailwind CSS** e **Supabase**, o sistema oferece experiência otimizada tanto para técnicos em atendimento externo (mobile) quanto para a administração no escritório (desktop).

---

## Documentação Oficial (`docs/`)

Toda a documentação técnica e arquitetural do projeto está organizada no diretório [`docs/`](./docs/):

| Documento | Descrição |
| :--- | :--- |
| **[Visão Geral e Arquitetura (`docs/index.md`)](./docs/index.md)** | Arquitetura técnica, stack (React 19, Vite, Supabase, Tailwind), estrutura de pastas, módulos e fluxo de dados. |
| **[Roadmap do Produto (`docs/roadmap.md`)](./docs/roadmap.md)** | Histórico de funcionalidades entregues (Thermal Receipt, PIX, OS, Inventário) e planejamento futuro (Modo Offline, Relatórios Avançados). |
| **[Referência de APIs (`docs/api.md`)](./docs/api.md)** | Documentação detalhada dos motores de pagamento PIX (EMV BR Code / CRC16), Cupom Térmico 80mm HD, WhatsApp e Impressão A4. |
| **[Guia de Contribuição e Deploy (`docs/contributing.md`)](./docs/contributing.md)** | Como configurar o ambiente local, executar scripts de banco/backup, rodar o build de produção e publicar na Vercel. |

---

## Principais Funcionalidades

- **Gestão Completa de Ordens de Serviço (OS)**: Abertura de orçamento, agendamento, acompanhamento em campo, fotos *Antes/Depois*, vínculo de materiais e coleta de **Assinatura Digital** na tela.
- **Cupom Térmico Digital 80mm (Ultra-HD)**: Renderização nativa em HTML5 Canvas (`1700px` de largura) com corte serrilhado de bobina, logotipo vetorial, tabela de peças e mão de obra, assinatura do cliente e código de barras **Code 128B**.
- **Pagamento Instantâneo PIX (BR Code EMV)**: Geração local de código *Pix Copia e Cola* e QR Code oficial conforme especificação do Banco Central, com cálculo automático de checksum `CRC16-CCITT` e identificador `txid` vinculado à OS.
- **Compartilhamento Inteligente no WhatsApp**:
  - **No Celular**: Anexa a foto PNG do cupom térmico diretamente no WhatsApp via *Web Share API*.
  - **No Computador**: Copia a imagem PNG para a área de transferência (`Ctrl + V` no WhatsApp Web) e abre o chat do cliente, permitindo editar o número do destinatário na hora.
- **Impressão A4 & PDF**: Documento técnico formal em folha A4 com Termo de Garantia Legal (Art. 26 do CDC) e registro fotográfico.
- **Controle de Estoque, Ferramentas e Financeiro**: Baixa automática de peças do estoque e lançamento de receita ao concluir a OS via RPC transacional (`complete_work_order`), além de controle de cautela de ferramentas por técnico.
- **Segurança & Backups**: Autenticação rápida por PIN validada via RPC no PostgreSQL e sistema integrado de backup/snapshot das 10 tabelas no Supabase Storage (`topatudo-backups`) e GitHub Actions.

---

## Início Rápido

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie `.env.example` para `.env.local` e informe as credenciais do projeto Supabase:

```bash
cp .env.example .env.local
```

```dotenv
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica-anon
```

### 3. Executar em Ambiente de Desenvolvimento

```bash
npm run dev
```

Acesse em `http://localhost:5173`.

### 4. Gerar Build de Produção

```bash
npm run build
```

---

## Stack Tecnológica

- **Frontend**: React 19 + TypeScript 5.7
- **Build & PWA**: Vite 6 + `vite-plugin-pwa`
- **Estilização**: Tailwind CSS 3 + Lucide React
- **Backend & Storage**: Supabase (PostgreSQL, Row Level Security, PL/pgSQL RPCs, Storage Buckets)
- **Gráficos & Pagamentos**: HTML5 Canvas 2D + `qrcode` (EMV BR Code PIX & Code 128B)

---

> **Topa Tudo Comércio & Prestação de Serviços** — *Cuidando do seu patrimônio com excelência e dedicação.*
