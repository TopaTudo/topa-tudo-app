import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import type { Order } from '@/core/types/database';
import { printOrderService } from '@/core/utils/printOS';
import { OrderFormModal } from './OrderFormModal';
import { OrderDetailModal } from './OrderDetailModal';
import {
  Search,
  Plus,
  Filter,
  Navigation,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Clock4,
  Check,
  User,
  RefreshCw,
  SlidersHorizontal,
  Printer,
} from 'lucide-react';

export const OSList: React.FC = () => {
  const { currentProfile, isAdmin } = useAuth();
  const { error: toastError } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [techFilter, setTechFilter] = useState<string>('todos'); // 'todos' | 'minhas'

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients(*),
          tech:profiles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as unknown as Order[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar ordens de serviço:', err);
      toastError('Erro ao carregar ordens', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (statusFilter !== 'todos' && o.status !== statusFilter) {
        return false;
      }

      // Tech filter
      if (techFilter === 'minhas' && currentProfile && o.tech_id !== currentProfile.id) {
        return false;
      }

      // Search filter (code, client name, description, address)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = String(o.code).toLowerCase().includes(q);
        const clientMatch = o.client?.name?.toLowerCase().includes(q) || false;
        const descMatch = o.description?.toLowerCase().includes(q) || false;
        const addrMatch = o.address?.toLowerCase().includes(q) || false;

        return codeMatch || clientMatch || descMatch || addrMatch;
      }

      return true;
    });
  }, [orders, statusFilter, techFilter, searchQuery, currentProfile]);

  const statusConfig: Record<string, { label: string; badgeClass: string }> = {
    orcamento: {
      label: 'Orçamento',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    agendado: {
      label: 'Agendado',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    },
    em_andamento: {
      label: 'Em Andamento',
      badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300 animate-pulse',
    },
    concluido: {
      label: 'Concluído',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    cancelado: {
      label: 'Cancelado',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    },
  };

  // Quick Print from List
  const handleQuickPrint = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    try {
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
      printOrderService(order, (itemsData as any) || []);
    } catch {
      printOrderService(order, []);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-industrial-900 tracking-tight">
            Ordens de Serviço
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerenciamento e execução de serviços de campo
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchOrders}
            aria-label="Atualizar lista de ordens de serviço"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 active:scale-95 transition-all"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setOrderToEdit(null);
              setIsFormOpen(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-industrial-800 hover:bg-industrial-900 active:scale-95 text-white font-bold text-sm shadow-md transition-all min-h-[48px]"
          >
            <Plus className="w-5 h-5 text-amberAlert-500" />
            <span>Nova OS</span>
          </button>
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por código, cliente, endereço ou serviço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
          />
        </div>

        {/* Filters Scrollable Row */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs font-semibold">
          <div className="flex items-center gap-1.5 shrink-0">
            {['todos', 'orcamento', 'agendado', 'em_andamento', 'concluido'].map((st) => {
              const active = statusFilter === st;
              const labels: Record<string, string> = {
                todos: 'Todos',
                orcamento: 'Orçamento',
                agendado: 'Agendado',
                em_andamento: 'Em Campo',
                concluido: 'Concluído',
              };
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                    active
                      ? 'bg-industrial-800 text-white border-industrial-800 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  {labels[st]}
                </button>
              );
            })}
          </div>

          {/* Filter Mine vs All */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setTechFilter('todos')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                techFilter === 'todos'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setTechFilter('minhas')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                techFilter === 'minhas'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Minhas
            </button>
          </div>
        </div>
      </div>

      {/* Orders Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-600">
          <div className="w-10 h-10 border-4 border-industrial-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-semibold text-sm">Carregando ordens de serviço...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-600">
          <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-2" />
          <h3 className="font-bold text-base text-slate-800">Nenhuma OS encontrada</h3>
          <p className="text-xs text-slate-600 mt-1">
            {searchQuery
              ? 'Tente ajustar os termos de pesquisa ou filtros.'
              : 'Clique em "Nova OS" para abrir a primeira ordem de serviço.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredOrders.map((order) => {
            const stBadge = statusConfig[order.status] || statusConfig.orcamento;

            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400/80 p-4 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-[0.99] flex flex-col justify-between gap-3 group"
              >
                {/* Card Top: Code & Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg text-industrial-900">
                      #{order.code}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase border ${stBadge.badgeClass}`}
                    >
                      {stBadge.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => handleQuickPrint(e, order)}
                      aria-label="Imprimir OS / PDF"
                      title={order.payment_method === 'prazo' || order.payment_method === 'a_combinar' ? "Imprimir Duplicata / PDF" : "Imprimir OS / PDF"}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-industrial-900 hover:bg-slate-100 active:scale-95 transition-all"
                    >
                      {order.payment_method === 'prazo' || order.payment_method === 'a_combinar' ? (
                        <span className="text-[10px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded shadow-sm">📄</span>
                      ) : (
                        <Printer className="w-4 h-4" />
                      )}
                    </button>
                    <span className="text-base font-black text-emerald-700">
                      R$ {Number(order.total_price).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Client & Description */}
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-industrial-800 transition-colors">
                    {order.client?.name || 'Cliente Avulso'}
                  </h3>
                  <p className="text-xs text-slate-700 line-clamp-2 mt-1 leading-relaxed">
                    {order.description || 'Sem descrição detalhada.'}
                  </p>
                </div>

                {/* Address & Tech Footer */}
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 text-xs text-slate-600">
                  {(order.address || order.client?.address) && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Navigation className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">
                        {order.address || order.client?.address}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600">
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-medium text-slate-700">
                        {order.tech?.name || 'Não atribuído'}
                      </span>
                    </div>

                    {order.scheduled_at && (
                      <div className="flex items-center gap-1 text-industrial-800 font-semibold">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(order.scheduled_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <OrderDetailModal
        orderId={selectedOrderId}
        isOpen={Boolean(selectedOrderId)}
        onClose={() => setSelectedOrderId(null)}
        onEdit={(ord) => {
          setSelectedOrderId(null);
          setOrderToEdit(ord);
          setIsFormOpen(true);
        }}
        onRefresh={fetchOrders}
      />

      {/* Create / Edit Modal */}
      <OrderFormModal
        orderToEdit={orderToEdit}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setOrderToEdit(null);
        }}
        onSaved={fetchOrders}
      />
    </div>
  );
};
