import QRCode from 'qrcode';
import type { Order, OrderItem, Client, Profile } from '@/core/types/database';
import { formatLocalDateTime } from '@/core/utils/date';
import { formatPaymentMethodLabel, calculateWarrantyEndDate } from '@/core/utils/whatsappReceipt';
import { PIX_CNPJ_FORMATTED, generatePixPayload } from '@/core/utils/pix';

export interface GeneratedThermalReceipt {
  blob: Blob;
  dataUrl: string;
  file: File;
  width: number;
  height: number;
}

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
function drawThermalLogo(ctx: CanvasRenderingContext2D, centerX: number, topY: number): number {
  let y = topY;
  ctx.save();

  // 1. Emblema Vetorial (Escudo + Chave Inglesa + Raio)
  const iconW = 60;
  const iconH = 68;
  const iconX = centerX - iconW / 2;
  const iconY = y;

  // Escudo Hexagonal (Contorno e preenchimento sólido preto com recorte)
  ctx.strokeStyle = '#0a0a0a';
  ctx.fillStyle = '#0a0a0a';
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(centerX, iconY);
  ctx.lineTo(iconX + iconW, iconY + 15);
  ctx.lineTo(iconX + iconW, iconY + 45);
  ctx.lineTo(centerX, iconY + iconH);
  ctx.lineTo(iconX, iconY + 45);
  ctx.lineTo(iconX, iconY + 15);
  ctx.closePath();
  ctx.stroke();

  // Borda interna de precisão
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX, iconY + 5);
  ctx.lineTo(iconX + iconW - 5, iconY + 18);
  ctx.lineTo(iconX + iconW - 5, iconY + 42);
  ctx.lineTo(centerX, iconY + iconH - 6);
  ctx.lineTo(iconX + 5, iconY + 42);
  ctx.lineTo(iconX + 5, iconY + 18);
  ctx.closePath();
  ctx.stroke();

  // Chave Inglesa interna (Silhueta escura)
  ctx.save();
  ctx.translate(centerX, iconY + 34);
  ctx.rotate((-32 * Math.PI) / 180);
  ctx.fillStyle = '#0a0a0a';
  // Haste
  ctx.fillRect(-4, -18, 8, 38);
  // Cabeça superior da chave
  ctx.beginPath();
  ctx.arc(0, -18, 9, 0, Math.PI * 2);
  ctx.fill();
  // Abertura da chave (recorte branco)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-3, -28, 6, 12);
  // Cabeça inferior da chave (anel)
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(0, 20, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 20, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Raio Dinâmico no Centro (Em corte branco com borda preta)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(centerX + 3, iconY + 12);
  ctx.lineTo(centerX - 10, iconY + 33);
  ctx.lineTo(centerX - 1, iconY + 33);
  ctx.lineTo(centerX - 7, iconY + 54);
  ctx.lineTo(centerX + 11, iconY + 28);
  ctx.lineTo(centerX + 1, iconY + 28);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  y += iconH + 12;

  // 2. Tipografia do Nome
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0a0a0a';

  ctx.font = '900 24px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('TOPA TUDO', centerX, y);
  y += 18;

  ctx.font = '700 11px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('MANUTENÇÃO & REFORMAS', centerX, y);
  y += 14;

  ctx.font = '500 10px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('CNPJ: 17.411.775/0001-52', centerX, y);
  y += 14;

  ctx.fillText('TEL / WHATSAPP: (84) 99999-9999', centerX, y);
  y += 16;

  // Caixa de destaque: COMPROVANTE DE PRESTAÇÃO DE SERVIÇOS
  ctx.font = '700 11px "Space Mono", "Courier New", Consolas, monospace';
  const badgeText = 'COMPROVANTE DE PRESTAÇÃO DE SERVIÇOS';
  const badgeW = ctx.measureText(badgeText).width + 24;
  const badgeH = 22;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(centerX - badgeW / 2, y - 14, badgeW, badgeH);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(badgeText, centerX, y);
  y += 18;

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
  const scale = 2.5; // Escala 2.5x para máxima nitidez de impressão e tela Retina
  const logicalWidth = 580; // Largura padrão bobina 80mm
  const marginX = 28;
  const contentWidth = logicalWidth - marginX * 2;
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
  const serviceDesc = (order.description || 'Prestação de serviços de manutenção e reparos gerais.').toUpperCase();

  const emissionDate = order.completed_at
    ? formatLocalDateTime(order.completed_at)
    : formatLocalDateTime(order.created_at || new Date().toISOString());

  const paymentMethodLabel = formatPaymentMethodLabel(order.payment_method).toUpperCase();
  const warrantyDays = order.warranty_days ?? 90;
  const warrantyEndDate = calculateWarrantyEndDate(order.completed_at || order.created_at, warrantyDays);

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

  mCtx.font = '12px "Space Mono", "Courier New", Consolas, monospace';
  const descLines = wrapText(mCtx, serviceDesc, contentWidth);
  const addressLines = wrapText(mCtx, address, contentWidth - 85);

  // Cálculo da altura necessária
  let estHeight = 24; // Top serration & padding
  estHeight += 180; // Logo e cabeçalho
  estHeight += 36; // Divisor e título OS
  estHeight += 80; // Dados cliente e OS
  estHeight += (addressLines.length - 1) * 16; // Linhas adicionais de endereço
  estHeight += 24; // Divisor
  estHeight += 20 + descLines.length * 16; // Descrição do serviço
  estHeight += 24; // Divisor

  // Itens
  if (items && items.length > 0) {
    estHeight += 24; // Cabeçalho itens
    estHeight += items.length * 20; // Linhas de itens
    estHeight += 24; // Divisor
  }

  estHeight += 70; // Subtotais e mão de obra
  estHeight += 50; // Total Geral em destaque
  estHeight += 30; // Forma de pagamento
  estHeight += 24; // Divisor

  // Bloco PIX com QR Code
  estHeight += 36; // Título PIX
  estHeight += 210; // QR Code e chave
  estHeight += 24; // Divisor

  // Garantia
  estHeight += 65; // Bloco garantia
  estHeight += 24; // Divisor

  // Assinatura
  estHeight += signatureImg ? 110 : 80;
  estHeight += 24; // Divisor

  // Código de barras e rodapé
  estHeight += 80; // Barcode
  estHeight += 50; // Mensagem final
  estHeight += 30; // Bottom serration & padding

  const totalHeight = Math.ceil(estHeight);

  // PASSO 2: Criar Canvas Final de Alta Resolução
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(logicalWidth * scale);
  canvas.height = Math.round(totalHeight * scale);

  const ctx = canvas.getContext('2d', { alpha: true })!;
  ctx.scale(scale, scale);

  // Renderização limpa
  ctx.textBaseline = 'middle';

  // 1. Recorte serrado da bobina (Fundo off-white autêntico de papel térmico)
  drawSerratedPaperPath(ctx, logicalWidth, totalHeight, 14.5, 8);
  ctx.fillStyle = '#faf9f6'; // Papel térmico autêntico sutilmente off-white
  ctx.fill();

  // Borda sutil de corte
  ctx.strokeStyle = '#e2e0dc';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Área interna do papel
  ctx.save();
  ctx.clip();

  // Função auxiliar para desenhar divisores monoespaçados
  const drawLine = (yPos: number, char = '-', strokeStyle?: string) => {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 11px "Space Mono", "Courier New", Consolas, monospace';
    ctx.fillStyle = strokeStyle || '#4b5563';
    const count = 48;
    const text = char.repeat(count);
    ctx.fillText(text, centerX, yPos);
    ctx.restore();
  };

  let curY = 16;

  // 2. Renderizar Logotipo e Cabeçalho
  curY = drawThermalLogo(ctx, centerX, curY);

  // Divisor duplo
  drawLine(curY, '=');
  curY += 16;

  // 3. Informações da Ordem de Serviço
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0a0a0a';
  ctx.font = '700 15px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText(`ORDEM DE SERVIÇO: #${codeFormatted}`, marginX, curY);
  ctx.textAlign = 'right';
  ctx.font = '700 12px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('STATUS: CONCLUÍDO', logicalWidth - marginX, curY);
  curY += 18;

  ctx.textAlign = 'left';
  ctx.font = '500 11px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText(`EMISSÃO: ${emissionDate}`, marginX, curY);
  curY += 16;

  drawLine(curY, '-');
  curY += 16;

  // 4. Dados do Cliente e Técnico
  ctx.font = '700 11px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('CLIENTE:', marginX, curY);
  ctx.font = '600 12px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText(clientName, marginX + 65, curY);
  curY += 16;

  ctx.font = '700 11px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('CONTATO:', marginX, curY);
  ctx.font = '500 11px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText(clientPhone, marginX + 65, curY);
  curY += 16;

  ctx.font = '700 11px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('ENDEREÇO:', marginX, curY);
  ctx.font = '500 11px "Space Mono", "Courier New", Consolas, monospace';
  addressLines.forEach((line, idx) => {
    ctx.fillText(line, marginX + 75, curY + idx * 15);
  });
  curY += Math.max(16, addressLines.length * 15 + 2);

  ctx.font = '700 11px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('TÉCNICO:', marginX, curY);
  ctx.font = '600 11px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText(techName, marginX + 65, curY);
  curY += 16;

  drawLine(curY, '-');
  curY += 16;

  // 5. Descrição do Serviço Executado
  ctx.font = '700 12px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('SERVIÇO EXECUTADO:', marginX, curY);
  curY += 16;

  ctx.font = '500 11px "Space Mono", "Courier New", Consolas, monospace';
  descLines.forEach((line) => {
    ctx.fillText(line, marginX, curY);
    curY += 15;
  });
  curY += 4;

  // 6. Tabela de Peças e Materiais
  if (items && items.length > 0) {
    drawLine(curY, '-');
    curY += 14;

    ctx.font = '700 11px "Space Mono", "Courier New", Consolas, monospace';
    ctx.fillText('QTD', marginX, curY);
    ctx.fillText('DESCRIÇÃO / MATERIAL', marginX + 44, curY);
    ctx.textAlign = 'right';
    ctx.fillText('VALOR (R$)', logicalWidth - marginX, curY);
    curY += 14;

    drawLine(curY, '-');
    curY += 14;

    ctx.font = '500 11px "Space Mono", "Courier New", Consolas, monospace';
    items.forEach((item) => {
      const qtyStr = `${String(item.quantity || 1).padStart(2, '0')}x`;
      const itemSubtotal = Number(item.quantity || 1) * Number(item.unit_cost || 0);
      const valStr = formatMoney(itemSubtotal);

      ctx.textAlign = 'left';
      ctx.fillText(qtyStr, marginX, curY);

      // Descrição do item com corte seguro
      const maxItemDescW = contentWidth - 140;
      let itName = (item.name || 'Item').toUpperCase();
      if (ctx.measureText(itName).width > maxItemDescW) {
        while (itName.length > 4 && ctx.measureText(`${itName}...`).width > maxItemDescW) {
          itName = itName.slice(0, -1);
        }
        itName = `${itName}...`;
      }
      ctx.fillText(itName, marginX + 44, curY);

      ctx.textAlign = 'right';
      ctx.fillText(valStr, logicalWidth - marginX, curY);
      curY += 16;
    });

    drawLine(curY, '-');
    curY += 16;
  } else {
    drawLine(curY, '-');
    curY += 16;
  }

  // 7. Totais e Subtotais
  ctx.textAlign = 'left';
  ctx.font = '600 11px "Space Mono", "Courier New", Consolas, monospace';
  if (items && items.length > 0) {
    ctx.fillText('SUBTOTAL PEÇAS:', marginX, curY);
    ctx.textAlign = 'right';
    ctx.fillText(`R$ ${formatMoney(totalMaterials)}`, logicalWidth - marginX, curY);
    curY += 16;

    ctx.textAlign = 'left';
    ctx.fillText('MÃO DE OBRA:', marginX, curY);
    ctx.textAlign = 'right';
    ctx.fillText(`R$ ${formatMoney(maoDeObra)}`, logicalWidth - marginX, curY);
    curY += 16;
  }

  // Bloco de destaque TOTAL GERAL
  curY += 4;
  ctx.save();
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(marginX, curY - 14, contentWidth, 34);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = '800 15px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('TOTAL GERAL:', marginX + 12, curY + 3);

  ctx.textAlign = 'right';
  ctx.font = '900 18px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText(`R$ ${formatMoney(totalGeral)}`, logicalWidth - marginX - 12, curY + 3);
  ctx.restore();
  curY += 32;

  // Forma de pagamento
  ctx.fillStyle = '#0a0a0a';
  ctx.textAlign = 'left';
  ctx.font = '700 11px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('FORMA DE PAGAMENTO:', marginX, curY);
  ctx.textAlign = 'right';
  ctx.font = '700 12px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText(paymentMethodLabel, logicalWidth - marginX, curY);
  curY += 16;

  // 8. Bloco PIX com QR Code
  drawLine(curY, '*');
  curY += 16;

  ctx.textAlign = 'center';
  ctx.font = '800 13px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('PAGAMENTO INSTANTÂNEO PIX', centerX, curY);
  curY += 14;

  ctx.font = '600 10px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText(`CHAVE CNPJ: ${PIX_CNPJ_FORMATTED}`, centerX, curY);
  curY += 12;

  // Renderizar QR Code pixel a pixel
  if (qrModules) {
    const qrSize = qrModules.size;
    const qrData = qrModules.data;
    const targetSize = 175;
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

  ctx.font = '500 9.5px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('Abra o app do seu banco e aponte a câmera para pagar', centerX, curY);
  curY += 14;

  // 9. Garantia Técnica
  drawLine(curY, '-');
  curY += 16;

  ctx.textAlign = 'left';
  ctx.font = '700 11px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText(`GARANTIA DO SERVIÇO: ${warrantyDays} DIAS`, marginX, curY);
  curY += 14;

  ctx.font = '600 10.5px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText(`VALIDADE: ATÉ ${warrantyEndDate}`, marginX, curY);
  curY += 14;

  ctx.font = '500 9px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('(Conforme Art. 26 da Lei 8.078/90 - Código de Defesa do Consumidor)', marginX, curY);
  curY += 16;

  // 10. Assinatura do Cliente
  drawLine(curY, '-');
  curY += 14;

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
  ctx.font = '600 11px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('________________________________________', centerX, curY);
  curY += 14;

  ctx.font = '700 10.5px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('ASSINATURA DO CLIENTE', centerX, curY);
  curY += 12;

  ctx.font = '500 9.5px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText(clientName, centerX, curY);
  curY += 18;

  // 11. Código de Barras Vetorial Code 128
  drawLine(curY, '=');
  curY += 14;

  if (barcodeBits) {
    const bitWidth = 2;
    const barcodeTotalW = barcodeBits.length * bitWidth;
    const barcodeStartX = Math.round(centerX - barcodeTotalW / 2);
    const barcodeH = 40;

    ctx.fillStyle = '#0a0a0a';
    for (let b = 0; b < barcodeBits.length; b++) {
      if (barcodeBits[b] === '1') {
        ctx.fillRect(barcodeStartX + b * bitWidth, curY, bitWidth, barcodeH);
      }
    }
    curY += barcodeH + 12;

    ctx.textAlign = 'center';
    ctx.font = '700 11px "Space Mono", "Courier New", Consolas, monospace';
    ctx.fillText(`* ${barcodeStr} *`, centerX, curY);
    curY += 16;
  }

  // 12. Rodapé com Mensagem de Agradecimento
  ctx.font = '800 12px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('MUITO OBRIGADO PELA PREFERÊNCIA!', centerX, curY);
  curY += 14;

  ctx.font = '600 10px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillText('TOPA TUDO - CUIDANDO DO SEU PATRIMÔNIO', centerX, curY);
  curY += 12;

  ctx.font = '500 8.5px "Space Mono", "Courier New", Consolas, monospace';
  ctx.fillStyle = '#6b7280';
  ctx.fillText(`AUTENTICAÇÃO: TOPA-OS${codeFormatted}-VERIFIED`, centerX, curY);
  curY += 20;

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
