import type { Order, Client, Profile, OrderItem } from '@/core/types/database';
import { formatLocalDateTime } from '@/core/utils/date';

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
 */
export function calculateWarrantyEndDate(startDateIso?: string | null, days: number = 90): string {
  const base = startDateIso ? new Date(startDateIso) : new Date();
  const validDate = isNaN(base.getTime()) ? new Date() : base;
  const endDate = new Date(validDate.getTime() + days * 24 * 60 * 60 * 1000);
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
 * Gera o texto formatado do recibo e comprovante de serviço para envio no WhatsApp.
 */
export function generateReceiptMessage(
  order: Order,
  client?: Client | null,
  tech?: Profile | null,
  items?: OrderItem[]
): string {
  const codeFormatted = String(order.code).padStart(5, '0');
  const clientName = client?.name || order.client?.name || 'Cliente';
  const techName = tech?.name || order.tech?.name || 'Técnico Autorizado Topa Tudo';

  const conclusionDate = order.completed_at
    ? formatLocalDateTime(order.completed_at)
    : formatLocalDateTime(new Date().toISOString());

  const serviceDesc = (order.description || 'Prestação de serviços técnicos de manutenção e reparos.').trim();

  // Materiais aplicados
  let materialsSection = '';
  const orderItems = items || [];
  if (orderItems.length > 0) {
    const list = orderItems
      .map((it) => `- ${it.name} (x${it.quantity})`)
      .join('\n');
    materialsSection = `\n📦 *Materiais / Insumos:*\n${list}\n`;
  } else {
    materialsSection = `\n📦 *Materiais / Insumos:*\n- Insumos padrão inclusos no serviço\n`;
  }

  const totalPrice = Number(order.total_price || 0).toFixed(2).replace('.', ',');
  const paymentMethod = formatPaymentMethodLabel(order.payment_method);
  const warrantyDays = order.warranty_days ?? 90;
  const warrantyEndDate = calculateWarrantyEndDate(order.completed_at, warrantyDays);

  return `*TOPA TUDO - COMPROVANTE & RECIBO DE SERVIÇO*
━━━━━━━━━━━━━━━━━━━━━━
📋 *Ordem de Serviço:* #${codeFormatted}
👤 *Cliente:* ${clientName}
📅 *Data de Conclusão:* ${conclusionDate}
👨🔧 *Técnico:* ${techName}

🛠️ *Serviço Prestado:*
${serviceDesc}
${materialsSection}
💰 *Valor Total:* R$ ${totalPrice}
💳 *Forma de Pagamento:* ${paymentMethod}
🛡️ *Garantia:* ${warrantyDays} dias (Até ${warrantyEndDate})
━━━━━━━━━━━━━━━━━━━━━━
Agradecemos a confiança em nossos serviços!
📞 *Topa Tudo:* Sempre prontos para te atender.`;
}

/**
 * Abre o WhatsApp Web ou App do celular com a mensagem do comprovante preenchida.
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
