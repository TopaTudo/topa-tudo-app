import type { Order, OrderItem } from '@/core/types/database';
import { formatLocalDateTime } from '@/core/utils/date';
import { formatBRL } from '@/core/utils/currency';
import { formatPaymentMethodLabel, calculateWarrantyEndDate } from '@/core/utils/whatsappReceipt';
import { getLogoSvgRaw } from '@/core/ui/Logo';
import { PIX_KEY_FORMATTED, generatePixPayload, getPixQrCodeSvgSync } from '@/core/utils/pix';

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Gera o documento HTML completo formatado em folha A4 com estilos @media print
 * para impressão e salvamento em PDF nativo do navegador.
 */
export function generateOrderPrintHTML(order: Order, items: OrderItem[] = []): string {
  const codeFormatted = `#${String(order.code).padStart(5, '0')}`;
  const clientName = escapeHtml(order.client?.name || 'Cliente Não Informado');
  const clientPhone = escapeHtml(order.client?.phone || 'Telefone não informado');
  const address = escapeHtml(order.address || order.client?.address || 'Endereço não informado');
  const techName = escapeHtml(order.tech?.name || 'Técnico Responsável Autorizado');
  const description = escapeHtml(order.description || 'Prestação de serviços técnicos e manutenção geral.');

  const emissionDate = formatLocalDateTime(order.created_at) || '---';
  const scheduledDate = order.scheduled_at ? formatLocalDateTime(order.scheduled_at) : null;
  const completionDate = order.completed_at ? formatLocalDateTime(order.completed_at) : null;

  const warrantyDays = order.warranty_days ?? 90;
  const warrantyEndDate = calculateWarrantyEndDate(order.completed_at || order.created_at, warrantyDays);
  const paymentMethodStr = formatPaymentMethodLabel(order.payment_method);
  const totalPriceFormatted = formatBRL(order.total_price);

  // Geração do Payload e QR Code PIX Oficial
  const pixCode = generatePixPayload({
    amount: Number(order.total_price || 0),
    txid: `OS${String(order.code).padStart(5, '0')}`,
  });
  const pixQrCodeSvg = getPixQrCodeSvgSync(pixCode, 1);

  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    orcamento: { label: 'Orçamento', color: '#92400e', bg: '#fef3c7' },
    agendado: { label: 'Agendado', color: '#1e40af', bg: '#dbeafe' },
    em_andamento: { label: 'Em Andamento', color: '#3730a3', bg: '#e0e7ff' },
    concluido: { label: 'Concluído', color: '#065f46', bg: '#d1fae5' },
    cancelado: { label: 'Cancelado', color: '#991b1b', bg: '#fee2e2' },
  };
  const statusInfo = statusMap[order.status] || statusMap.orcamento;

  // Tabela de Peças e Materiais
  let itemsTableRows = '';
  let totalMaterials = 0;
  if (items && items.length > 0) {
    itemsTableRows = items
      .map((it, idx) => {
        const subtotal = Number(it.quantity) * Number(it.unit_cost);
        totalMaterials += subtotal;
        return `
          <tr>
            <td style="text-align: center; width: 40px; color: #64748b;">${idx + 1}</td>
            <td>
              <strong>${escapeHtml(it.name)}</strong>
              <span class="tag-source">${it.source === 'estoque' ? 'Estoque' : 'Compra Externa'}</span>
            </td>
            <td style="text-align: center; width: 65px;">${it.quantity}</td>
            <td style="text-align: right; width: 100px;">${formatBRL(it.unit_cost)}</td>
            <td style="text-align: right; width: 110px; font-weight: 600;">${formatBRL(subtotal)}</td>
          </tr>
        `;
      })
      .join('');
  }

  // Fotos Antes e Depois
  const photosBefore = order.photos_before || [];
  const photosAfter = order.photos_after || [];
  const hasPhotos = photosBefore.length > 0 || photosAfter.length > 0;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ordem de Serviço ${codeFormatted} - Topa Tudo</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.45;
    }

    /* Barra superior visível apenas na tela / mobile */
    .screen-toolbar {
      position: sticky;
      top: 0;
      z-index: 999;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-bottom: 20px;
    }

    .screen-toolbar .btn-print {
      background: #059669;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s;
    }

    .screen-toolbar .btn-print:hover {
      background: #047857;
    }

    .screen-toolbar .btn-close {
      background: #334155;
      color: #ffffff;
      border: none;
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }

    .screen-toolbar .btn-close:hover {
      background: #475569;
    }

    @media print {
      .no-print {
        display: none !important;
      }
      body {
        background: #ffffff !important;
      }
      .page-container {
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        max-width: 100% !important;
      }
    }

    .page-container {
      max-width: 820px;
      margin: 0 auto;
      padding: 16px;
    }

    /* Cabeçalho Empresa & OS */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 2px solid #0f172a;
      margin-bottom: 12px;
    }

    .company-logo-wrap {
      width: 260px;
      max-width: 100%;
      margin-bottom: 4px;
    }

    .company-logo-wrap svg {
      width: 100%;
      height: auto;
      display: block;
    }

    .company-info .cnpj-meta {
      font-size: 10.5px;
      color: #475569;
      margin-top: 4px;
      line-height: 1.35;
    }

    .os-badge-box {
      text-align: right;
    }

    .os-number {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      margin-top: 4px;
      background: ${statusInfo.bg};
      color: ${statusInfo.color};
      border: 1px solid ${statusInfo.color}33;
    }

    .os-dates {
      font-size: 10px;
      color: #64748b;
      margin-top: 4px;
      line-height: 1.3;
    }

    /* Blocos de Informação em Grade */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }

    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }

    .card-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .card-title::before {
      content: "";
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #2563eb;
    }

    .field-value {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }

    .field-sub {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
    }

    /* Seção de Descrição */
    .section {
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }

    .desc-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 12px;
      color: #1e293b;
      white-space: pre-line;
      line-height: 1.5;
    }

    /* Tabela de Peças e Materiais */
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 4px;
      page-break-inside: avoid;
    }

    table.items-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    table.items-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
    }

    table.items-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }

    .tag-source {
      display: inline-block;
      font-size: 9px;
      font-weight: 600;
      color: #64748b;
      background: #e2e8f0;
      padding: 1px 4px;
      border-radius: 4px;
      margin-left: 6px;
    }

    .items-empty {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 11px;
      color: #64748b;
      font-style: italic;
    }

    /* Resumo Financeiro */
    .financial-summary {
      background: #0f172a;
      color: #ffffff;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .fin-group .label {
      font-size: 10px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .fin-group .val-total {
      font-size: 20px;
      font-weight: 900;
      color: #38bdf8;
    }

    .fin-group .val-method {
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
    }

    .fin-group .val-warranty {
      font-size: 11px;
      font-weight: 600;
      color: #34d399;
    }

    /* Fotos Antes e Depois */
    .photos-section {
      page-break-inside: avoid;
      margin-top: 12px;
    }

    .photos-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 6px;
    }

    .photo-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 4px;
      overflow: hidden;
    }

    .photo-item img {
      width: 100%;
      height: 90px;
      object-fit: cover;
      border-radius: 4px;
    }

    .photo-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
      margin-top: 3px;
    }

    /* Termo de Garantia e Responsabilidade */
    .warranty-terms {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      margin-top: 12px;
      page-break-inside: avoid;
    }

    .warranty-terms h4 {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .warranty-terms p {
      font-size: 9.5px;
      color: #475569;
      text-align: justify;
      line-height: 1.4;
    }

    /* Bloco de Pagamento PIX Instantâneo */
    .pix-payment-box {
      margin-top: 10px;
      margin-bottom: 12px;
      background: #f8fafc;
      border: 1.5px dashed #0284c7;
      border-radius: 8px;
      padding: 9px 12px;
      display: flex;
      align-items: center;
      gap: 14px;
      page-break-inside: avoid;
    }

    .pix-qr-wrap {
      width: 90px;
      height: 90px;
      min-width: 90px;
      background: #ffffff;
      padding: 3px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pix-qr-wrap svg {
      width: 100% !important;
      height: 100% !important;
      display: block;
    }

    .pix-details {
      flex: 1;
      font-size: 11px;
    }

    .pix-title {
      font-size: 11px;
      font-weight: 800;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .pix-sub {
      font-size: 9.5px;
      color: #64748b;
      margin-bottom: 4px;
    }

    .pix-field {
      font-size: 10.5px;
      color: #334155;
      margin-bottom: 2px;
    }

    .pix-copy-paste {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8px;
      color: #334155;
      background: #ffffff;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
      word-break: break-all;
      max-height: 22px;
      overflow: hidden;
      margin-top: 2px;
    }

    /* Assinaturas */
    .signatures-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 18px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .signature-block {
      text-align: center;
    }

    .sig-image-container {
      height: 48px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      margin-bottom: 4px;
    }

    .sig-img {
      max-height: 46px;
      max-width: 160px;
      object-fit: contain;
      display: block;
    }

    .sig-placeholder {
      height: 48px;
    }

    .signature-line {
      border-top: 1px solid #0f172a;
      margin-bottom: 4px;
    }

    .sig-name {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
    }

    .sig-role {
      font-size: 9.5px;
      color: #64748b;
    }

    /* Rodapé Documento */
    .footer-doc {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <!-- Barra de Ações na Tela (oculta na impressão) -->
  <div class="no-print screen-toolbar">
    <div style="font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px;">
      <span>Topa Tudo</span>
      <span style="opacity: 0.5;">|</span>
      <span style="font-weight: 400; font-size: 13px;">Visualização para Impressão &amp; PDF</span>
    </div>
    <div style="display: flex; gap: 10px;">
      <button type="button" class="btn-print" onclick="window.print()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        <span>Imprimir / Salvar PDF</span>
      </button>
      <button type="button" class="btn-close" onclick="window.close()">
        Fechar
      </button>
    </div>
  </div>

  <div class="page-container">
    <!-- Cabeçalho -->
    <header class="header">
      <div class="company-info">
        <div class="company-logo-wrap">
          ${getLogoSvgRaw('light')}
        </div>
        <div class="cnpj-meta">
          <strong>CNPJ:</strong> 17.411.775/0001-52 • <strong>Razão Social:</strong> TOPA TUDO MANUTENCAO<br />
          <strong>Atendimento Técnico &amp; Comprovante Autorizado</strong>
        </div>
      </div>

      <div class="os-badge-box">
        <div class="os-number">${codeFormatted}</div>
        <div>
          <span class="status-badge">${statusInfo.label}</span>
        </div>
        <div class="os-dates">
          <strong>Abertura:</strong> ${emissionDate}<br />
          ${scheduledDate ? `<strong>Agendado:</strong> ${scheduledDate}<br />` : ''}
          ${completionDate ? `<strong>Concluído:</strong> ${completionDate}` : ''}
        </div>
      </div>
    </header>

    <!-- Dados do Cliente e Técnico -->
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Dados do Cliente</div>
        <div class="field-value">${clientName}</div>
        <div class="field-sub"><strong>Tel/WhatsApp:</strong> ${clientPhone}</div>
        <div class="field-sub"><strong>Endereço:</strong> ${address}</div>
      </div>

      <div class="card">
        <div class="card-title">Dados Técnicos &amp; Garantia</div>
        <div class="field-value">${techName}</div>
        <div class="field-sub"><strong>Função:</strong> Técnico Responsável de Campo</div>
        <div class="field-sub"><strong>Garantia do Serviço:</strong> ${warrantyDays} dias (Até ${warrantyEndDate})</div>
      </div>
    </div>

    <!-- Descrição dos Serviços -->
    <div class="section">
      <div class="section-title">Descrição dos Serviços Executados</div>
      <div class="desc-box">${description}</div>
    </div>

    <!-- Peças e Materiais -->
    <div class="section">
      <div class="section-title">Peças e Materiais Aplicados</div>
      ${
        items.length > 0
          ? `
          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: center;">#</th>
                <th style="text-align: left;">Descrição do Item</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Unitário</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsTableRows}
            </tbody>
          </table>
        `
          : `
          <div class="items-empty">
            Nenhum material extra faturado nesta OS. Materiais e insumos de consumo padrão inclusos no serviço.
          </div>
        `
      }
    </div>

    <!-- Resumo Financeiro & Condições -->
    <div class="financial-summary">
      <div class="fin-group">
        <div class="label">Valor Total do Serviço</div>
        <div class="val-total">${totalPriceFormatted}</div>
      </div>
      <div class="fin-group" style="text-align: center;">
        <div class="label">Forma de Pagamento</div>
        <div class="val-method">${paymentMethodStr}</div>
      </div>
      <div class="fin-group" style="text-align: right;">
        <div class="label">Prazo de Garantia</div>
        <div class="val-warranty">${warrantyDays} Dias • Válida até ${warrantyEndDate}</div>
      </div>
    </div>

    <!-- Bloco de Pagamento PIX Instantâneo com QR Code -->
    <div class="pix-payment-box">
      <div class="pix-qr-wrap">
        ${pixQrCodeSvg}
      </div>
      <div class="pix-details">
        <div class="pix-title">
          <span>⚡</span> PAGAMENTO INSTANTÂNEO VIA PIX
        </div>
        <div class="pix-sub">Aponte a câmera do seu celular ou aplicativo bancário para pagar agora</div>
        <div class="pix-field"><strong>Chave PIX:</strong> <span>${PIX_KEY_FORMATTED}</span> • <strong>Favorecido:</strong> <span>Agripino Onofre de Paiva</span></div>
        <div class="pix-field"><strong>Valor da OS:</strong> <span class="pix-amount">${totalPriceFormatted}</span></div>
        <div class="pix-copy-paste">${escapeHtml(pixCode)}</div>
      </div>
    </div>

    <!-- Galeria de Fotos Antes e Depois (se houver) -->
    ${
      hasPhotos
        ? `
      <div class="photos-section">
        <div class="section-title">Registro Fotográfico de Execução</div>
        <div class="photos-grid">
          ${photosBefore
            .map(
              (url, i) => `
            <div class="photo-item">
              <img src="${escapeHtml(url)}" alt="Antes ${i + 1}" />
              <span class="photo-label">Antes #${i + 1}</span>
            </div>
          `
            )
            .join('')}
          ${photosAfter
            .map(
              (url, i) => `
            <div class="photo-item">
              <img src="${escapeHtml(url)}" alt="Depois ${i + 1}" />
              <span class="photo-label">Depois #${i + 1}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
        : ''
    }

    <!-- Termo de Garantia e Responsabilidade -->
    <div class="warranty-terms">
      <h4>Termo de Garantia Legal e Responsabilidade Técnica (Art. 26, Lei 8.078/1990)</h4>
      <p>
        Nos termos do Artigo 26, inciso II da Lei Federal nº 8.078/1990 (Código de Defesa do Consumidor), fica assegurada a garantia técnica de <strong>${warrantyDays} dias</strong> contados a partir da data de conclusão dos serviços e aplicação dos materiais descritos nesta Ordem de Serviço. A presente garantia cobre defeitos comprovados de instalação ou de fabricação dos componentes fornecidos pela contratada, cessando imediatamente sua validade em casos de mau uso, intervenção de terceiros não autorizados, sobrecargas e descargas na rede elétrica, sinistros ou acidentes fortuitos. O cliente declara ter conferido e aprovado a integridade e funcionamento das instalações/equipamentos.
      </p>
    </div>

    <!-- Assinaturas -->
    <div class="signatures-row">
      <div class="signature-block">
        ${
          order.signature_url
            ? `<div class="sig-image-container"><img src="${escapeHtml(
                order.signature_url
              )}" alt="Assinatura Digital do Cliente" class="sig-img" /></div>`
            : `<div class="sig-placeholder"></div>`
        }
        <div class="signature-line"></div>
        <div class="sig-name">${clientName}</div>
        <div class="sig-role">${
          order.signature_url
            ? 'Assinatura Digital Coletada'
            : 'Assinatura do Cliente / Responsável'
        }</div>
      </div>

      <div class="signature-block">
        <div class="sig-placeholder"></div>
        <div class="signature-line"></div>
        <div class="sig-name">${techName}</div>
        <div class="sig-role">Topa Tudo - Manutenção &amp; Serviços</div>
      </div>
    </div>

    <!-- Rodapé -->
    <footer class="footer-doc">
      <span>Topa Tudo • CNPJ: 17.411.775/0001-52 • Sistema de Gestão Operacional</span>
      <span>Documento gerado em ${formatLocalDateTime(new Date().toISOString())}</span>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Aciona a rotina nativa de impressão/salvar em PDF da Ordem de Serviço.
 * Abre em nova aba/janela isolada (ou iframe se houver bloqueio) com CSS @media print
 * otimizado para folha A4 e compatível com Android, iOS e navegadores desktop.
 */
export function printOrderService(order: Order, items: OrderItem[] = []): void {
  const html = generateOrderPrintHTML(order, items);

  try {
    // 1. Tentar abrir uma nova janela/aba limpa
    const printWindow = window.open('', '_blank');

    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      const triggerPrint = () => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (err) {
          console.warn('Disparo automático do print cancelado ou não suportado:', err);
        }
      };

      if (printWindow.document.readyState === 'complete') {
        setTimeout(triggerPrint, 350);
      } else {
        printWindow.onload = () => {
          setTimeout(triggerPrint, 350);
        };
        // Fallback de segurança para acionar mesmo se onload não disparar
        setTimeout(triggerPrint, 1000);
      }
      return;
    }
  } catch (windowErr) {
    console.warn('Não foi possível abrir nova janela para impressão:', windowErr);
  }

  // 2. Fallback: Iframe invisível caso o navegador bloqueie popups
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (printErr) {
          console.error('Falha ao imprimir através do iframe fallback:', printErr);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 500);
    }
  } catch (iframeErr) {
    console.error('Erro ao executar fallback de impressão:', iframeErr);
  }
}
