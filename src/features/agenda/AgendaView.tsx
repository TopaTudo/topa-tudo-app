import React, { useState, useEffect } from 'react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import type { ScheduleItem, Client, Profile } from '@/core/types/database';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  MapPin,
  Phone,
  MessageCircle,
  Navigation,
  CheckCircle,
  XCircle,
  User,
  AlertCircle,
  UserPlus,
  X,
  Save,
} from 'lucide-react';

export const AgendaView: React.FC = () => {
  const { profiles, currentProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [scheduleList, setScheduleList] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  // New Schedule Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [techId, setTechId] = useState(currentProfile?.id || '');
  const [date, setDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [description, setDescription] = useState('');
  const [isQuickClient, setIsQuickClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedule')
        .select(`
          *,
          client:clients(*),
          tech:profiles(*)
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
    // Load clients for selector
    supabase
      .from('clients')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setClients(data as Client[]);
      });
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('schedule')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      success(`Status atualizado para "${newStatus}"`);
      fetchSchedule();
    } catch (err: any) {
      toastError('Erro ao atualizar status', err.message);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalClientId = clientId;

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
      }

      if (!finalClientId) throw new Error('Selecione ou cadastre um cliente.');

      const { error } = await supabase.from('schedule').insert({
        date,
        start_time: startTime || null,
        end_time: endTime || null,
        client_id: finalClientId,
        tech_id: techId || null,
        description: description.trim() || null,
        status: 'agendado',
      });

      if (error) throw error;

      success('Compromisso agendado com sucesso!');
      setIsModalOpen(false);
      // Reset
      setDescription('');
      setIsQuickClient(false);
      fetchSchedule();
    } catch (err: any) {
      toastError('Erro ao agendar', err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filter items for selected date vs all
  const filteredSchedule = scheduleList.filter((item) => item.date === selectedDate);

  const openWhatsApp = (phone?: string | null, clientName?: string) => {
    if (!phone) {
      toastError('Sem telefone', 'Cliente não possui telefone cadastrado.');
      return;
    }
    const clean = phone.replace(/\D/g, '');
    const num = clean.length <= 11 ? `55${clean}` : clean;
    const msg = encodeURIComponent(
      `Olá ${clientName || 'Cliente'}, confirmando nosso atendimento técnico agendado da Topa Tudo!`
    );
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const openMaps = (address?: string | null) => {
    if (!address) {
      toastError('Sem endereço', 'Endereço do cliente não informado.');
      return;
    }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
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
            Visitas técnicas, instalações e manutenções programadas
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setDate(selectedDate);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-industrial-800 hover:bg-industrial-900 active:scale-95 text-white font-bold text-sm shadow-md transition-all min-h-[48px]"
        >
          <Plus className="w-5 h-5 text-amberAlert-500" />
          <span>Novo Agendamento</span>
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
            onClick={() => setSelectedDate(new Date().toISOString().substring(0, 10))}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-industrial-50 text-industrial-900 border border-industrial-200 hover:bg-industrial-100"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              setSelectedDate(tomorrow.toISOString().substring(0, 10));
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            Amanhã
          </button>
        </div>
      </div>

      {/* List of Visits */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-10 h-10 border-4 border-industrial-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-semibold text-sm">Carregando horários...</p>
        </div>
      ) : filteredSchedule.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          <CalendarIcon className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="font-bold text-base text-slate-700">Nenhum atendimento neste dia</h3>
          <p className="text-xs text-slate-400 mt-1">
            Selecione outra data ou adicione uma nova visita técnica.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSchedule.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {/* Left Column: Time & Client */}
              <div className="flex items-start gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-industrial-900 text-white flex flex-col items-center justify-center shrink-0 shadow-inner">
                  <Clock className="w-4 h-4 text-amberAlert-500 mb-0.5" />
                  <span className="text-xs font-black leading-none">{item.start_time || '--:--'}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900">
                      {item.client?.name || 'Cliente'}
                    </h3>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        item.status === 'concluido'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'em_andamento'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-0.5">
                    {item.description || 'Visita técnica'}
                  </p>

                  {item.client?.address && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="truncate">{item.client.address}</span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>Técnico: {item.tech?.name || 'Não atribuído'}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: 1-Touch Actions */}
              <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <button
                  type="button"
                  onClick={() => openWhatsApp(item.client?.phone, item.client?.name)}
                  className="flex-1 sm:flex-initial p-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 flex items-center justify-center gap-1.5 text-xs font-bold transition-all"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="sm:hidden">WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => openMaps(item.client?.address)}
                  className="flex-1 sm:flex-initial p-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 flex items-center justify-center gap-1.5 text-xs font-bold transition-all"
                  title="GPS"
                >
                  <Navigation className="w-4 h-4" />
                  <span className="sm:hidden">GPS</span>
                </button>

                {item.status !== 'concluido' ? (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(item.id, 'concluido')}
                    className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 flex items-center gap-1 text-xs font-bold shadow-xs"
                    title="Marcar como Concluído"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Finalizar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(item.id, 'agendado')}
                    className="p-2.5 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs font-bold"
                    title="Reabrir agendamento"
                  >
                    Reabrir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">Novo Agendamento</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {/* Client Selection */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-slate-700">Cliente *</label>
                  <button
                    type="button"
                    onClick={() => setIsQuickClient(!isQuickClient)}
                    className="text-xs font-bold text-industrial-800 flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{isQuickClient ? 'Existente' : '+ Novo'}</span>
                  </button>
                </div>

                {!isQuickClient ? (
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="">Selecione o cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nome do cliente *"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-blue-300 text-sm"
                    />
                    <input
                      type="tel"
                      placeholder="WhatsApp"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Endereço completo"
                      value={newClientAddress}
                      onChange={(e) => setNewClientAddress(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                  </div>
                )}
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Início
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Término
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              {/* Tech Responsible */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Técnico Responsável
                </label>
                <select
                  value={techId}
                  onChange={(e) => setTechId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                >
                  <option value="">Selecione o técnico...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Motivo / Observações
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Instalação de chuveiro elétrico e verificação de disjuntor"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
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
                  className="px-5 py-2.5 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Gravando...' : 'Salvar Compromisso'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
