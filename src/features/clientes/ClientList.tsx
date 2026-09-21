import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/core/supabase';
import { useToast } from '@/core/context/ToastContext';
import type { Client, Order } from '@/core/types/database';
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageCircle,
  MapPin,
  ClipboardList,
  DollarSign,
  Edit2,
  X,
  Save,
  Trash2,
  Calendar,
} from 'lucide-react';

export const ClientList: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected client for history drawer
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Modal create/edit client
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: cData, error: cErr }, { data: oData, error: oErr }] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
      ]);

      if (cErr) throw cErr;
      if (oErr) throw oErr;

      setClients(cData || []);
      setOrders(oData || []);
    } catch (err: any) {
      console.error('Erro ao buscar clientes:', err);
      toastError('Erro ao buscar dados', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate LTV and OS count per client
  const clientStats = useMemo(() => {
    const stats: Record<string, { ltv: number; count: number; completedCount: number }> = {};
    for (const ord of orders) {
      if (!ord.client_id) continue;
      if (!stats[ord.client_id]) {
        stats[ord.client_id] = { ltv: 0, count: 0, completedCount: 0 };
      }
      stats[ord.client_id].count += 1;
      if (ord.status === 'concluido') {
        stats[ord.client_id].ltv += Number(ord.total_price) || 0;
        stats[ord.client_id].completedCount += 1;
      }
    }
    return stats;
  }, [orders]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

  const handleOpenCreate = () => {
    setEditingClient(null);
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Client) => {
    setEditingClient(c);
    setName(c.name);
    setPhone(c.phone || '');
    setAddress(c.address || '');
    setNotes(c.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update({
            name: name.trim(),
            phone: phone.trim() || null,
            address: address.trim() || null,
            notes: notes.trim() || null,
          })
          .eq('id', editingClient.id);

        if (error) throw error;
        success('Cliente atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('clients').insert({
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
        });

        if (error) throw error;
        success('Cliente cadastrado com sucesso!');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toastError('Erro ao salvar cliente', err.message);
    } finally {
      setSaving(false);
    }
  };

  const openWhatsApp = (clientPhone: string, clientName: string) => {
    const clean = clientPhone.replace(/\D/g, '');
    const num = clean.length <= 11 ? `55${clean}` : clean;
    const msg = encodeURIComponent(
      `Olá ${clientName}, tudo bem? Aqui é da Topa Tudo Manutenção & Serviços!`
    );
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  // Orders for selected client
  const clientOrders = useMemo(() => {
    if (!selectedClient) return [];
    return orders.filter((o) => o.client_id === selectedClient.id);
  }, [selectedClient, orders]);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-industrial-900 tracking-tight">
            Clientes & CRM
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Base de clientes, histórico de serviços e faturamento por cliente (LTV)
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-industrial-800 hover:bg-industrial-900 active:scale-95 text-white font-bold text-sm shadow-md transition-all min-h-[48px]"
        >
          <Plus className="w-5 h-5 text-amberAlert-500" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou endereço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Clients Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-10 h-10 border-4 border-industrial-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-semibold text-sm">Carregando base de clientes...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="font-bold text-base text-slate-700">Nenhum cliente cadastrado</h3>
          <p className="text-xs text-slate-400 mt-1">Toque em "Novo Cliente" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredClients.map((client) => {
            const stats = clientStats[client.id] || { ltv: 0, count: 0, completedCount: 0 };

            return (
              <div
                key={client.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 leading-tight">
                        {client.name}
                      </h3>
                      {client.address && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="truncate">{client.address}</span>
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(client)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-industrial-800 hover:bg-slate-100"
                      title="Editar cadastro"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* LTV & Metrics strip */}
                  <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Faturamento LTV
                      </span>
                      <span className="font-black text-emerald-700 text-sm">
                        R$ {stats.ltv.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Total de OSs
                      </span>
                      <span className="font-bold text-slate-800 text-sm">
                        {stats.count} ({stats.completedCount} concl.)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions: WhatsApp, Tel, History */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  {client.phone ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openWhatsApp(client.phone!, client.name)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>WhatsApp</span>
                      </button>

                      <a
                        href={`tel:${client.phone}`}
                        className="py-2 px-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        title="Ligar"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Sem telefone cadastrado</span>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedClient(client)}
                    className="py-2 px-3 rounded-xl bg-industrial-50 text-industrial-900 hover:bg-industrial-100 active:scale-95 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>Histórico</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History Drawer / Modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">{selectedClient.name}</h2>
                <p className="text-xs text-blue-200">Histórico de Ordens de Serviço</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="p-1 rounded-lg text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-3">
              {clientOrders.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Nenhuma ordem de serviço registrada para este cliente.
                </p>
              ) : (
                clientOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-industrial-900">
                          OS #{ord.code}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          {ord.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                        {ord.description || 'Serviço'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-sm text-emerald-700 block">
                        R$ {Number(ord.total_price).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ord.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Client Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  WhatsApp / Telefone
                </label>
                <input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Endereço Completo
                </label>
                <input
                  type="text"
                  placeholder="Rua, número, complemento, bairro"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Observações Internas
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferências, portão de entrada, etc."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800"
                />
              </div>

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
                  <span>{saving ? 'Gravando...' : 'Salvar Cliente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
