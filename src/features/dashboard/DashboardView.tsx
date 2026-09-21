import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import { getLocalDateString } from '@/core/utils/date';
import { sanitizeCsvCell } from '@/core/utils/security';
import type { Order, Profile, Transaction } from '@/core/types/database';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Download,
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { profiles, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Month selector (defaults to current month YYYY-MM in local timezone)
  const currentMonthStr = getLocalDateString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: oData, error: oErr }, { data: tData, error: tErr }] = await Promise.all([
        supabase
          .from('orders')
          .select(`
            *,
            client:clients(*),
            tech:profiles(*)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').order('date', { ascending: false }),
      ]);

      if (oErr) throw oErr;
      if (tErr) throw tErr;

      setOrders((oData as unknown as Order[]) || []);
      setTransactions((tData as Transaction[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar dados do dashboard:', err);
      toastError('Erro ao carregar dashboard', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered orders and transactions for the selected month
  const monthOrders = useMemo(() => {
    return orders.filter((o) => {
      const createdMonth = (o.created_at || '').substring(0, 7);
      const completedMonth = o.completed_at ? o.completed_at.substring(0, 7) : null;

      // Se a OS foi concluída: pertence ao mês em que foi concluída (ou criada se sem completed_at)
      if (o.status === 'concluido') {
        return completedMonth === selectedMonth || (!completedMonth && createdMonth === selectedMonth);
      }

      // Se cancelada: apenas se criada no mês selecionado
      if (o.status === 'cancelado') {
        return createdMonth === selectedMonth;
      }

      // Se pendente / em andamento / agendada / orçamento:
      // Deve aparecer se foi criada no mês OU se foi criada antes e continua aberta neste mês
      return createdMonth <= selectedMonth;
    });
  }, [orders, selectedMonth]);

  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => t.date?.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const completedOrders = monthOrders.filter((o) => o.status === 'concluido');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
    const avgTicket = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    const totalExpenses = monthTransactions
      .filter((t) => t.type === 'despesa' && t.status === 'confirmado')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const netProfit = totalRevenue - totalExpenses;

    return {
      totalOrders: monthOrders.length,
      completedOrdersCount: completedOrders.length,
      inProgressCount: monthOrders.filter((o) => o.status === 'em_andamento').length,
      scheduledCount: monthOrders.filter((o) => o.status === 'agendado').length,
      quoteCount: monthOrders.filter((o) => o.status === 'orcamento').length,
      totalRevenue,
      avgTicket,
      totalExpenses,
      netProfit,
    };
  }, [monthOrders, monthTransactions]);

  // Performance per technician
  const techPerformance = useMemo(() => {
    const map: Record<
      string,
      { name: string; completed: number; revenue: number; inProgress: number }
    > = {};

    for (const p of profiles) {
      map[p.id] = { name: p.name, completed: 0, revenue: 0, inProgress: 0 };
    }

    for (const o of monthOrders) {
      if (!o.tech_id || !map[o.tech_id]) continue;
      if (o.status === 'concluido') {
        map[o.tech_id].completed += 1;
        map[o.tech_id].revenue += Number(o.total_price) || 0;
      } else if (o.status === 'em_andamento') {
        map[o.tech_id].inProgress += 1;
      }
    }

    return Object.values(map).filter((item) => item.completed > 0 || item.inProgress > 0);
  }, [profiles, monthOrders]);

  // CSV Export
  const handleExportCSV = () => {
    if (orders.length === 0) {
      toastError('Sem dados', 'Nenhuma ordem de serviço para exportar.');
      return;
    }

    const headers = [
      'Código OS',
      'Status',
      'Cliente',
      'Telefone',
      'Endereço',
      'Técnico',
      'Valor Total (R$)',
      'Forma Pagamento',
      'Garantia (Dias)',
      'Data Agendamento',
      'Data Conclusão',
      'Data Criação',
    ];

    const rows = orders.map((o) => [
      sanitizeCsvCell(`#${o.code}`),
      sanitizeCsvCell(o.status),
      sanitizeCsvCell(o.client?.name || ''),
      sanitizeCsvCell(o.client?.phone || ''),
      sanitizeCsvCell(o.address || o.client?.address || ''),
      sanitizeCsvCell(o.tech?.name || ''),
      sanitizeCsvCell(Number(o.total_price || 0).toFixed(2)),
      sanitizeCsvCell(o.payment_method || ''),
      sanitizeCsvCell(o.warranty_days || 90),
      sanitizeCsvCell(o.scheduled_at || ''),
      sanitizeCsvCell(o.completed_at || ''),
      sanitizeCsvCell(o.created_at),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.map((h) => sanitizeCsvCell(h)).join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_os_topatudo_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    success('Relatório CSV exportado com sucesso!');
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & CSV Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-industrial-900 tracking-tight">
            Dashboard Executivo
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Indicadores de desempenho, faturamento e produtividade da equipe
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month Selector */}
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-800 bg-slate-50 focus:ring-2 focus:ring-industrial-800"
          />

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Revenue */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
            Faturamento Bruto
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-700 block mt-1">
            R$ {kpis.totalRevenue.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {kpis.completedOrdersCount} OSs concluídas
          </span>
        </div>

        {/* Expenses */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
            Despesas do Mês
          </span>
          <span className="text-xl sm:text-2xl font-black text-rose-700 block mt-1">
            R$ {kpis.totalExpenses.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Gastos operacionais</span>
        </div>

        {/* Net Profit */}
        <div className="p-4 rounded-2xl bg-industrial-900 text-white shadow-md">
          <span className="text-[10px] text-blue-300 font-extrabold uppercase tracking-wider block">
            Lucro Operacional
          </span>
          <span
            className={`text-xl sm:text-2xl font-black block mt-1 ${
              kpis.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            R$ {kpis.netProfit.toFixed(2)}
          </span>
          <span className="text-[11px] text-blue-200/80 mt-1 block">Receitas - Despesas</span>
        </div>

        {/* Average Ticket */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
            Ticket Médio
          </span>
          <span className="text-xl sm:text-2xl font-black text-industrial-800 block mt-1">
            R$ {kpis.avgTicket.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Por serviço finalizado</span>
        </div>
      </div>

      {/* Orders Breakdown by Status */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-industrial-800" />
          Status das Ordens de Serviço no Mês ({kpis.totalOrders} total)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-xs text-amber-900 font-bold block">Orçamentos</span>
            <span className="text-lg font-black text-amber-700">{kpis.quoteCount}</span>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <span className="text-xs text-blue-900 font-bold block">Agendados</span>
            <span className="text-lg font-black text-blue-700">{kpis.scheduledCount}</span>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
            <span className="text-xs text-indigo-900 font-bold block">Em Campo</span>
            <span className="text-lg font-black text-indigo-700">{kpis.inProgressCount}</span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-xs text-emerald-900 font-bold block">Concluídos</span>
            <span className="text-lg font-black text-emerald-700">{kpis.completedOrdersCount}</span>
          </div>
        </div>
      </div>

      {/* Technician Productivity Ranking */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-industrial-800" />
          Desempenho por Técnico (Mês Selecionado)
        </h3>

        {techPerformance.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            Nenhuma OS executada pelos técnicos no mês selecionado.
          </p>
        ) : (
          <div className="space-y-2">
            {techPerformance.map((tech, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-industrial-800 text-white font-black text-xs flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{tech.name}</h4>
                    <span className="text-xs text-slate-500">
                      {tech.completed} concluídas • {tech.inProgress} em andamento
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-black text-emerald-700 text-sm block">
                    R$ {tech.revenue.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400">Total faturado</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
