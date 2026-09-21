import QRCode from 'qrcode';

export const PIX_CNPJ_RAW = '17411775000152';
export const PIX_CNPJ_FORMATTED = '17.411.775/0001-52';
export const PIX_MERCHANT_NAME = 'TOPA TUDO MANUTENCAO';
export const PIX_MERCHANT_CITY = 'BRASIL';

interface PixPayloadOptions {
  key?: string;
  name?: string;
  city?: string;
  amount?: number;
  txid?: string;
}

/**
 * Formata um campo TLV (Tag-Length-Value) padrão EMV.
 */
function formatTlv(id: string, value: string): string {
  const len = new TextEncoder().encode(value).length;
  return `${id}${String(len).padStart(2, '0')}${value}`;
}

/**
 * Calcula o checksum CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
 * conforme especificação do Banco Central para o padrão BR Code / PIX.
 */
function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;
  const bytes = new TextEncoder().encode(payload);

  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Remove acentos e caracteres especiais para compatibilidade com o padrão EMV.
 */
function sanitizeEmvString(str: string, maxLen: number): string {
  const sanitized = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim();
  return sanitized.substring(0, maxLen);
}

/**
 * Gera o payload oficial do PIX ("Pix Copia e Cola" - BR Code EMV)
 */
export function generatePixPayload(options: PixPayloadOptions = {}): string {
  const rawKey = (options.key || PIX_CNPJ_RAW).replace(/\D/g, '');
  const merchantName = sanitizeEmvString(options.name || PIX_MERCHANT_NAME, 25);
  const merchantCity = sanitizeEmvString(options.city || PIX_MERCHANT_CITY, 15);
  const rawTxid = options.txid ? options.txid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) : '***';
  const txid = rawTxid || '***';

  const amountStr =
    typeof options.amount === 'number' && options.amount > 0
      ? options.amount.toFixed(2)
      : '';

  // 00: Payload Format Indicator = 01
  const payloadFormat = formatTlv('00', '01');

  // 26: Merchant Account Information (Pix)
  const gui = formatTlv('00', 'br.gov.bcb.pix');
  const keyField = formatTlv('01', rawKey);
  const merchantAccountInfo = formatTlv('26', `${gui}${keyField}`);

  // 52: Merchant Category Code = 0000
  const mcc = formatTlv('52', '0000');

  // 53: Transaction Currency = 986 (BRL)
  const currency = formatTlv('53', '986');

  // 54: Transaction Amount (opcional se não houver valor fixo)
  const amountField = amountStr ? formatTlv('54', amountStr) : '';

  // 58: Country Code = BR
  const country = formatTlv('58', 'BR');

  // 59: Merchant Name
  const nameField = formatTlv('59', merchantName);

  // 60: Merchant City
  const cityField = formatTlv('60', merchantCity);

  // 62: Additional Data Field Template (txid)
  const txidField = formatTlv('05', txid);
  const additionalData = formatTlv('62', txidField);

  // Payload parcial antes do CRC16
  const rawPayload = `${payloadFormat}${merchantAccountInfo}${mcc}${currency}${amountField}${country}${nameField}${cityField}${additionalData}6304`;

  // 63: CRC16
  const checksum = crc16Ccitt(rawPayload);

  return `${rawPayload}${checksum}`;
}

/**
 * Gera Data URL (PNG Base64) do QR Code PIX de alta qualidade.
 */
export async function getPixQrCodeDataUrl(
  payload: string,
  options: { width?: number; margin?: number } = {}
): Promise<string> {
  try {
    return await QRCode.toDataURL(payload, {
      width: options.width || 320,
      margin: options.margin ?? 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Erro ao gerar QR Code PIX Data URL:', err);
    return getPixQrCodeFallbackUrl(payload, options.width || 320);
  }
}

/**
 * Gera string SVG do QR Code PIX de forma 100% síncrona e sem dependência externa.
 */
export function getPixQrCodeSvgSync(payload: string, margin = 1): string {
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const data = qr.modules.data;

    let path = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r * size + c]) {
          path += `M${c + margin} ${r + margin}h1v1h-1z `;
        }
      }
    }
    const total = size + margin * 2;
    return `<svg viewBox="0 0 ${total} ${total}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path fill="#0f172a" d="${path.trim()}"/></svg>`;
  } catch (err) {
    console.error('Erro ao gerar QR Code síncrono:', err);
    return '';
  }
}

/**
 * Gera string SVG do QR Code PIX para incorporação vetorial direta.
 */
export async function getPixQrCodeSvg(
  payload: string,
  options: { margin?: number } = {}
): Promise<string> {
  try {
    return await QRCode.toString(payload, {
      type: 'svg',
      margin: options.margin ?? 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Erro ao gerar QR Code PIX SVG:', err);
    return '';
  }
}

/**
 * URL de fallback via serviço público leve de QR Code se necessário
 */
export function getPixQrCodeFallbackUrl(payload: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(
    payload
  )}`;
}

/**
 * Copia texto para a área de transferência de forma compatível com navegadores mobile e desktop.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback abaixo
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Falha ao copiar texto:', err);
    return false;
  }
}
