import QRCode from 'qrcode';
import type { Order, OrderItem, Client, Profile } from '@/core/types/database';
import { formatLocalDateTime } from '@/core/utils/date';
import { formatPaymentMethodLabel, calculateWarrantyEndDate } from '@/core/utils/whatsappReceipt';
import { PIX_KEY_FORMATTED, generatePixPayload } from '@/core/utils/pix';
import { TOPA_TUDO_EMBLEM_DARK_PATH, TOPA_TUDO_EMBLEM_YELLOW_PATH } from '@/core/ui/Logo';

export interface GeneratedThermalReceipt {
  blob: Blob;
  dataUrl: string;
  file: File;
  width: number;
  height: number;
}

/**
 * Famílias tipográficas de alta qualidade para o cupom térmico
 */
const FONT_SANS = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'Roboto Mono', 'SF Mono', Consolas, monospace";

/**
 * Tabela de padrões Code 128 (larguras de barras e espaços para cada símbolo 0-106)
 */
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (104=Start B, 106=Stop)
];

/**
 * Codifica texto para sequência binária Code 128B (1 = barra, 0 = espaço)
 */
export function encodeCode128B(text: string): string {
  const startB = 104;
  const stop = 106;
  const indices: number[] = [startB];
  let checksum = startB;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code < 0 || code > 95) continue;
    indices.push(code);
    checksum += code * (i + 1);
  }
  indices.push(checksum % 103);
  indices.push(stop);

  let modules = '';
  for (const idx of indices) {
    const pattern = CODE128_PATTERNS[idx];
    if (!pattern) continue;
    let isBar = true;
    for (const w of pattern) {
      modules += (isBar ? '1' : '0').repeat(Number(w));
      isBar = !isBar;
    }
  }
  return modules;
}

/**
 * Quebra texto em linhas baseado na largura máxima permitida no Canvas
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // Se uma única palavra for maior que maxWidth, fatia
      if (ctx.measureText(word).width > maxWidth) {
        let chunk = '';
        for (const char of word) {
          if (ctx.measureText(chunk + char).width <= maxWidth) {
            chunk += char;
          } else {
            lines.push(chunk);
            chunk = char;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Formata moeda BRL com 2 casas
 */
function formatMoney(value?: number | null): string {
  const num = Number(value || 0);
  return num.toFixed(2).replace('.', ',');
}

/**
 * Carrega uma imagem com timeout seguro e sem quebrar em caso de erro
 */
function loadImageSafe(src: string, timeoutMs = 3500): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(img);
      }
    };

    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    };

    img.src = src;
  });
}

/**
 * Desenha o caminho dos dentes de serra (guilhotina de bobina térmica)
 */
function drawSerratedPaperPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  toothWidth = 14.5,
  toothHeight = 7
) {
  const numTeeth = Math.ceil(width / toothWidth);
  ctx.beginPath();

  // Top edge serrations
  ctx.moveTo(0, toothHeight);
  for (let i = 0; i < numTeeth; i++) {
    const xMid = i * toothWidth + toothWidth / 2;
    const xEnd = Math.min((i + 1) * toothWidth, width);
    ctx.lineTo(xMid, 0);
    ctx.lineTo(xEnd, toothHeight);
  }

  // Right edge
  ctx.lineTo(width, height - toothHeight);

  // Bottom edge serrations (invertidos)
  for (let i = numTeeth; i > 0; i--) {
    const xMid = (i - 0.5) * toothWidth;
    const xEnd = (i - 1) * toothWidth;
    ctx.lineTo(xMid, height);
    ctx.lineTo(xEnd, height - toothHeight);
  }

  // Left edge
  ctx.lineTo(0, toothHeight);
  ctx.closePath();
}

/**
 * Desenha o Logotipo Monocromático da Topa Tudo estilo impressão térmica
 */
function drawThermalLogo(ctx: CanvasRenderingContext2D, centerX: number, topY: number, isPrazo: boolean): number {
  let y = topY;
  ctx.save();

  // 1. Emblema Arquitetônico Oficial Topa Tudo (Telhado + Chaminé + Triângulo)
  const targetW = 96;
  const scale = targetW / 631.8;
  const targetH = 323.2 * scale; // ~49px

  ctx.save();
  ctx.translate(centerX - (631.8 * scale) / 2 - 4.0 * scale, y - 84.5 * scale);
  ctx.scale(scale, scale);

  if (typeof Path2D !== 'undefined') {
    const darkPath = new Path2D(TOPA_TUDO_EMBLEM_DARK_PATH);
    const yellowPath = new Path2D(TOPA_TUDO_EMBLEM_YELLOW_PATH);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill(darkPath, 'evenodd');
    ctx.fill(yellowPath, 'evenodd');
  }
  ctx.restore();

  y += targetH + 14;

  // 2. Tipografia do Nome
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0a0a0a';

  ctx.font = `900 26px ${FONT_SANS}`;
  ctx.fillText('TOPA TUDO', centerX, y);
  y += 20;

  ctx.font = `700 12px ${FONT_SANS}`;
  ctx.fillText('COMÉRCIO & PRESTAÇÃO DE SERVIÇOS', centerX, y);
  y += 16;

  ctx.font = `600 12px ${FONT_MONO}`;
  ctx.fillText('CNPJ: 17.411.775/0001-52', centerX, y);
  y += 16;

  ctx.fillText('TEL / WHATSAPP: (77) 99987-7314', centerX, y);
  y += 18;

  // Caixa de destaque
  ctx.font = `700 13px ${FONT_SANS}`;
  const badgeText = isPrazo ? 'DUPLICATA DE PRESTAÇÃO DE SERVIÇOS' : 'COMPROVANTE DE PRESTAÇÃO DE SERVIÇOS';
  const badgeW = ctx.measureText(badgeText).width + 28;
  const badgeH = 26;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(centerX - badgeW / 2, y - 13, badgeW, badgeH);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(badgeText, centerX, y);
  y += 20;

  ctx.restore();
  return y;
}

/**
 * Gera um cupom térmico completo em imagem PNG de alta resolução.
 */
export async function generateThermalReceiptBlob(
  order: Order,
  client?: Client | null,
  tech?: Profile | null,
  items: OrderItem[] = []
): Promise<GeneratedThermalReceipt> {
  try {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {
    // Continua caso document.fonts não esteja disponível
  }

  const scale = 2.5; // Escala 2.5x para máxima nitidez de impressão e tela Retina
  const logicalWidth = 680; // Largura ampliada para máxima nitidez e legibilidade
  const marginX = 28;
  const contentWidth = logicalWidth - marginX * 2; // 624
  const centerX = logicalWidth / 2;

  // Carrega a assinatura digital antecipadamente se existir
  const signatureUrl = order.signature_url;
  const signatureImg = signatureUrl ? await loadImageSafe(signatureUrl) : null;

  // Prepara payload do PIX e QR Code
  const codeFormatted = String(order.code).padStart(5, '0');
  const pixPayload = generatePixPayload({
    amount: Number(order.total_price || 0),
    txid: `OS${codeFormatted}`,
  });

  let qrModules: { size: number; data: Uint8Array | number[] } | null = null;
  try {
    const qr = QRCode.create(pixPayload, { errorCorrectionLevel: 'M' });
    qrModules = { size: qr.modules.size, data: qr.modules.data };
  } catch (err) {
    console.error('Falha ao gerar QR Code para recibo térmico:', err);
  }

  // Barcode Code 128 da OS
  const barcodeStr = `OS-${codeFormatted}`;
  const barcodeBits = encodeCode128B(barcodeStr);

  // Variáveis do pedido
  const clientName = (client?.name || order.client?.name || 'Cliente').toUpperCase();
  const clientPhone = client?.phone || order.client?.phone || 'Não informado';
  const address = (order.address || order.client?.address || 'Endereço não informado').toUpperCase();
  const techName = (tech?.name || order.tech?.name || 'Técnico Autorizado Topa Tudo').toUpperCase();
  const serviceDesc = (order.description || 'Prestação de serviços técnicos e manutenção geral.').toUpperCase();

  const emissionDate = order.completed_at
    ? formatLocalDateTime(order.completed_at)
    : formatLocalDateTime(order.created_at || new Date().toISOString());

  const paymentMethodLabel = formatPaymentMethodLabel(order.payment_method).toUpperCase();
  const warrantyDays = order.warranty_days ?? 90;
  const warrantyEndDate = calculateWarrantyEndDate(order.completed_at || order.created_at, warrantyDays);

  const dueDate = order.due_date ? new Date(order.due_date).toLocaleDateString('pt-BR') : '---';
  const isPrazo = order.payment_method === 'prazo';

  // Cálculos de totais
  let totalMaterials = 0;
  if (items && items.length > 0) {
    totalMaterials = items.reduce((acc, it) => acc + Number(it.quantity || 1) * Number(it.unit_cost || 0), 0);
  }
  const totalGeral = Number(order.total_price || 0);
  const maoDeObra = Math.max(0, totalGeral - totalMaterials);

  // PASSO 1: Canvas temporário para medição da altura dinâmica
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d')!;

  mCtx.font = `500 13px ${FONT_SANS}`;
  const descLines = wrapText(mCtx, serviceDesc, contentWidth);
  const addressLines = wrapText(mCtx, address, contentWidth - 85);

  // Cálculo da altura necessária
  let estHeight = 24; // Top serration & padding
  estHeight += 190; // Logo e cabeçalho
  estHeight += 16; // Divisor
  estHeight += 42; // Título OS e emissão
  estHeight += 16; // Divisor
  estHeight += 74; // Cliente, contato, técnico
  estHeight += Math.max(18, addressLines.length * 17 + 2); // Linhas de endereço
  estHeight += 16; // Divisor
  estHeight += 24 + descLines.length * 17; // Descrição do serviço
  estHeight += 16; // Divisor

  // Itens
  if (items && items.length > 0) {
    estHeight += 16; // Cabeçalho itens
    estHeight += 16; // Divisor
    estHeight += items.length * 18; // Linhas de itens
    estHeight += 16; // Divisor
    estHeight += 38; // Subtotais e mão de obra
  } else {
    estHeight += 16; // Divisor
  }

  estHeight += 42; // Total Geral em destaque
  estHeight += 22; // Forma de pagamento
  estHeight += 16; // Divisor

  // Bloco PIX com QR Code
  estHeight += 48; // Título PIX, chave e favorecido
  estHeight += 225; // QR Code e legenda
  estHeight += 16; // Divisor

  // Garantia
  estHeight += 54; // Bloco garantia
  estHeight += 16; // Divisor

  // Assinatura
  estHeight += (signatureImg && signatureImg.naturalWidth > 0 ? 54 : 35) + 52;
  estHeight += 16; // Divisor

  // Código de barras e rodapé
  estHeight += 76; // Barcode
  estHeight += 58; // Mensagem final
  estHeight += 34; // Bottom serration & padding

  const totalHeight = Math.ceil(estHeight);

  // PASSO 2: Criar Canvas Final de Alta Resolução
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(logicalWidth * scale);
  canvas.height = Math.round(totalHeight * scale);

  const ctx = canvas.getContext('2d', { alpha: true })!;
  ctx.scale(scale, scale);

  // Renderização limpa
  ctx.textBaseline = 'middle';

  // 1. Recorte serrado da bobina (Fundo branco puro)
  drawSerratedPaperPath(ctx, logicalWidth, totalHeight, 14.5, 8);
  ctx.fillStyle = '#ffffff'; // Papel térmico branco puro
  ctx.fill();

  // Borda sutil de corte
  ctx.strokeStyle = '#e2e0dc';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Área interna do papel
  ctx.save();
  ctx.clip();

  // Função auxiliar para desenhar divisores com linha sólida vetorial
  function drawLine(y: number, strokeStyle = '#94a3b8', lineWidth = 1.5): number {
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(marginX, y);
    ctx.lineTo(logicalWidth - marginX, y);
    ctx.stroke();
    ctx.restore();
    return y + 16;
  }

  let curY = 16;

  // 2. Renderizar Logotipo e Cabeçalho
  curY = drawThermalLogo(ctx, centerX, curY, isPrazo);

  // Divisor
  curY = drawLine(curY);

  // 3. Informações da Ordem de Serviço
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0a0a0a';
  ctx.font = `800 17px ${FONT_SANS}`;
  ctx.fillText(`ORDEM DE SERVIÇO: #${codeFormatted}`, marginX, curY);
  curY += 20;

  if (isPrazo) {
    ctx.save();
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(marginX, curY, contentWidth, 40);
    ctx.font = `700 13px ${FONT_SANS}`;
    ctx.fillText('MODALIDADE: A PRAZO (DUPLICATA)', marginX + 10, curY + 15);
    ctx.fillText(`VENCIMENTO: ${dueDate}`, marginX + 10, curY + 30);
    ctx.restore();
    curY += 50;
  }

  ctx.textAlign = 'right';
  ctx.font = `700 14px ${FONT_SANS}`;
  ctx.fillText('STATUS: CONCLUÍDO', logicalWidth - marginX, curY);
  curY += 20;

  ctx.textAlign = 'left';
  ctx.font = `500 13px ${FONT_SANS}`;
  ctx.fillText(`EMISSÃO: ${emissionDate}`, marginX, curY);
  curY += 18;

  curY = drawLine(curY);

  // 4. Dados do Cliente e Técnico
  ctx.font = `700 13px ${FONT_SANS}`;
  ctx.fillText('CLIENTE:', marginX, curY);
  ctx.font = `600 14px ${FONT_SANS}`;
  ctx.fillText(clientName, marginX + 85, curY);
  curY += 18;

  ctx.font = `700 13px ${FONT_SANS}`;
  ctx.fillText('CONTATO:', marginX, curY);
  ctx.font = `600 13px ${FONT_MONO}`;
  ctx.fillText(clientPhone, marginX + 85, curY);
  curY += 18;

  ctx.font = `700 13px ${FONT_SANS}`;
  ctx.fillText('ENDEREÇO:', marginX, curY);
  ctx.font = `500 13px ${FONT_SANS}`;
  addressLines.forEach((line, idx) => {
    ctx.fillText(line, marginX + 85, curY + idx * 17);
  });
  curY += Math.max(18, addressLines.length * 17 + 2);

  ctx.font = `700 13px ${FONT_SANS}`;
  ctx.fillText('TÉCNICO:', marginX, curY);
  ctx.font = `600 13px ${FONT_SANS}`;
  ctx.fillText(techName, marginX + 85, curY);
  curY += 18;

  curY = drawLine(curY);

  // 5. Descrição do Serviço Executado
  ctx.font = `700 14px ${FONT_SANS}`;
  ctx.fillText('SERVIÇO EXECUTADO:', marginX, curY);
  curY += 18;

  ctx.font = `500 13px ${FONT_SANS}`;
  descLines.forEach((line) => {
    ctx.fillText(line, marginX, curY);
    curY += 17;
  });
  curY += 4;

  // 6. Tabela de Peças e Materiais
  if (items && items.length > 0) {
    curY = drawLine(curY);

    ctx.font = `700 13px ${FONT_MONO}`;
    ctx.fillText('QTD', marginX, curY);
    ctx.fillText('DESCRIÇÃO / MATERIAL', marginX + 50, curY);
    ctx.textAlign = 'right';
    ctx.fillText('VALOR (R$)', logicalWidth - marginX, curY);
    curY += 16;

    curY = drawLine(curY);

    ctx.font = `500 13px ${FONT_MONO}`;
    items.forEach((item) => {
      const qtyStr = `${String(item.quantity || 1).padStart(2, '0')}x`;
      const itemSubtotal = Number(item.quantity || 1) * Number(item.unit_cost || 0);
      const valStr = formatMoney(itemSubtotal);

      ctx.textAlign = 'left';
      ctx.fillText(qtyStr, marginX, curY);

      // Descrição do item com corte seguro
      const maxItemDescW = contentWidth - 170;
      let itName = (item.name || 'Item').toUpperCase();
      if (ctx.measureText(itName).width > maxItemDescW) {
        while (itName.length > 4 && ctx.measureText(`${itName}...`).width > maxItemDescW) {
          itName = itName.slice(0, -1);
        }
        itName = `${itName}...`;
      }
      ctx.fillText(itName, marginX + 50, curY);

      ctx.textAlign = 'right';
      ctx.fillText(valStr, logicalWidth - marginX, curY);
      curY += 18;
    });

    curY = drawLine(curY);
  } else {
    curY = drawLine(curY);
  }

  // 7. Totais e Subtotais
  ctx.textAlign = 'left';
  if (items && items.length > 0) {
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.fillText('SUBTOTAL PEÇAS:', marginX, curY);
    ctx.textAlign = 'right';
    ctx.font = `700 13px ${FONT_MONO}`;
    ctx.fillText(`R$ ${formatMoney(totalMaterials)}`, logicalWidth - marginX, curY);
    curY += 18;

    ctx.textAlign = 'left';
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.fillText('MÃO DE OBRA:', marginX, curY);
    ctx.textAlign = 'right';
    ctx.font = `700 13px ${FONT_MONO}`;
    ctx.fillText(`R$ ${formatMoney(maoDeObra)}`, logicalWidth - marginX, curY);
    curY += 18;
  }

  // Bloco de destaque TOTAL GERAL
  curY += 4;
  ctx.save();
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(marginX, curY - 17, contentWidth, 38);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = `800 17px ${FONT_SANS}`;
  ctx.fillText('TOTAL GERAL:', marginX + 14, curY + 2);

  ctx.textAlign = 'right';
  ctx.font = `900 21px ${FONT_MONO}`;
  ctx.fillText(`R$ ${formatMoney(totalGeral)}`, logicalWidth - marginX - 14, curY + 2);
  ctx.restore();
  curY += 34;

  // Forma de pagamento
  ctx.fillStyle = '#0a0a0a';
  ctx.textAlign = 'left';
  ctx.font = `700 13px ${FONT_SANS}`;
  ctx.fillText('FORMA DE PAGAMENTO:', marginX, curY);
  ctx.textAlign = 'right';
  ctx.font = `700 14px ${FONT_SANS}`;
  ctx.fillText(paymentMethodLabel, logicalWidth - marginX, curY);
  curY += 18;

  // 8. Bloco PIX com QR Code
  curY = drawLine(curY);

  ctx.textAlign = 'center';
  ctx.font = `800 15px ${FONT_SANS}`;
  ctx.fillText('PAGAMENTO INSTANTÂNEO PIX', centerX, curY);
  curY += 16;

  ctx.font = `600 11px ${FONT_MONO}`;
  ctx.fillText(`CHAVE PIX: ${PIX_KEY_FORMATTED}`, centerX, curY);
  curY += 14;

  ctx.font = `700 11px ${FONT_SANS}`;
  ctx.fillText('FAVORECIDO: AGRIPINO ONOFRE DE PAIVA', centerX, curY);
  curY += 15;

  // Renderizar QR Code pixel a pixel
  if (qrModules) {
    const qrSize = qrModules.size;
    const qrData = qrModules.data;
    const targetSize = 180;
    const modSize = Math.floor(targetSize / qrSize);
    const actualQrSize = modSize * qrSize;
    const qrLeft = Math.round(centerX - actualQrSize / 2);
    const qrTop = curY + 4;

    // Fundo branco do QR Code
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrLeft - 8, qrTop - 8, actualQrSize + 16, actualQrSize + 16);
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    ctx.strokeRect(qrLeft - 8, qrTop - 8, actualQrSize + 16, actualQrSize + 16);

    // Módulos pretos
    ctx.fillStyle = '#000000';
    for (let r = 0; r < qrSize; r++) {
      for (let c = 0; c < qrSize; c++) {
        if (qrData[r * qrSize + c]) {
          ctx.fillRect(qrLeft + c * modSize, qrTop + r * modSize, modSize, modSize);
        }
      }
    }
    curY = qrTop + actualQrSize + 18;
  } else {
    curY += 30;
  }

  ctx.font = `500 12px ${FONT_SANS}`;
  ctx.fillText('Abra o app do seu banco e aponte a câmera para pagar', centerX, curY);
  curY += 16;

  // 9. Garantia Técnica
  curY = drawLine(curY);

  ctx.textAlign = 'left';
  ctx.font = `700 13px ${FONT_SANS}`;
  ctx.fillText(`GARANTIA DO SERVIÇO: ${warrantyDays} DIAS`, marginX, curY);
  curY += 16;

  ctx.font = `600 13px ${FONT_SANS}`;
  ctx.fillText(`VALIDADE: ATÉ ${warrantyEndDate}`, marginX, curY);
  curY += 16;

  ctx.font = `500 11px ${FONT_SANS}`;
  ctx.fillText('(Conforme Art. 26 da Lei 8.078/90 - Código de Defesa do Consumidor)', marginX, curY);
  curY += 18;

  // 10. Assinatura do Cliente
  curY = drawLine(curY);

  if (signatureImg && signatureImg.naturalWidth > 0) {
    const sigH = 50;
    const sigW = Math.min(220, (signatureImg.naturalWidth / signatureImg.naturalHeight) * sigH);
    const sigX = centerX - sigW / 2;
    ctx.drawImage(signatureImg, sigX, curY, sigW, sigH);
    curY += sigH + 4;
  } else {
    curY += 35; // Espaço em branco para assinatura física
  }

  // Linha de assinatura
  ctx.textAlign = 'center';
  ctx.font = `600 13px ${FONT_MONO}`;
  ctx.fillText('________________________________________', centerX, curY);
  curY += 16;

  ctx.font = `700 13px ${FONT_SANS}`;
  ctx.fillText('ASSINATURA DO CLIENTE', centerX, curY);
  curY += 14;

  ctx.font = `500 12px ${FONT_SANS}`;
  ctx.fillText(clientName, centerX, curY);
  curY += 18;

  // 11. Código de Barras Vetorial Code 128
  curY = drawLine(curY);

  if (barcodeBits) {
    const bitWidth = 2;
    const barcodeTotalW = barcodeBits.length * bitWidth;
    const barcodeStartX = Math.round(centerX - barcodeTotalW / 2);
    const barcodeH = 42;

    ctx.fillStyle = '#0a0a0a';
    for (let b = 0; b < barcodeBits.length; b++) {
      if (barcodeBits[b] === '1') {
        ctx.fillRect(barcodeStartX + b * bitWidth, curY, bitWidth, barcodeH);
      }
    }
    curY += barcodeH + 12;

    ctx.textAlign = 'center';
    ctx.font = `700 13px ${FONT_MONO}`;
    ctx.fillText(`* ${barcodeStr} *`, centerX, curY);
    curY += 18;
  }

  // 12. Rodapé com Mensagem de Agradecimento
  ctx.font = `800 14px ${FONT_SANS}`;
  ctx.fillText('MUITO OBRIGADO PELA PREFERÊNCIA!', centerX, curY);
  curY += 16;

  ctx.font = `600 12px ${FONT_SANS}`;
  ctx.fillText('TOPA TUDO - CUIDANDO DO SEU PATRIMÔNIO', centerX, curY);
  curY += 14;

  ctx.font = `500 11px ${FONT_MONO}`;
  ctx.fillStyle = '#6b7280';
  ctx.fillText(`AUTENTICAÇÃO: TOPA-OS${codeFormatted}-VERIFIED`, centerX, curY);
  curY += 24;

  ctx.restore();

  // PASSO 3: Exportar Blob PNG, DataURL e File
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Erro ao gerar blob da imagem do recibo térmico'));
    }, 'image/png');
  });

  const fileName = `recibo-topatudo-OS${codeFormatted}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  return {
    blob,
    dataUrl,
    file,
    width: canvas.width,
    height: canvas.height,
  };
}
