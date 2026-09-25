import React, { useState, useEffect, useMemo } from 'react';
import { supabase, completeWorkOrderRPC } from '@/core/supabase';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import { getLocalDateString, createLocalISOString, formatLocalDateOnly } from '@/core/utils/date';
import { parseBRLNumber } from '@/core/utils/currency';
import type { ScheduleItem, Client, Order } from '@/core/types/database';
import { generateOnTheWayMessage } from '@/core/utils/whatsappReceipt';
import { OrderDetailModal } from '@/features/os/OrderDetailModal';
import { OrderFormModal } from '@/features/os/OrderFormModal';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  MapPin,
  MessageCircle,
  Navigation,
  CheckCircle,
  User,
  UserPlus,
  X,
  Save,
  Search,
  FileText,
  DollarSign,
  ExternalLink,
} from 'lucide-react';

const normalize = (str: string) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const AgendaView: React.FC = () => {
  const { profiles, currentProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [scheduleList, setScheduleList] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());

  // New Schedule Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [techId, setTechId] = useState(currentProfile?.id || '');
  const [date, setDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState('0');
  const [isQuickClient, setIsQuickClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // OS Modals integration state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [processingScheduleId, setProcessingScheduleId] = useState<string | null>(null);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedule')
        .select(`
          *,
          client:clients(*),
          tech:profiles(*),
          order:orders(*, client:clients(*), tech:profiles(*))
        `)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setScheduleList((data as unknown as ScheduleItem[]) || []);
    } catch (err: any) {
      console.error('Erro ao carregar agenda:', err);
      toastError('Erro ao buscar agenda', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
    supabase
      .from('clients')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setClients(data as Client[]);
      });
  }, []);

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    const term = normalize(searchTerm);
    return clients.filter(
      (c) =>
        normalize(c.name).includes(term) ||
        (c.phone && normalize(c.phone).includes(term)) ||
        (c.address && normalize(c.address).includes(term)) ||
        (c.notes && normalize(c.notes).includes(term))
    );
  }, [clients, searchTerm]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId]
  );

  const handleClientSelect = (cId: string) => {
    setClientId(cId);
    const selected = clients.find((c) => c.id === cId);
    if (selected && selected.address && !address) {
      setAddress(selected.address);
    }
    setSearchTerm('');
  };

  // Concluir agendamento e sincronizar com OS
  const handleFinalizeSchedule = async (item: ScheduleItem) => {
    setProcessingScheduleId(item.id);
    try {
      if (item.order_id) {
        // Concluir via RPC complete_work_order (dá baixa no estoque, lança receita e sincroniza a agenda)
        const res = await completeWorkOrderRPC(item.order_id);
        if (res.success) {
          success(
            'Atendimento finalizado com sucesso!',
            `OS #${item.order?.code || ''} concluída com baixa de estoque e lançamento financeiro.`
          );
        }
      } else {
        const { error } = await supabase
          .from('schedule')
          .update({ status: 'concluido' })
          .eq('id', item.id);
        if (error) throw error;
        success('Agendamento marcado como concluído!');
      }
      fetchSchedule();
    } catch (err: any) {
      console.error('Erro ao finalizar agendamento:', err);
      toastError('Erro ao finalizar', err.message);
    } finally {
      setProcessingScheduleId(null);
    }
  };

  const handleReopenSchedule = async (item: ScheduleItem) => {
    setProcessingScheduleId(item.id);
    try {
      const { error: sErr } = await supabase
        .from('schedule')
        .update({ status: 'agendado' })
        .eq('id', item.id);
      if (sErr) throw sErr;

      if (item.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'agendado' })
          .eq('id', item.order_id);
      }

      success('Agendamento reaberto como "agendado".');
      fetchSchedule();
    } catch (err: any) {
      toastError('Erro ao reabrir', err.message);
    } finally {
      setProcessingScheduleId(null);
    }
  };

  // Emitir OS para agendamento legado que ainda não possui vínculo
  const handleEmitOSForSchedule = async (item: ScheduleItem) => {
    setProcessingScheduleId(item.id);
    try {
      const orderPayload = {
        client_id: item.client_id,
        tech_id: item.tech_id || null,
        status: item.status === 'concluido' ? 'concluido' : 'agendado',
        address: item.client?.address || null,
        description: item.description || 'Visita técnica agendada',
        total_price: 0,
        payment_method: 'pix',
        warranty_days: 90,
        scheduled_at: createLocalISOString(item.date, item.start_time || '09:00'),
      };

      const { data: newOrder, error: oErr } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();
      if (oErr) throw oErr;

      const { error: sErr } = await supabase
        .from('schedule')
        .update({ order_id: newOrder.id })
        .eq('id', item.id);
      if (sErr) throw sErr;

      success(`OS #${newOrder.code} emitida e vinculada ao agendamento!`);
      fetchSchedule();
    } catch (err: any) {
      toastError('Erro ao emitir OS vinculada', err.message);
    } finally {
      setProcessingScheduleId(null);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalClientId = clientId;
      let finalAddress = address.trim();

      if (isQuickClient) {
        if (!newClientName.trim()) throw new Error('Informe o nome do cliente.');
        const { data: newC, error: cErr } = await supabase
          .from('clients')
          .insert({
            name: newClientName.trim(),
            phone: newClientPhone.trim() || null,
            address: newClientAddress.trim() || null,
          })
          .select()
          .single();

        if (cErr) throw cErr;
        finalClientId = newC.id;
        if (!finalAddress) finalAddress = newClientAddress.trim();
      }

      if (!finalClientId) throw new Error('Selecione ou cadastre um cliente.');

      // 1. Emitir automaticamente a Ordem de Serviço vinculada (status = 'agendado')
      const orderPayload = {
        client_id: finalClientId,
        tech_id: techId || null,
        status: 'agendado' as const,
        address: finalAddress || null,
        description: description.trim() || 'Visita técnica agendada',
        total_price: parseBRLNumber(estimatedPrice),
        payment_method: 'pix' as const,
        warranty_days: 90,
        scheduled_at: createLocalISOString(date, startTime || '09:00'),
      };

      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Gravar o agendamento associado à OS emitida (com order_id)
      const { error: schedErr } = await supabase.from('schedule').insert({
        date,
        start_time: startTime || null,
        end_time: endTime || null,
        client_id: finalClientId,
        tech_id: techId || null,
        description: description.trim() || 'Visita técnica agendada',
        status: 'agendado',
        order_id: newOrder.id,
      });

      if (schedErr) throw schedErr;

      success(
        'Agendamento e OS emitidos com sucesso!',
        `Ordem de Serviço #${newOrder.code} gerada e vinculada à visita técnica.`
      );

      setIsModalOpen(false);
      setDescription('');
      setAddress('');
      setEstimatedPrice('0');
      setIsQuickClient(false);
      setNewClientName('');
      setNewClientPhone('');
      setNewClientAddress('');
      setSearchTerm('');
      fetchSchedule();
    } catch (err: any) {
      console.error('Erro ao agendar e emitir OS:', err);
      toastError('Erro ao agendar', err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filter items for selected date vs all
  const filteredSchedule = scheduleList.filter((item) => item.date === selectedDate);

  const openWhatsApp = (
    phone?: string | null,
    clientName?: string | null,
    techName?: string | null,
    desc?: string | null
  ) => {
    if (!phone) {
      toastError('Sem telefone', 'Cliente não possui telefone cadastrado.');
      return;
    }
    const clean = phone.replace(/\D/g, '');
    const num = clean.length <= 11 ? `55${clean}` : clean;
    const client = clientName || 'Cliente';
    const tech = techName || currentProfile?.name || 'técnico';
    const msg = encodeURIComponent(
      generateOnTheWayMessage(client, tech, null, desc)
    );
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const openMaps = (clientAddress?: string | null) => {
    if (!clientAddress) {
      toastError('Sem endereço', 'Endereço do cliente não informado.');
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientAddress)}`,
      '_blank'
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-industrial-900 tracking-tight">
            Agenda de Atendimentos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Visitas técnicas sincronizadas automaticamente com a emissão de Ordens de Serviço
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setDate(selectedDate);
            setTechId(currentProfile?.id || '');
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-industrial-800 hover:bg-industrial-900 active:scale-95 text-white font-bold text-sm shadow-md transition-all min-h-[48px]"
        >
          <Plus className="w-5 h-5 text-amberAlert-500" />
          <span>Novo Agendamento + OS</span>
        </button>
      </div>

      {/* Date Navigation Strip */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-industrial-800 shrink-0" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-sm text-slate-800 focus:ring-2 focus:ring-industrial-800"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedDate(getLocalDateString())}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-industrial-50 text-industrial-900 border border-industrial-200 hover:bg-industrial-100"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              setSelectedDate(getLocalDateString(tomorrow));
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            Amanhã
          </button>
        </div>
      </div>

      {/* List of Visits */}
      {loading ? (
        <div className="p-12 text-center text-slate-600">
          <div className="w-10 h-10 border-4 border-industrial-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-semibold text-sm">Carregando horários e ordens de serviço...</p>
        </div>
      ) : filteredSchedule.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-600">
          <CalendarIcon className="w-10 h-10 text-slate-500 mx-auto mb-2" />
          <h3 className="font-bold text-base text-slate-800">Nenhum atendimento neste dia</h3>
          <p className="text-xs text-slate-600 mt-1">
            Selecione outra data ou adicione uma nova visita com emissão automática de OS.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSchedule.map((item) => {
            const hasOrder = Boolean(item.order_id && item.order);
            const orderCode = item.order ? `#${String(item.order.code).padStart(5, '0')}` : null;
            const isProcessing = processingScheduleId === item.id;
            const visitAddress = item.order?.address || item.client?.address;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 hover:border-slate-300 transition-all"
              >
                {/* Left Column: Time & Client */}
                <div className="flex items-start gap-3.5 flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-industrial-900 text-white flex flex-col items-center justify-center shrink-0 shadow-inner">
                    <Clock className="w-4 h-4 text-amberAlert-500 mb-0.5" />
                    <span className="text-xs font-black leading-none">
                      {item.start_time || '--:--'}
                    </span>
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-slate-900">
                        {item.client?.name || 'Cliente'}
                      </h3>

                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                          item.status === 'concluido'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'em_andamento'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>

                      {/* OS Badge Vinculada */}
                      {hasOrder ? (
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(item.order_id!)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-industrial-900 hover:bg-industrial-800 text-amberAlert-500 font-black text-[11px] shadow-2xs transition-all active:scale-95"
                          title="Clique para abrir detalhes da OS"
                        >
                          <FileText className="w-3 h-3" />
                          <span>OS {orderCode}</span>
                          <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-80" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEmitOSForSchedule(item)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-[10px] uppercase transition-all"
                          title="Emitir OS para este agendamento"
                        >
                          + Emitir OS
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">
                      {item.description || 'Visita técnica'}
                    </p>

                    {visitAddress && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="truncate">{visitAddress}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-600 pt-0.5 flex-wrap">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>Técnico: {item.tech?.name || 'Não atribuído'}</span>
                      </div>
                      {item.order?.total_price != null && Number(item.order.total_price) > 0 && (
                        <div className="flex items-center gap-1 text-emerald-700 font-black">
                          <DollarSign className="w-3 h-3" />
                          <span>R$ {Number(item.order.total_price).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: 1-Touch Actions */}
                <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      openWhatsApp(
                        item.client?.phone,
                        item.client?.name,
                        item.tech?.name,
                        item.description
                      )
                    }
                    className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 flex items-center justify-center gap-1.5 text-xs font-bold transition-all min-h-[40px]"
                    title="Avisar a caminho no WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openMaps(visitAddress)}
                    className="p-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 flex items-center justify-center gap-1.5 text-xs font-bold transition-all min-h-[40px]"
                    title="Rotas GPS"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>GPS</span>
                  </button>

                  {hasOrder && (
                    <button
                      type="button"
                      onClick={() => setSelectedOrderId(item.order_id!)}
                      className="p-2.5 rounded-xl bg-industrial-50 text-industrial-900 hover:bg-industrial-100 active:scale-95 flex items-center justify-center gap-1.5 text-xs font-bold transition-all min-h-[40px]"
                      title="Ver e Gerenciar OS"
                    >
                      <FileText className="w-4 h-4 text-industrial-800" />
                      <span>Ver OS</span>
                    </button>
                  )}

                  {item.status !== 'concluido' ? (
                    <button
                      type="button"
                      onClick={() => handleFinalizeSchedule(item)}
                      disabled={isProcessing}
                      className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center gap-1.5 text-xs font-bold shadow-xs transition-all disabled:opacity-50 min-h-[40px]"
                      title="Finalizar atendimento e concluir OS"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{isProcessing ? 'Finalizando...' : 'Concluir'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleReopenSchedule(item)}
                      disabled={isProcessing}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold active:scale-95 transition-all disabled:opacity-50 min-h-[40px]"
                      title="Reabrir agendamento"
                    >
                      Reabrir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Novo Agendamento</h2>
                <p className="text-xs text-blue-200">
                  Emite automaticamente uma Ordem de Serviço vinculada
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fechar agendamento"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-industrial-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Client Selection */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-slate-700">Cliente *</label>
                  <button
                    type="button"
                    onClick={() => setIsQuickClient(!isQuickClient)}
                    className="text-xs font-bold text-industrial-800 flex items-center gap-1 p-1 rounded-md"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{isQuickClient ? 'Selecionar Existente' : '+ Cadastrar Novo'}</span>
                  </button>
                </div>

                {isQuickClient ? (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                    <input
                      type="text"
                      placeholder="Nome do cliente *"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-blue-300 text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="tel"
                        placeholder="WhatsApp / Telefone"
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                      />
                      <input
                        type="text"
                        placeholder="Endereço completo"
                        value={newClientAddress}
                        onChange={(e) => {
                          setNewClientAddress(e.target.value);
                          if (!address) setAddress(e.target.value);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                      />
                    </div>
                  </div>
                ) : selectedClient ? (
                  <div className="p-3 rounded-xl bg-white border border-green-500 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{selectedClient.name}</p>
                      <p className="text-xs text-slate-600">
                        {selectedClient.phone || 'Sem telefone'} •{' '}
                        {selectedClient.address || 'Sem endereço'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClientId('')}
                      className="p-2 hover:bg-slate-100 rounded-lg"
                      title="Alterar cliente"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ) : (
                  <div className="relative space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Pesquisar cliente por nome, telefone ou endereço..."
                        className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-2.5"
                        >
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      )}
                    </div>
                    {searchTerm ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {filteredClients.length > 0 ? (
                          filteredClients.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => handleClientSelect(c.id)}
                              className="w-full text-left p-2 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200"
                            >
                              <p className="font-semibold text-sm text-slate-900">{c.name}</p>
                              <p className="text-xs text-slate-600">
                                {c.phone || 'Sem telefone'} • {c.address || 'Sem endereço'}
                              </p>
                            </button>
                          ))
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setIsQuickClient(true);
                              setNewClientName(searchTerm);
                              setSearchTerm('');
                            }}
                            className="w-full text-left p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold"
                          >
                            Nenhum cliente para &apos;{searchTerm}&apos;.{' '}
                            <span className="underline">+ Cadastrar novo?</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <select
                        value={clientId}
                        onChange={(e) => handleClientSelect(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                      >
                        <option value="">Ou selecione da lista...</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Service Address */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-industrial-800" />
                  Endereço do Atendimento
                </label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro, cidade..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Data *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Horário Início
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Horário Término
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Tech Responsible & Estimated Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Técnico Responsável
                  </label>
                  <select
                    value={techId}
                    onChange={(e) => setTechId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                  >
                    <option value="">Selecione o técnico...</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.role === 'adm' ? 'ADM' : 'Técnico'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Motivo / Procedimentos a Executar *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ex: Instalação de chuveiro elétrico e manutenção de disjuntor"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
                />
              </div>

              {/* Synchronization Banner */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2 text-xs text-blue-900 font-medium">
                <FileText className="w-4 h-4 text-blue-700 shrink-0" />
                <span>
                  Uma <strong>Ordem de Serviço (OS)</strong> será emitida e vinculada automaticamente a esta visita.
                </span>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Gravando e Emitindo OS...' : 'Salvar e Emitir OS'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Linked Order Detail Modal */}
      <OrderDetailModal
        orderId={selectedOrderId}
        isOpen={Boolean(selectedOrderId)}
        onClose={() => setSelectedOrderId(null)}
        onEdit={(ord) => {
          setSelectedOrderId(null);
          setOrderToEdit(ord);
          setIsOrderFormOpen(true);
        }}
        onRefresh={fetchSchedule}
      />

      {/* Linked Order Edit Modal */}
      <OrderFormModal
        orderToEdit={orderToEdit}
        isOpen={isOrderFormOpen}
        onClose={() => {
          setIsOrderFormOpen(false);
          setOrderToEdit(null);
        }}
        onSaved={fetchSchedule}
      />
    </div>
  );
};
