import React, { useState, useEffect, useRef } from 'react';
import type { Order, OrderItem, Client, Profile } from '@/core/types/database';
import {
  generateThermalReceiptBlob,
  GeneratedThermalReceipt,
} from '@/core/utils/thermalReceipt';
import {
  shareThermalReceiptImage,
  copyReceiptImageToClipboard,
  downloadReceiptImage,
  canShareFiles,
  canCopyImageToClipboard,
  openWhatsAppChat,
} from '@/core/utils/shareReceipt';
import {
  formatBrazilianPhone,
  isValidPhone,
  sanitizePhone,
} from '@/core/utils/whatsappReceipt';
import { useToast } from '@/core/context/ToastContext';
import {
  X,
  MessageCircle,
  Copy,
  Download,
  Check,
  Loader2,
  FileText,
  Share2,
  Printer,
  Sparkles,
  Smartphone,
  Monitor,
  Phone,
  RotateCcw,
  Edit2,
} from 'lucide-react';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  items?: OrderItem[];
  onSendAsText?: (customPhone?: string) => void;
  initialPhone?: string;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  items = [],
  onSendAsText,
  initialPhone,
}) => {
  const { success, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<GeneratedThermalReceipt | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMobileShare, setIsMobileShare] = useState(false);

  // Controle do Destinatário de WhatsApp (Número padrão do cliente vs Número alternativo)
  const [targetPhone, setTargetPhone] = useState<string>('');
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Inicializa o telefone quando abre o modal ou muda de OS
  useEffect(() => {
    if (isOpen && order) {
      const defaultPhone = initialPhone || order.client?.phone || '';
      setTargetPhone(defaultPhone ? formatBrazilianPhone(defaultPhone) : '');
      setIsEditingPhone(!order.client?.phone && !initialPhone);
    }
  }, [isOpen, order, initialPhone]);

  // Detecta se o navegador suporta compartilhamento nativo de arquivos
  useEffect(() => {
    setIsMobileShare(canShareFiles());
  }, []);

  // Gera o cupom térmico ao abrir
  useEffect(() => {
    if (!isOpen || !order) {
      setReceipt(null);
      setLoading(true);
      return;
    }

    let isMounted = true;
    setLoading(true);

    generateThermalReceiptBlob(order, order.client, order.tech, items)
      .then((generated) => {
        if (isMounted) {
          setReceipt(generated);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Erro ao gerar recibo térmico:', err);
        if (isMounted) {
          toastError('Erro ao gerar recibo', 'Não foi possível renderizar a imagem do cupom.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, order, items]);

  if (!isOpen || !order) return null;

  const codeFormatted = `#${String(order.code).padStart(5, '0')}`;
  const clientName = order.client?.name || 'Cliente';
  const clientPhone = order.client?.phone;

  // Ação Principal: Compartilhar no WhatsApp
  const handleShareWhatsApp = async () => {
    if (!receipt) return;

    const phoneToUse = targetPhone.trim() || clientPhone || '';

    // No desktop (ou sem suporte a Web Share nativo de arquivos), validar se tem número preenchido
    if (!isMobileShare && !isValidPhone(phoneToUse)) {
      setIsEditingPhone(true);
      toastError('Informe o WhatsApp', 'Digite o número de WhatsApp com DDD para realizar o envio.');
      return;
    }

    setSharing(true);

    try {
      const res = await shareThermalReceiptImage(receipt.file, receipt.blob, {
        phone: phoneToUse,
        clientName,
        orderCode: order.code,
        totalPrice: order.total_price,
      });

      if (res.status === 'shared') {
        success('Recibo Enviado!', 'Foto compartilhada com sucesso.');
      } else if (res.status === 'copied') {
        setCopied(true);
        setTimeout(() => setCopied(false), 4000);
        success('Foto copiada!', res.message);
      } else if (res.status === 'downloaded') {
        success('Foto baixada!', res.message);
      }
    } catch (err: any) {
      toastError('Falha no envio', err?.message || 'Tente salvar a foto.');
    } finally {
      setSharing(false);
    }
  };

  // Ação de Copiar Imagem para Clipboard (Desktop / WhatsApp Web)
  const handleCopyImage = async () => {
    if (!receipt) return;

    if (!canCopyImageToClipboard()) {
      // Fallback para download se não suportar cópia direta
      downloadReceiptImage(receipt.blob, receipt.file.name);
      success('Foto salva!', 'Cópia direta indisponível neste navegador. Foto baixada com sucesso.');
      return;
    }

    const ok = await copyReceiptImageToClipboard(receipt.blob);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
      success('Imagem copiada!', 'Abra a conversa do cliente no WhatsApp e pressione Ctrl + V para colar a foto.');
    } else {
      toastError('Erro ao copiar', 'Tente salvar a imagem pelo botão de download.');
    }
  };

  // Ação de Download da Imagem
  const handleDownloadImage = () => {
    if (!receipt) return;
    downloadReceiptImage(receipt.blob, receipt.file.name);
    success('Foto baixada!', `Arquivo ${receipt.file.name} salvo no seu aparelho.`);
  };

  // Imprimir imagem diretamente
  const handlePrintImage = () => {
    if (!receipt) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toastError('Bloqueio de pop-up', 'Permita pop-ups para imprimir o cupom.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recibo Térmico OS ${codeFormatted}</title>
          <style>
            @page { margin: 0; size: auto; }
            body { margin: 0; padding: 10px; display: flex; justify-content: center; background: #fff; }
            img { max-width: 100%; height: auto; display: block; }
          </style>
        </head>
        <body>
          <img src="${receipt.dataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const isCustomNumberActive =
    !!targetPhone &&
    (!clientPhone || targetPhone !== formatBrazilianPhone(clientPhone));

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg md:max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] my-auto animate-in zoom-in-95 duration-200">
        {/* Header do Modal */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Cupom Térmico (Foto)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 uppercase tracking-wider">
                  80mm Bobina
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                OS {codeFormatted} • {clientName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Preview do Cupom Térmico */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 bg-radial from-slate-900 via-slate-950 to-slate-950 flex flex-col items-center justify-start min-h-[340px]"
        >
          {loading ? (
            <div className="my-auto flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Printer className="w-6 h-6 text-amber-400 animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-white">Gerando Cupom Térmico em Alta Resolução...</p>
                <p className="text-xs text-slate-400">Calculando layout, QR Code PIX e corte serrilhado</p>
              </div>
            </div>
          ) : receipt ? (
            <div className="relative group max-w-[460px] md:max-w-[500px] w-full transition-all duration-300">
              {/* Selo/badge verde no topo da imagem */}
              <div className="flex items-center justify-center mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-sm backdrop-blur-xs">
                  ✓ Alta Resolução HD (1700px)
                </span>
              </div>

              {/* Efeito de Sombra, Borda Sutil e Cantos Arredondados do Papel Térmico */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl shadow-black/80 transition-transform">
                <img
                  src={receipt.dataUrl}
                  alt={`Recibo Térmico OS ${codeFormatted}`}
                  className="w-full h-auto block select-none rounded-2xl pointer-events-auto"
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Resolução: {receipt.width}x{receipt.height}px (Ultra-Nítido)</span>
                </span>
                <span className="text-slate-500">Formato PNG</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Dica de Envio / Status */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2">
            {isMobileShare ? (
              <>
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>
                  No celular: o WhatsApp <strong>anexa a foto diretamente</strong>!
                </span>
              </>
            ) : (
              <>
                <Monitor className="w-4 h-4 text-blue-400" />
                <span>
                  No PC: use <strong>Copiar Foto</strong> e cole com <strong>Ctrl + V</strong> no WhatsApp Web!
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handlePrintImage}
            disabled={loading || !receipt}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
            title="Imprimir direto em impressora térmica ou comum"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>

        {/* Ações Inferiores Ergonômicas */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 space-y-3 shrink-0">
          {/* Seção Amigável e Discreta: Destinatário WhatsApp */}
          <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 transition-all">
            {!isEditingPhone && clientPhone ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-[11px] font-medium text-slate-400 leading-tight">
                      Destinatário WhatsApp:
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-white truncate">
                      {isCustomNumberActive ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-amber-400">Outro número:</span>
                          <span className="font-mono text-emerald-300">{targetPhone}</span>
                        </span>
                      ) : (
                        <span>
                          {clientName}{' '}
                          <span className="text-emerald-400 font-mono font-medium">
                            ({formatBrazilianPhone(clientPhone)})
                          </span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isCustomNumberActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetPhone(formatBrazilianPhone(clientPhone));
                        setIsEditingPhone(false);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      title="Restaurar número do cliente"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEditingPhone(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-all border border-slate-700/80 active:scale-95 flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Alterar Número</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp do Destinatário:</span>
                  </label>

                  {clientPhone && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetPhone(formatBrazilianPhone(clientPhone));
                        setIsEditingPhone(false);
                      }}
                      className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restaurar número do cliente</span>
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <input
                    type="tel"
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(formatBrazilianPhone(e.target.value))}
                    placeholder="(DDD) 99999-9999"
                    className="w-full pl-9 pr-20 py-2 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                  />
                  <div className="absolute left-3 text-emerald-400 pointer-events-none">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  {clientPhone && (
                    <button
                      type="button"
                      onClick={() => setIsEditingPhone(false)}
                      className="absolute right-2 px-2.5 py-1 text-[11px] font-bold bg-slate-800 text-emerald-300 hover:text-white rounded-lg border border-slate-700 transition-colors"
                    >
                      Pronto
                    </button>
                  )}
                </div>

                {!clientPhone && (
                  <p className="text-[11px] text-amber-400/90 flex items-center gap-1">
                    <span>⚠️ Cliente sem telefone cadastrado. Digite o número com DDD.</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Botão Primário de Destaque: Enviar Foto no WhatsApp */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={loading || sharing || !receipt}
            className="w-full min-h-[52px] flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm sm:text-base shadow-xl shadow-emerald-600/30 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {sharing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Abrindo Compartilhamento...</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 fill-white/10" />
                <span>Enviar Foto no WhatsApp</span>
              </>
            )}
          </button>

          {/* Linha de Botões Secundários: Copiar Imagem + Salvar Imagem */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyImage}
              disabled={loading || !receipt}
              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm border transition-all active:scale-95 ${
                copied
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-200 hover:text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Foto Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-300" />
                  <span>Copiar Imagem</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={loading || !receipt}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white transition-all active:scale-95"
            >
              <Download className="w-4 h-4 text-slate-300" />
              <span>Salvar Foto</span>
            </button>
          </div>

          {/* Opção Alternativa: Enviar como Texto Clássico */}
          {onSendAsText && (
            <button
              type="button"
              onClick={() => {
                const phoneToUse = targetPhone.trim() || clientPhone || '';
                if (!isValidPhone(phoneToUse)) {
                  setIsEditingPhone(true);
                  toastError('Informe o WhatsApp', 'Digite um número de WhatsApp válido com DDD.');
                  return;
                }
                onClose();
                onSendAsText(phoneToUse);
              }}
              className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Preferir envio como texto tradicional</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
