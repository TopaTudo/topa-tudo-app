import React, { useState, useEffect } from 'react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import type { Order, Client, Profile, OrderItem, ServiceCatalogItem } from '@/core/types/database';
import { getLocalDateString, getLocalTimeString, createLocalISOString } from '@/core/utils/date';
import { parseBRLNumber } from '@/core/utils/currency';
import { OrderItemsManager } from './OrderItemsManager';
import { OrderPhotoUpload } from './OrderPhotoUpload';
import {
  X,
  UserPlus,
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  Sparkles,
  Save,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface OrderFormModalProps {
  orderToEdit?: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  orderToEdit,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { profiles, currentProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogItem[]>([]);

  // Form Fields
  const [clientId, setClientId] = useState<string>('');
  const [techId, setTechId] = useState<string>('');
  const [status, setStatus] = useState<Order['status']>('orcamento');
  const [address, setAddress] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [totalPrice, setTotalPrice] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<string>('pix');
  const [warrantyDays, setWarrantyDays] = useState<number>(90);
  const [scheduledAtDate, setScheduledAtDate] = useState<string>('');
  const [scheduledAtTime, setScheduledAtTime] = useState<string>('');
  const [photosBefore, setPhotosBefore] = useState<string[]>([]);
  const [photosAfter, setPhotosAfter] = useState<string[]>([]);
  const [items, setItems] = useState<Array<Omit<OrderItem, 'id' | 'order_id'>>>([]);

  // Quick Client Creation toggle
  const [isQuickClient, setIsQuickClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');

  // Initial load
  useEffect(() => {
    async function loadAuxData() {
      // Load clients
      const { data: cData } = await supabase.from('clients').select('*').order('name');
      if (cData) setClients(cData as Client[]);

      // Load services catalog
      const { data: sData } = await supabase.from('services_catalog').select('*').order('title');
      if (sData) setServicesCatalog(sData as ServiceCatalogItem[]);
    }

    if (isOpen) {
      loadAuxData();
    }
  }, [isOpen]);

  // Populate data when editing
  useEffect(() => {
    if (orderToEdit) {
      setClientId(orderToEdit.client_id || '');
      setTechId(orderToEdit.tech_id || '');
      setStatus(orderToEdit.status);
      setAddress(orderToEdit.address || '');
      setDescription(orderToEdit.description || '');
      setTotalPrice(
        orderToEdit.total_price != null ? String(orderToEdit.total_price) : '0'
      );
      setPaymentMethod(orderToEdit.payment_method || 'pix');
      setWarrantyDays(orderToEdit.warranty_days || 90);
      setPhotosBefore(orderToEdit.photos_before || []);
      setPhotosAfter(orderToEdit.photos_after || []);

      if (orderToEdit.scheduled_at) {
        setScheduledAtDate(getLocalDateString(orderToEdit.scheduled_at));
        setScheduledAtTime(getLocalTimeString(orderToEdit.scheduled_at));
      } else {
        setScheduledAtDate('');
        setScheduledAtTime('');
      }

      // Load existing order items
      supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderToEdit.id)
        .then(({ data }) => {
          if (data) {
            setItems(
              data.map((it) => ({
                material_id: it.material_id,
                name: it.name,
                quantity: Number(it.quantity),
                unit_cost: Number(it.unit_cost),
                source: it.source,
              }))
            );
          }
        });
    } else {
      // Default new order
      setClientId('');
      setTechId(currentProfile?.id || '');
      setStatus('orcamento');
      setAddress('');
      setDescription('');
      setTotalPrice('0');
      setPaymentMethod('pix');
      setWarrantyDays(90);
      setScheduledAtDate(getLocalDateString());
      setScheduledAtTime('09:00');
      setPhotosBefore([]);
      setPhotosAfter([]);
      setItems([]);
      setIsQuickClient(false);
    }
  }, [orderToEdit, currentProfile, isOpen]);

  // When client changes, auto-fill address if empty
  const handleClientSelect = (cId: string) => {
    setClientId(cId);
    const selected = clients.find((c) => c.id === cId);
    if (selected && selected.address && !address) {
      setAddress(selected.address);
    }
  };

  // Quick helper to append service catalog item into description & price
  const handleAddCatalogService = (catalogItem: ServiceCatalogItem) => {
    const updatedDesc = description
      ? `${description}\n• ${catalogItem.title}`
      : `• ${catalogItem.title}`;
    setDescription(updatedDesc);
    setTotalPrice((prev) =>
      (parseBRLNumber(prev) + Number(catalogItem.default_price || 0)).toFixed(2)
    );
  };

  const isConcluded = orderToEdit?.status === 'concluido';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let finalClientId = clientId;

      // 1. Create client if quick registration is enabled
      if (isQuickClient) {
        if (!newClientName.trim()) {
          throw new Error('Informe o nome do cliente.');
        }

        const { data: newClient, error: clientErr } = await supabase
          .from('clients')
          .insert({
            name: newClientName.trim(),
            phone: newClientPhone.trim() || null,
            address: newClientAddress.trim() || address.trim() || null,
          })
          .select()
          .single();

        if (clientErr) throw clientErr;
        finalClientId = newClient.id;
      }

      // Format schedule datetime with local timezone preservation
      let scheduledAt: string | null = null;
      if (scheduledAtDate) {
        scheduledAt = createLocalISOString(scheduledAtDate, scheduledAtTime || '09:00');
      }

      const orderPayload = {
        client_id: finalClientId || null,
        tech_id: techId || null,
        status,
        address: address.trim() || null,
        description: description.trim() || null,
        total_price: parseBRLNumber(totalPrice),
        payment_method: paymentMethod,
        warranty_days: Number(warrantyDays) || 90,
        photos_before: photosBefore,
        photos_after: photosAfter,
        scheduled_at: scheduledAt,
      };

      let savedOrderId = orderToEdit?.id;

      if (orderToEdit) {
        // Update
        const { error: updateErr } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', orderToEdit.id);

        if (updateErr) throw updateErr;

        // Se a OS já estiver concluída, não substitui itens para evitar descompasso de estoque
        if (!isConcluded) {
          await supabase.from('order_items').delete().eq('order_id', orderToEdit.id);
        }
      } else {
        // Insert
        const { data: newOrder, error: insertErr } = await supabase
          .from('orders')
          .insert(orderPayload)
          .select()
          .single();

        if (insertErr) throw insertErr;
        savedOrderId = newOrder.id;
      }

      // Save order items only if not concluded or if creating new
      if (items.length > 0 && savedOrderId && !isConcluded) {
        const itemsToInsert = items.map((it) => ({
          order_id: savedOrderId,
          material_id: it.material_id,
          name: it.name,
          quantity: it.quantity,
          unit_cost: it.unit_cost,
          source: it.source,
        }));

        const { error: itemsErr } = await supabase
          .from('order_items')
          .insert(itemsToInsert);

        if (itemsErr) throw itemsErr;
      }

      success(
        orderToEdit
          ? `OS #${orderToEdit.code} atualizada com sucesso!`
          : 'Ordem de Serviço criada com sucesso!'
      );
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar OS:', err);
      toastError('Erro ao salvar OS', err.message || 'Verifique os campos informados.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold">
              {orderToEdit ? `Editar OS #${orderToEdit.code}` : 'Nova Ordem de Serviço'}
            </h2>
            <p className="text-xs text-blue-200">Preencha os detalhes do serviço técnico</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário de OS"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-industrial-800 text-slate-300 hover:text-white active:scale-95 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Scroll Area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Status & Tech Responsible */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Status da OS *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Order['status'])}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-slate-800 text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
              >
                <option value="orcamento">Orçamento (Pendente)</option>
                <option value="agendado">Agendado</option>
                <option value="em_andamento">Em Andamento (Em Campo)</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Técnico Responsável *
              </label>
              <select
                value={techId}
                onChange={(e) => setTechId(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 font-medium text-slate-800 text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
              >
                <option value="">Selecione o técnico...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role === 'adm' ? 'ADM' : 'Técnico'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Client Selector OR Quick Client Registration */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Cliente da OS *
              </span>
              <button
                type="button"
                onClick={() => setIsQuickClient(!isQuickClient)}
                className="flex items-center gap-1 text-xs font-bold text-industrial-800 hover:text-industrial-600 p-1 rounded-md"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isQuickClient ? 'Selecionar Existente' : '+ Cadastrar Novo'}</span>
              </button>
            </div>

            {!isQuickClient ? (
              <select
                value={clientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
              >
                <option value="">Selecione o cliente cadastrado...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                <input
                  type="text"
                  placeholder="Nome Completo do Cliente *"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  required={isQuickClient}
                  className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="tel"
                    placeholder="WhatsApp / Telefone"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="Endereço (Rua, Número, Bairro)"
                    value={newClientAddress}
                    onChange={(e) => {
                      setNewClientAddress(e.target.value);
                      if (!address) setAddress(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Service Address */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-industrial-800" />
              Endereço de Execução do Serviço
            </label>
            <input
              type="text"
              placeholder="Rua, número, complemento, bairro, cidade..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
            />
          </div>

          {/* Quick Service Catalog Suggestions */}
          {servicesCatalog.length > 0 && (
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amberAlert-500" />
                Catálogo Rápido de Serviços (Toque para adicionar)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {servicesCatalog.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleAddCatalogService(cat)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-industrial-900 active:scale-95 transition-all"
                  >
                    + {cat.title} (R$ {Number(cat.default_price).toFixed(0)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Descrição do Serviço / Diagnóstico *
            </label>
            <textarea
              rows={3}
              placeholder="Detalhe o problema relatado e os procedimentos a executar..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
            />
          </div>

          {/* Schedule Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-industrial-800" />
                Data de Execução
              </label>
              <input
                type="date"
                value={scheduledAtDate}
                onChange={(e) => setScheduledAtDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-industrial-800" />
                Horário Estimado
              </label>
              <input
                type="time"
                value={scheduledAtTime}
                onChange={(e) => setScheduledAtTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Order Items & Stock Deduction */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            {isConcluded && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-900 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Ordem de Serviço já Concluída</p>
                  <p className="mt-0.5 text-amber-800">
                    A baixa dos materiais de estoque e a receita financeira já foram processadas.
                    A alteração de itens de estoque está bloqueada para preservar a integridade contábil.
                  </p>
                </div>
              </div>
            )}
            <OrderItemsManager items={items} onChange={setItems} disabled={isConcluded} />
          </div>

          {/* Financials & Payment */}
          <div className="p-4 rounded-2xl bg-industrial-50 border border-industrial-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-industrial-900 mb-1">
                  Valor Total do Serviço (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(e.target.value)}
                    required
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-industrial-300 bg-white text-base font-bold text-slate-900 focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-industrial-900 mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-industrial-300 bg-white text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                >
                  <option value="pix">PIX Instantâneo</option>
                  <option value="dinheiro">Dinheiro em Espécie</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="boleto">Boleto Bancário</option>
                  <option value="a_combinar">A Combinar / Faturado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-industrial-900 mb-1">
                  Garantia (Dias)
                </label>
                <input
                  type="number"
                  min="0"
                  value={warrantyDays}
                  onChange={(e) => setWarrantyDays(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl border border-industrial-300 bg-white text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Photos Upload: Antes e Depois */}
          <div className="pt-2 border-t border-slate-200 space-y-4">
            <OrderPhotoUpload
              label="Fotos do Local / Equipamento (Antes)"
              photos={photosBefore}
              onChange={setPhotosBefore}
            />

            <OrderPhotoUpload
              label="Fotos do Serviço Finalizado (Depois)"
              photos={photosAfter}
              onChange={setPhotosAfter}
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 min-h-[50px] rounded-xl bg-industrial-800 hover:bg-industrial-700 active:scale-95 text-white font-bold text-sm shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Gravando...' : 'Salvar Ordem de Serviço'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
