import type { Order, Client, Profile, OrderItem } from '@/core/types/database';
import { formatLocalDateTime } from '@/core/utils/date';
import { PIX_CNPJ_FORMATTED, generatePixPayload } from '@/core/utils/pix';

/**
 * Mapeia a forma de pagamento cadastrada para um rótulo legível e profissional.
 */
export function formatPaymentMethodLabel(method?: string | null): string {
  if (!method) return 'A Combinar';
  const map: Record<string, string> = {
    pix: 'PIX Instantâneo',
    dinheiro: 'Dinheiro em Espécie',
    cartao_debito: 'Cartão de Débito',
    cartao_credito: 'Cartão de Crédito',
    boleto: 'Boleto Bancário',
    a_combinar: 'A Combinar / Faturado',
  };
  return map[method] || method.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Calcula a data de expiração da garantia somando os dias à data de conclusão (ou data base informada).
 * Trata fusos horários locais e conversão segura para evitar drift de dias.
 */
export function calculateWarrantyEndDate(startDateIso?: string | null, days: number = 90): string {
  let base: Date;
  if (!startDateIso) {
    base = new Date();
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(startDateIso.trim())) {
    const [y, m, d] = startDateIso.trim().split('-').map(Number);
    base = new Date(y, m - 1, d);
  } else {
    base = new Date(startDateIso);
  }
  const validDate = isNaN(base.getTime()) ? new Date() : base;
  const endDate = new Date(validDate.getTime());
  endDate.setDate(endDate.getDate() + (Number(days) || 0));

  const day = String(endDate.getDate()).padStart(2, '0');
  const month = String(endDate.getMonth() + 1).padStart(2, '0');
  const year = endDate.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Sanitiza o número de telefone removendo caracteres não numéricos e garantindo o DDI 55 (Brasil).
 */
export function sanitizeWhatsAppPhone(phone?: string | null): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (!clean) return '';

  // Se tem 10 ou 11 dígitos (DDD + número), adiciona DDI 55
  if (clean.length <= 11) {
    return `55${clean}`;
  }
  return clean;
}

/**
 * Gera o texto formatado do comprovante e recibo de serviço para envio no WhatsApp
 * com layout enriquecido com emojis e mensagem acolhedora.
 */
export function generateReceiptMessage(
  order: Order,
  client?: Client | null,
  tech?: Profile | null,
  items?: OrderItem[]
): string {
  const codeFormatted = String(order.code).padStart(5, '0');
  const clientName = client?.name || order.client?.name || 'Cliente';
  const techName = tech?.name || order.tech?.name || 'Técnico Responsável Topa Tudo';

  const conclusionDate = order.completed_at
    ? formatLocalDateTime(order.completed_at)
    : formatLocalDateTime(new Date().toISOString());

  const serviceDesc = (order.description || 'Prestação de serviços técnicos de manutenção e reparos.').trim();

  const totalPrice = Number(order.total_price || 0).toFixed(2).replace('.', ',');
  const paymentMethod = formatPaymentMethodLabel(order.payment_method);
  const warrantyDays = order.warranty_days ?? 90;
  const warrantyEndDate = calculateWarrantyEndDate(order.completed_at, warrantyDays);

  const lines: string[] = [
    '🏠 *TOPA TUDO - MANUTENÇÃO & SERVIÇOS* ✨',
    '_Cuidando do seu patrimônio com excelência e dedicação!_',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '📄 *COMPROVANTE DE CONCLUSÃO DE SERVIÇO*',
    '',
    `📋 *Ordem de Serviço:* #${codeFormatted}`,
    `👤 *Cliente:* ${clientName}`,
    `📅 *Data de Conclusão:* ${conclusionDate}`,
    `👨🔧 *Técnico Responsável:* ${techName}`,
    '',
    '🛠️ *Serviço Executado:*',
    serviceDesc,
  ];

  // Materiais e peças aplicadas (exibido apenas se houver itens para não poluir)
  const orderItems = items || [];
  if (orderItems.length > 0) {
    lines.push('');
    lines.push('📦 *Materiais & Peças Aplicadas:*');
    orderItems.forEach((it) => {
      const qtyStr = it.quantity ? ` (x${it.quantity})` : '';
      lines.push(`• ${it.name}${qtyStr}`);
    });
  }

  lines.push('');
  lines.push(`💰 *Valor Total:* R$ ${totalPrice}`);
  lines.push(`💳 *Forma de Pagamento:* ${paymentMethod}`);
  if (warrantyDays > 0) {
    lines.push(`🛡️ *Garantia do Serviço:* ${warrantyDays} dias (Até ${warrantyEndDate}) 🔒`);
  } else {
    lines.push('🛡️ *Garantia:* Sob consulta / Conforme contratado');
  }

  // Dados do PIX para facilidade de pagamento do cliente
  const isPixMethod = !order.payment_method || order.payment_method === 'pix';
  if (isPixMethod || Number(order.total_price) > 0) {
    const pixPayload = generatePixPayload({
      amount: Number(order.total_price || 0),
      txid: `OS${codeFormatted}`,
    });

    lines.push('');
    lines.push('⚡ *DADOS PARA PAGAMENTO VIA PIX:*');
    lines.push(`🔑 *Chave CNPJ:* \`${PIX_CNPJ_FORMATTED}\``);
    lines.push('🏢 *Beneficiário:* Topa Tudo Manutenção');
    lines.push(`💵 *Valor:* R$ ${totalPrice}`);
    lines.push('');
    lines.push('📋 *Pix Copia e Cola:*');
    lines.push(`\`${pixPayload}\``);
    lines.push('_(Copie o código acima e cole no app do seu banco na opção Pix Copia e Cola)_');
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('🤝 *Agradecemos imensamente pela confiança!*');
  lines.push('Foi um prazer te atender. Se precisar de qualquer suporte ou de um novo reparo, estamos sempre à sua disposição! 📲💬');
  lines.push('');
  lines.push('⭐ *Topa Tudo:* O seu parceiro de confiança para qualquer reparo! 🔧⚡');

  return lines.join('\n');
}

/**
 * Gera a mensagem padrão de "a caminho" para avisar o cliente no WhatsApp com tom amigável e emojis.
 */
export function generateOnTheWayMessage(
  clientName?: string | null,
  techName?: string | null,
  orderCode?: number | string | null,
  description?: string | null
): string {
  const client = (clientName || 'Cliente').trim();
  const tech = (techName || 'técnico').trim();

  let details = '';
  if (orderCode) {
    details += ` da OS #${orderCode}`;
  }
  if (description && description.trim()) {
    details += ` (${description.trim()})`;
  }

  return `🚗 Olá ${client}, sou o ${tech} da Topa Tudo! Estou a caminho do seu endereço para o atendimento agendado${details}. Qualquer dúvida estou por aqui! 🔧✨`;
}

/**
 * Abre o WhatsApp Web ou App do celular com a mensagem preenchida.
 */
export function openWhatsAppReceipt(
  phone: string | null | undefined,
  receiptMessage: string
): boolean {
  const sanitized = sanitizeWhatsAppPhone(phone);
  if (!sanitized) {
    return false;
  }
  const encoded = encodeURIComponent(receiptMessage);
  const url = `https://wa.me/${sanitized}?text=${encoded}`;
  window.open(url, '_blank');
  return true;
}
