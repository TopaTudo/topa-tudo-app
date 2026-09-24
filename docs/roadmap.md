# Roadmap de Produto e Engenharia — Topa Tudo

Este documento acompanha a evolução funcional e técnica da plataforma **Topa Tudo**, detalhando os módulos já entregues em produção e as próximas fases planejadas pela arquitetura.

---

## 1. Funcionalidades Concluídas (Em Produção)

### Gestão de Ordens de Serviço (OS)
- [x] Ciclo de vida completo da OS: `orcamento` → `agendado` → `em_andamento` → `concluido` / `cancelado`.
- [x] Numeração sequencial automática e formatação padronizada (`#00001`).
- [x] Registro fotográfico de campo (**Antes** e **Depois**) com upload otimizado para o Supabase Storage (`topatudo-media`).
- [x] Coleta de **Assinatura Digital** diretamente na tela do dispositivo (`SignaturePad`) e incorporação automática nos comprovantes.
- [x] Conclusão atômica via RPC (`complete_work_order`) com baixa automática de peças do estoque e lançamento de receita no financeiro.
- [x] Cálculo automático do prazo de garantia legal/contratual (padrão de 90 dias conforme Art. 26 do CDC).

### Pagamentos Instantâneos PIX (BR Code EMV)
- [x] Geração 100% local e determinística de payload **PIX Copia e Cola** seguindo o padrão EMV® QRCPS-MPM do Banco Central do Brasil.
- [x] Cálculo de checksum **CRC16-CCITT** (`0x1021`) e higienização de campos TLV (*Tag-Length-Value*).
- [x] Normalização inteligente de chaves PIX (EVP/UUID v4, CPF, CNPJ, E-mail e Telefone internacional).
- [x] Renderização de QR Code PIX em alta definição (PNG Base64, SVG vetorial síncrono e matriz binária direta para Canvas).

### Cupom Térmico Digital (Thermal Receipt 80mm HD) & Impressão A4
- [x] Motor gráfico em **HTML5 Canvas 2D** (`thermalReceipt.ts`) que gera cupons de bobina térmica 80mm em resolução Ultra-HD (`1700px` de largura, escala `2.5x`).
- [x] Acabamento realista com recorte serrilhado de guilhotina, emblema vetorial monocromático Topa Tudo, tabela de peças/mão de obra, QR Code PIX pixel-a-pixel, assinatura do cliente e código de barras vetorial **Code 128B**.
- [x] Orquestrador inteligente de compartilhamento (`shareReceipt.ts`):
  - **Mobile (Android/iOS)**: Anexa a imagem PNG diretamente no WhatsApp via *Web Share API Level 2*.
  - **Desktop (PC)**: Copia a imagem PNG diretamente para a área de transferência (`ClipboardItem`) para colagem rápida (`Ctrl + V`) no WhatsApp Web e abre a conversa do cliente.
- [x] Permite alterar ou informar o número de WhatsApp do destinatário no momento do envio sem sobrescrever o cadastro original.
- [x] Gerador de Ordem de Serviço em **Folha A4 (`printOS.ts`)** com layout `@media print` pronto para impressão ou salvamento nativo em PDF.

### Controle de Inventário, Ferramentas e Operação
- [x] **Inventário & Estoque (`EstoqueScreen`)**: Controle de entradas e saídas, custo unitário, fornecedor, separação entre material de estoque e compra avulsa na OS, e alertas de estoque mínimo (`InventoryStockView`).
- [x] **Gestão de Ferramentas (`ToolsView`)**: Controle patrimonial de ferramentas (`disponivel`, `emprestada`, `manutencao`) com vínculo ao técnico responsável.
- [x] **Agenda Técnica (`AgendaView`)**: Programação de visitas por data/horário e botão de aviso rápido *"Estou a caminho"* via WhatsApp (`generateOnTheWayMessage`).
- [x] **Gestão Financeira (`FinancialView`)**: Lançamentos de receitas e despesas, status (`confirmado` / `pendente`) e upload de comprovantes.
- [x] **Segurança & Backups (`backupService.ts`)**: Autenticação ágil por PIN via RPC, cache local de sessão e snapshots completos das 10 tabelas em JSON (download local + sincronização com bucket `topatudo-backups` e GitHub Actions).

---

## 2. Próximos Passos (Roadmap Futuro)

### Fase 1 — Operação Offline-First Avançada (Curto Prazo)
- [ ] **Persistência Local com IndexedDB**: Armazenar a fila de Ordens de Serviço atribuídas ao técnico localmente para leitura e preenchimento em subsolos ou áreas rurais sem sinal.
- [ ] **Fila de Sincronização (Background Sync)**: Permitir adicionar fotos "Antes/Depois", coletar assinatura digital e concluir a OS offline, sincronizando automaticamente com o Supabase assim que a conectividade retornar (`useOnlineStatus`).
- [ ] **Cache de Catálogo e Estoque**: Disponibilizar consulta completa de preços de serviços e itens de estoque em modo 100% offline.

### Fase 2 — Relatórios Avançados e Inteligência Financeira (Médio Prazo)
- [ ] **Relatórios Gerenciais Exportáveis (PDF / Excel / CSV)**:
  - DRE Simplificado mensal (Receitas de OS vs. Custos de Materiais vs. Despesas Operacionais).
  - Relatório de produtividade e comissionamento por técnico.
  - Curva ABC de materiais mais consumidos no estoque.
- [ ] **Análise de Margem por OS**: Visão comparativa detalhada entre valor cobrado, custo real de insumos aplicados e lucro líquido por atendimento.
- [ ] **Dashboard com Filtros de Período Customizáveis**: Comparativos mês a mês (MoM) e evolução de ticket médio.

### Fase 3 — Experiência do Cliente e Automação (Longo Prazo)
- [ ] **Link Público de Acompanhamento da OS**: Página web leve (acessível via QR Code do cupom) para o cliente consultar o status do serviço, visualizar fotos da execução, baixar a 2ª via do recibo e verificar a validade da garantia.
- [ ] **Integração com Webhook Bancário (PIX Dinâmico)**: Conciliação automática do pagamento da OS ao detectar a liquidação do `txid` junto ao provedor bancário.
- [ ] **Alertas Preventivos e Gestão de Garantias**: Notificações automáticas de revisões programadas e acompanhamento de chamados abertos dentro do período de garantia.
- [ ] **Impressão Direta Bluetooth (ESC/POS)**: Suporte opcional via Web Bluetooth API para mini-impressoras térmicas portáteis de 58mm/80mm em campo.

---

> Consulte também a [Visão Geral e Arquitetura (`docs/index.md`)](./index.md) e a [Referência de APIs (`docs/api.md`)](./api.md).
