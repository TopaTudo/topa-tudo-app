import { sanitizeWhatsAppPhone } from '@/core/utils/whatsappReceipt';

export interface ShareReceiptOptions {
  phone?: string | null;
  clientName?: string | null;
  orderCode?: number | string | null;
  totalPrice?: number | null;
  customText?: string;
}

export type ShareResult =
  | { status: 'shared'; message: string }
  | { status: 'copied'; message: string }
  | { status: 'downloaded'; message: string }
  | { status: 'cancelled'; message: string }
  | { status: 'error'; message: string };

/**
 * Verifica se o dispositivo suporta compartilhamento nativo de arquivos (Web Share API Level 2)
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  if (typeof navigator.canShare !== 'function') return false;

  try {
    const testFile = new File(['test'], 'test.png', { type: 'image/png' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

/**
 * Verifica se o navegador suporta copiar imagens para a área de transferência
 */
export function canCopyImageToClipboard(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof ClipboardItem !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    window.isSecureContext
  );
}

/**
 * Copia o Blob da imagem PNG diretamente para a área de transferência (Clipboard)
 * Ideal para WhatsApp Web no computador (Operador dá Ctrl + V na conversa)
 */
export async function copyReceiptImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!canCopyImageToClipboard()) {
      return false;
    }

    // Garante que o MIME type é image/png
    const pngBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
    const item = new ClipboardItem({ 'image/png': pngBlob });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.warn('Falha ao copiar imagem para o clipboard:', err);
    return false;
  }
}

/**
 * Faz download automático do arquivo PNG no dispositivo
 */
export function downloadReceiptImage(blob: Blob | string, filename = 'recibo-topatudo.png'): void {
  const url = typeof blob === 'string' ? blob : URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (typeof blob !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Abre o chat do cliente no WhatsApp
 */
export function openWhatsAppChat(phone?: string | null, message = ''): boolean {
  const clean = sanitizeWhatsAppPhone(phone);
  if (!clean) return false;

  const url = message
    ? `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${clean}`;

  window.open(url, '_blank');
  return true;
}

/**
 * Orquestrador inteligente de compartilhamento do cupom térmico:
 * - Se celular com suporte a Web Share com arquivos: abre o compartilhamento nativo para WhatsApp direto com a foto anexada!
 * - Se computador (Desktop) ou navegador sem Web Share com arquivos: copia a foto para o clipboard e instrui/abre o WhatsApp Web.
 */
export async function shareThermalReceiptImage(
  file: File,
  blob: Blob,
  options: ShareReceiptOptions = {}
): Promise<ShareResult> {
  const codeStr = options.orderCode ? `#${String(options.orderCode).padStart(5, '0')}` : '';
  const clientName = options.clientName || 'Cliente';
  const shareTitle = `Recibo Topa Tudo OS ${codeStr}`;
  const shareText =
    options.customText ||
    `Olá ${clientName}! Segue o comprovante de prestação de serviços da OS ${codeStr} - Topa Tudo Manutenção & Reformas. Agradecemos a preferência! ✨`;

  // 1. Tentar Web Share nativo (Mobile Android / iOS)
  if (canShareFiles()) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        files: [file],
      });
      return { status: 'shared', message: 'Recibo compartilhado com sucesso!' };
    } catch (err: any) {
      // Se o usuário cancelou a folha de compartilhamento nativa
      if (err.name === 'AbortError') {
        return { status: 'cancelled', message: 'Compartilhamento cancelado.' };
      }
      console.warn('Erro ao compartilhar via Web Share:', err);
      // Cai no fallback abaixo
    }
  }

  // 2. Fallback PC / Desktop: Copiar para o Clipboard e abrir WhatsApp
  const copied = await copyReceiptImageToClipboard(blob);
  if (copied) {
    if (options.phone) {
      openWhatsAppChat(
        options.phone,
        `Olá ${clientName}! Segue seu recibo da OS ${codeStr}. (Cole a imagem com Ctrl+V aqui na conversa)`
      );
    }
    return {
      status: 'copied',
      message: 'Imagem do recibo copiada! Pressione Ctrl+V no WhatsApp para colar a foto.',
    };
  }

  // 3. Fallback de Download se a área de transferência não estiver disponível
  downloadReceiptImage(blob, file.name);
  if (options.phone) {
    openWhatsAppChat(options.phone);
  }
  return {
    status: 'downloaded',
    message: 'Foto baixada! Anexe a foto baixada na conversa do WhatsApp.',
  };
}
