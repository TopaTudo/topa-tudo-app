import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import { parseBRLNumber, formatBRL } from '@/core/utils/currency';
import { getLocalDateString } from '@/core/utils/date';
import type { Transaction } from '@/core/types/database';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  Calendar,
  X,
  Save,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldAlert,
} from 'lucide-react';

export const FinancialView: React.FC = () => {
  const { isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'confirmado' | 'pendente'>('todos');

  // Modal new transaction
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [type, setType] = useState<'receita' | 'despesa'>('despesa');
  const [amount, setAmount] = useState<string>('0');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'confirmado' | 'pendente'>('confirmado');
  const [date, setDate] = useState(getLocalDateString());
  const [saving, setSaving] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions((data as Transaction[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar transações:', err);
      toastError('Erro ao carregar transações', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== 'todos' && t.type !== typeFilter) return false;
      if (statusFilter !== 'todos' && t.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = t.description.toLowerCase().includes(q);
        const catMatch = t.category?.toLowerCase().includes(q) || false;
        return descMatch || catMatch;
      }

      return true;
    });
  }, [transactions, typeFilter, statusFilter, searchQuery]);

  // Financial summary metrics
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let pending = 0;

    for (const t of transactions) {
      const val = Number(t.amount) || 0;
      if (t.status === 'confirmado') {
        if (t.type === 'receita') income += val;
        else expense += val;
      } else {
        pending += val;
      }
    }

    return {
      income,
      expense,
      net: income - expense,
      pending,
    };
  }, [transactions]);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseBRLNumber(amount);
    if (!description.trim() || parsedAmount <= 0) return;
    setSaving(true);

    try {
      const { error } = await supabase.from('transactions').insert({
        type,
        amount: parsedAmount,
        description: description.trim(),
        category: category.trim() || (type === 'receita' ? 'Serviço' : 'Geral'),
        status,
        date: date || getLocalDateString(),
      });

      if (error) throw error;

      success(
        `Lançamento de ${type === 'receita' ? 'Receita' : 'Despesa'} registrado!`,
        `R$ ${parsedAmount.toFixed(2)} - ${description}`
      );
      setIsModalOpen(false);
      // Reset
      setDescription('');
      setAmount('0');
      setCategory('');
      fetchTransactions();
    } catch (err: any) {
      toastError('Erro ao gravar lançamento', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (tx: Transaction) => {
    const nextStatus = tx.status === 'confirmado' ? 'pendente' : 'confirmado';
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: nextStatus })
        .eq('id', tx.id);

      if (error) throw error;
      success(`Status alterado para "${nextStatus}"`);
      fetchTransactions();
    } catch (err: any) {
      toastError('Erro ao atualizar status', err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 bg-white rounded-3xl border border-slate-200 text-center min-h-[400px] shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-industrial-900 mb-2">
          Acesso Restrito ao Financeiro
        </h2>
        <p className="text-sm text-slate-500 max-w-md">
          O módulo de gestão financeira e fluxo de caixa é exclusivo para administradores da Topa Tudo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-industrial-900 tracking-tight">
            Fluxo de Caixa & Finanças
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Receitas de ordens de serviço, despesas operacionais e saldo líquido
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setType('despesa');
            setAmount('0');
            setDescription('');
            setCategory('');
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-industrial-800 hover:bg-industrial-900 active:scale-95 text-white font-bold text-sm shadow-md transition-all min-h-[48px]"
        >
          <Plus className="w-5 h-5 text-amberAlert-500" />
          <span>Novo Lançamento</span>
        </button>
      </div>

      {/* KPI Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Income Card */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase block">
              Receitas Confirmadas
            </span>
            <span className="text-xl font-black text-emerald-700 leading-tight">
              R$ {totals.income.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Expense Card */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase block">
              Despesas Realizadas
            </span>
            <span className="text-xl font-black text-rose-700 leading-tight">
              R$ {totals.expense.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Net Balance Card */}
        <div className="p-4 rounded-2xl bg-industrial-900 text-white shadow-md flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-industrial-800 border border-industrial-700 text-amberAlert-500 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-blue-200 font-bold uppercase block">
              Saldo Líquido
            </span>
            <span
              className={`text-xl font-black leading-tight ${
                totals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              R$ {totals.net.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por descrição ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-industrial-800"
          />
        </div>

        <div className="flex items-center justify-between gap-2 overflow-x-auto text-xs font-semibold pb-1">
          {/* Type */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setTypeFilter('todos')}
              className={`px-3 py-1.5 rounded-xl border ${
                typeFilter === 'todos'
                  ? 'bg-industrial-800 text-white border-industrial-800'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('receita')}
              className={`px-3 py-1.5 rounded-xl border ${
                typeFilter === 'receita'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              Receitas
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('despesa')}
              className={`px-3 py-1.5 rounded-xl border ${
                typeFilter === 'despesa'
                  ? 'bg-rose-700 text-white border-rose-700'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              Despesas
            </button>
          </div>

          {/* Status */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('todos')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                statusFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('confirmado')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                statusFilter === 'confirmado'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Confirmados
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pendente')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                statusFilter === 'pendente'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Pendentes
            </button>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-10 h-10 border-4 border-industrial-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-semibold text-sm">Carregando movimentações financeiras...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          <DollarSign className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="font-bold text-base text-slate-700">Nenhum lançamento encontrado</h3>
          <p className="text-xs text-slate-400 mt-1">
            As ordens de serviço concluídas geram lançamentos automáticos de receita.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => {
            const isIncome = item.type === 'receita';
            const isConfirmed = item.status === 'confirmado';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isIncome
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownLeft className="w-5 h-5" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900 leading-tight">
                      {item.description}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                      {item.category && (
                        <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {item.category}
                        </span>
                      )}
                      <span>
                        {item.date
                          ? new Date(item.date + 'T00:00:00').toLocaleDateString('pt-BR')
                          : ''}
                      </span>
                      {item.order_id && (
                        <span className="text-industrial-800 font-semibold">• Vinculado à OS</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right flex items-center gap-3">
                  <div>
                    <span
                      className={`text-base font-black block leading-tight ${
                        isIncome ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isIncome ? '+' : '-'} R$ {Number(item.amount).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(item)}
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                        isConfirmed
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal New Transaction */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">Novo Lançamento Financeiro</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="p-4 sm:p-6 space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100">
                <button
                  type="button"
                  onClick={() => setType('receita')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    type === 'receita'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Receita (Entrada de Dinheiro)
                </button>
                <button
                  type="button"
                  onClick={() => setType('despesa')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    type === 'despesa'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Despesa (Gasto / Custo)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Valor (R$) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-lg font-black text-slate-900 focus:ring-2 focus:ring-industrial-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Descrição do Lançamento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Abastecimento Fiorino ou Compra de Fita Isolante"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Combustível, Peças, Alimentação..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="confirmado">Confirmado / Pago</option>
                  <option value="pendente">Pendente / A Pagar</option>
                </select>
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
                  <span>{saving ? 'Gravando...' : 'Salvar Lançamento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
