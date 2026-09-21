import React, { useState, useEffect } from 'react';
import { supabase, completeWorkOrderRPC } from '@/core/supabase';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import type { Order, OrderItem } from '@/core/types/database';
import { printOrderService } from '@/core/utils/printOS';
import { generateReceiptMessage, openWhatsAppReceipt } from '@/core/utils/whatsappReceipt';
import { OrderPhotoUpload } from './OrderPhotoUpload';
import {
  X,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Shield,
  DollarSign,
  Package,
  Edit3,
  Navigation,
  Share2,
  Loader2,
  Printer,
} from 'lucide-react';

interface OrderDetailModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (order: Order) => void;
  onRefresh: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  orderId,
  isOpen,
  onClose,
  onEdit,
  onRefresh,
}) => {
  const { isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showReceiptPrompt, setShowReceiptPrompt] = useState(false);

  useEffect(() => {
    if (!orderId || !isOpen) return;

    let isMounted = true;
    setLoading(true);

    async function loadOrder() {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(*),
          tech:profiles(*)
        `)
        .eq('id', orderId)
        .single();

      if (error) {
        toastError('Erro ao carregar OS', error.message);
        onClose();
        return;
      }

      if (isMounted && data) {
        setOrder(data as unknown as Order);
      }

      // Load items
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (isMounted && itemsData) {
        setItems(itemsData as OrderItem[]);
      }

      if (isMounted) setLoading(false);
    }

    loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId, isOpen]);

  if (!isOpen || !orderId) return null;

  // Status badges configuration
  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    orcamento: { label: 'Orçamento', bg: 'bg-amber-100', text: 'text-amber-800' },
    agendado: { label: 'Agendado', bg: 'bg-blue-100', text: 'text-blue-800' },
    em_andamento: { label: 'Em Andamento', bg: 'bg-indigo-100', text: 'text-indigo-800' },
    concluido: { label: 'Concluído', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    cancelado: { label: 'Cancelado', bg: 'bg-rose-100', text: 'text-rose-800' },
  };

  const currentStatus = order ? statusConfig[order.status] || statusConfig.orcamento : statusConfig.orcamento;

  // Complete Work Order Handler via RPC
  const handleCompleteOrder = async () => {
    if (!order) return;
    if (order.status === 'concluido') {
      toastError('Aviso', 'Esta ordem já está concluída.');
      return;
    }

    const confirm = window.confirm(
      `Deseja realmente CONCLUIR a OS #${order.code}?\n\n- Itens do estoque terão baixa automática.\n- O valor de R$ ${Number(
        order.total_price
      ).toFixed(2)} será lançado como receita confirmada no financeiro.`
    );

    if (!confirm) return;

    setCompleting(true);
    try {
      const res = await completeWorkOrderRPC(order.id);
      if (res && res.success) {
        success(
          `OS #${order.code} Concluída com Sucesso!`,
          `Baixa em ${res.items_deducted} materiais e receita registrada.`
        );
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                status: 'concluido',
                completed_at: new Date().toISOString(),
              }
            : null
        );
        onRefresh();
        setShowReceiptPrompt(true);
      }
    } catch (err: any) {
      console.error('Falha ao concluir OS:', err);
      toastError('Erro ao concluir OS', err.message || 'Verifique sua conexão');
    } finally {
      setCompleting(false);
    }
  };

  // Enviar Recibo Formatado ao Cliente via WhatsApp
  const handleSendReceipt = () => {
    if (!order) return;
    if (!order.client?.phone) {
      toastError('Cliente sem telefone', 'Adicione um número de WhatsApp ao cadastro do cliente para enviar o recibo.');
      return;
    }

    const receiptText = generateReceiptMessage(order, order.client, order.tech, items);
    const sent = openWhatsAppReceipt(order.client.phone, receiptText);
    if (sent) {
      success('Recibo pronto no WhatsApp!', 'Conversa aberta com o recibo formatado.');
    } else {
      toastError('Telefone inválido', 'Não foi possível formatar o número do cliente para WhatsApp.');
    }
  };

  // Imprimir OS / Salvar como PDF profissional A4
  const handlePrint = () => {
    if (!order) return;
    printOrderService(order, items);
  };

  // WhatsApp Link Helper
  const openWhatsApp = () => {
    if (!order?.client?.phone) {
      toastError('Cliente sem telefone', 'Adicione um número de WhatsApp ao cadastro.');
      return;
    }
    const cleanPhone = order.client.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const text = encodeURIComponent(
      `Olá ${order.client.name}! Aqui é da equipe Topa Tudo referente à Ordem de Serviço #${order.code} (${order.description || 'serviço'}).`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  // Maps / Navigation Link Helper
  const openMaps = () => {
    const addressToUse = order?.address || order?.client?.address;
    if (!addressToUse) {
      toastError('Endereço não informado', 'Informe o endereço na ordem de serviço.');
      return;
    }
    const query = encodeURIComponent(addressToUse);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  // Quick Photo Updates from Detail Modal
  const handleUpdateBeforePhotos = async (newPhotos: string[]) => {
    if (!order) return;
    await supabase.from('orders').update({ photos_before: newPhotos }).eq('id', order.id);
    setOrder({ ...order, photos_before: newPhotos });
    success('Fotos atualizadas!');
  };

  const handleUpdateAfterPhotos = async (newPhotos: string[]) => {
    if (!order) return;
    await supabase.from('orders').update({ photos_after: newPhotos }).eq('id', order.id);
    setOrder({ ...order, photos_after: newPhotos });
    success('Fotos atualizadas!');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl font-extrabold tracking-tight">
              OS #{order?.code || '---'}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${currentStatus.bg} ${currentStatus.text}`}
            >
              {currentStatus.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {order && (
              <>
                <button
                  type="button"
                  onClick={handlePrint}
                  aria-label="Imprimir / Salvar PDF"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-industrial-800 text-slate-200 hover:text-white active:scale-95 transition-all"
                  title="Imprimir ou Salvar PDF (A4)"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onEdit(order);
                    onClose();
                  }}
                  aria-label="Editar OS"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-industrial-800 text-slate-200 hover:text-white active:scale-95 transition-all"
                  title="Editar OS"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhes da OS"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-industrial-800 text-slate-200 hover:text-white active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scroll Content */}
        {loading || !order ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-600">
            <Loader2 className="w-10 h-10 animate-spin text-industrial-800 mb-3" />
            <p className="font-semibold text-sm">Carregando detalhes da OS...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Quick 1-Touch Action Buttons for Field Technicians */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={openWhatsApp}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all min-h-[48px]"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>WhatsApp Cliente</span>
              </button>

              <button
                type="button"
                onClick={openMaps}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all min-h-[48px]"
              >
                <Navigation className="w-4 h-4 shrink-0" />
                <span>Navegar GPS</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-industrial-800 hover:bg-industrial-900 text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all min-h-[48px]"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>Imprimir / PDF</span>
              </button>
            </div>

            {/* Client & Tech Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Cliente
                </span>
                <div className="font-bold text-base text-slate-900">
                  {order.client?.name || 'Cliente não identificado'}
                </div>
                {order.client?.phone && (
                  <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{order.client.phone}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Técnico Responsável
                </span>
                <div className="font-bold text-base text-slate-900 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-industrial-800" />
                  <span>{order.tech?.name || 'Não atribuído'}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Garantia: <strong>{order.warranty_days} dias</strong>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Endereço de Atendimento
              </span>
              <div className="text-sm font-semibold text-slate-800 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{order.address || order.client?.address || 'Sem endereço informado'}</span>
              </div>
            </div>

            {/* Scheduled Date */}
            {order.scheduled_at && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold">
                <Calendar className="w-4 h-4 text-blue-700" />
                <span>
                  Agendado para:{' '}
                  {new Date(order.scheduled_at).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}

            {/* Service Description */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                Descrição dos Serviços
              </span>
              <p className="text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                {order.description || 'Nenhuma descrição detalhada.'}
              </p>
            </div>

            {/* Order Items */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Peças e Materiais Aplicados ({items.length})
              </span>
              {items.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  Nenhuma peça cadastrada nesta OS.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-industrial-800" />
                        <span className="font-semibold text-slate-800">{it.name}</span>
                        <span className="text-slate-400">
                          ({it.source === 'estoque' ? 'Estoque' : 'Comprado'})
                        </span>
                      </div>
                      <div className="font-bold text-slate-700">
                        {it.quantity} un × R$ {Number(it.unit_cost).toFixed(2)} = R${' '}
                        {(it.quantity * it.unit_cost).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Summary Box */}
            <div className="p-4 rounded-2xl bg-industrial-900 text-white flex items-center justify-between shadow-lg">
              <div>
                <span className="text-xs text-blue-300 font-medium block">
                  Valor Total do Serviço
                </span>
                <span className="text-2xl font-black text-amberAlert-500">
                  R$ {Number(order.total_price).toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-blue-300 font-medium block">
                  Forma de Pagamento
                </span>
                <span className="text-sm font-bold capitalize text-white">
                  {order.payment_method?.replace('_', ' ') || 'PIX'}
                </span>
              </div>
            </div>

            {/* Photo Gallery with Direct Camera / Upload Support */}
            <div className="pt-2 border-t border-slate-200 space-y-4">
              <OrderPhotoUpload
                label="Fotos do Local (Antes)"
                photos={order.photos_before || []}
                onChange={handleUpdateBeforePhotos}
              />

              <OrderPhotoUpload
                label="Fotos do Serviço Finalizado (Depois)"
                photos={order.photos_after || []}
                onChange={handleUpdateAfterPhotos}
              />
            </div>
          </div>
        )}

        {/* Modal Footer: Action Buttons */}
        {order && (
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 active:scale-95 transition-all"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm active:scale-95 transition-all shadow-xs"
                title="Imprimir ou Salvar PDF"
              >
                <Printer className="w-4 h-4 text-industrial-800" />
                <span>Imprimir / PDF</span>
              </button>
            </div>

            {order.status !== 'concluido' ? (
              <button
                type="button"
                onClick={handleCompleteOrder}
                disabled={completing}
                className="flex-1 sm:flex-none sm:min-w-[220px] min-h-[48px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-greenSuccess-600 hover:bg-greenSuccess-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-700/30 transition-all disabled:opacity-50"
              >
                {completing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                <span>{completing ? 'Concluindo...' : 'Concluir OS'}</span>
              </button>
            ) : (
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleSendReceipt}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-700/25 active:scale-95 transition-all"
                  title="Enviar Recibo ao Cliente no WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Enviar Recibo WhatsApp</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Envio de Recibo WhatsApp Pós-Conclusão */}
      {showReceiptPrompt && order && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">
                OS #{order.code} Concluída com Sucesso!
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Deseja enviar o comprovante / recibo para o cliente no WhatsApp agora?
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-left space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Cliente &amp; Contato
              </div>
              <div className="text-sm font-bold text-slate-900">
                {order.client?.name || 'Cliente Avulso'}
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{order.client?.phone || 'Sem telefone informado'}</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  handleSendReceipt();
                  setShowReceiptPrompt(false);
                }}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm shadow-lg shadow-emerald-600/30 transition-all min-h-[48px]"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Enviar Recibo no WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handlePrint();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-sm transition-all min-h-[44px]"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Imprimir / Salvar PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowReceiptPrompt(false);
                  onClose();
                }}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Fechar sem enviar agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
