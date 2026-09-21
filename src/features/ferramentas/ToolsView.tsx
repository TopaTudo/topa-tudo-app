import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import type { Tool, Profile } from '@/core/types/database';
import {
  Hammer,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  UserCheck,
  RotateCcw,
  Send,
  X,
  Save,
  Edit2,
} from 'lucide-react';

export const ToolsView: React.FC = () => {
  const { profiles, currentProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Modal Loan/Return
  const [loanTool, setLoanTool] = useState<Tool | null>(null);
  const [targetTechId, setTargetTechId] = useState<string>('');

  // Modal Tool Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Tool['status']>('disponivel');
  const [saving, setSaving] = useState(false);

  const fetchTools = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tools')
        .select(`
          *,
          assigned_tech:profiles(*)
        `)
        .order('name');

      if (error) throw error;
      setTools((data as unknown as Tool[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar ferramentas:', err);
      toastError('Erro ao carregar ferramentas', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      if (statusFilter !== 'todos' && tool.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = tool.name.toLowerCase().includes(q);
        const codeMatch = tool.code?.toLowerCase().includes(q) || false;
        const catMatch = tool.category?.toLowerCase().includes(q) || false;
        const techMatch = tool.assigned_tech?.name?.toLowerCase().includes(q) || false;
        return nameMatch || codeMatch || catMatch || techMatch;
      }

      return true;
    });
  }, [tools, statusFilter, searchQuery]);

  // Action: Return tool to base/inventory
  const handleReturnTool = async (tool: Tool) => {
    try {
      const { error } = await supabase
        .from('tools')
        .update({
          status: 'disponivel',
          assigned_to_tech_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tool.id);

      if (error) throw error;
      success(`Ferramenta "${tool.name}" devolvida ao estoque!`);
      fetchTools();
    } catch (err: any) {
      toastError('Erro ao devolver ferramenta', err.message);
    }
  };

  // Action: Loan tool to tech
  const handleConfirmLoan = async () => {
    if (!loanTool || !targetTechId) return;

    try {
      const { error } = await supabase
        .from('tools')
        .update({
          status: 'emprestada',
          assigned_to_tech_id: targetTechId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', loanTool.id);

      if (error) throw error;
      const tech = profiles.find((p) => p.id === targetTechId);
      success(`Ferramenta emprestada para ${tech?.name || 'técnico'}!`);
      setLoanTool(null);
      fetchTools();
    } catch (err: any) {
      toastError('Erro ao emprestar ferramenta', err.message);
    }
  };

  // Action: Set maintenance
  const handleToggleMaintenance = async (tool: Tool) => {
    const nextStatus = tool.status === 'manutencao' ? 'disponivel' : 'manutencao';
    try {
      const { error } = await supabase
        .from('tools')
        .update({
          status: nextStatus,
          assigned_to_tech_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tool.id);

      if (error) throw error;
      success(`Status da ferramenta alterado para "${nextStatus}"`);
      fetchTools();
    } catch (err: any) {
      toastError('Erro ao alterar status', err.message);
    }
  };

  // Save tool (create/edit)
  const handleSaveTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        category: category.trim() || null,
        notes: notes.trim() || null,
        status,
        updated_at: new Date().toISOString(),
      };

      if (editingTool) {
        const { error } = await supabase.from('tools').update(payload).eq('id', editingTool.id);
        if (error) throw error;
        success('Ferramenta atualizada!');
      } else {
        const { error } = await supabase.from('tools').insert(payload);
        if (error) throw error;
        success('Ferramenta cadastrada!');
      }

      setIsModalOpen(false);
      fetchTools();
    } catch (err: any) {
      toastError('Erro ao salvar ferramenta', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingTool(null);
    setName('');
    setCode('');
    setCategory('');
    setNotes('');
    setStatus('disponivel');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: Tool) => {
    setEditingTool(t);
    setName(t.name);
    setCode(t.code || '');
    setCategory(t.category || '');
    setNotes(t.notes || '');
    setStatus(t.status);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-industrial-900 tracking-tight">
            Inventário de Ferramentas
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle de cautela, empréstimos para técnicos e manutenções
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-industrial-800 hover:bg-industrial-900 active:scale-95 text-white font-bold text-sm shadow-md transition-all min-h-[48px]"
        >
          <Plus className="w-5 h-5 text-amberAlert-500" />
          <span>Nova Ferramenta</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar ferramenta por nome, código ou responsável..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-industrial-800"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold pb-1">
          {['todos', 'disponivel', 'emprestada', 'manutencao'].map((st) => {
            const labels: Record<string, string> = {
              todos: 'Todas',
              disponivel: 'Disponíveis',
              emprestada: 'Emprestadas',
              manutencao: 'Em Manutenção',
            };
            const active = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${
                  active
                    ? 'bg-industrial-800 text-white border-industrial-800 shadow-xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {labels[st]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tools Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-10 h-10 border-4 border-industrial-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-semibold text-sm">Carregando inventário de ferramentas...</p>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          <Hammer className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="font-bold text-base text-slate-700">Nenhuma ferramenta encontrada</h3>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre as ferramentas da oficina para gerenciar empréstimos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredTools.map((tool) => {
            const isAvail = tool.status === 'disponivel';
            const isLoaned = tool.status === 'emprestada';
            const isMaint = tool.status === 'manutencao';

            return (
              <div
                key={tool.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {tool.code && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          TAG: {tool.code}
                        </span>
                      )}
                      <h3 className="font-bold text-base text-slate-900 leading-snug">
                        {tool.name}
                      </h3>
                      {tool.category && (
                        <span className="inline-block text-[11px] font-semibold text-industrial-800 bg-blue-50 px-2 py-0.5 rounded-md mt-1">
                          {tool.category}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                        isAvail
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : isLoaned
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {tool.status}
                    </span>
                  </div>

                  {/* Responsible Tech Info */}
                  {isLoaned && tool.assigned_tech && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs">
                      <UserCheck className="w-4 h-4 text-amberAlert-600 shrink-0" />
                      <span className="text-amber-900">
                        Em posse de: <strong>{tool.assigned_tech.name}</strong>
                      </span>
                    </div>
                  )}

                  {isMaint && (
                    <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="text-rose-900 font-medium">
                        Equipamento em revisão ou conserto
                      </span>
                    </div>
                  )}

                  {tool.notes && (
                    <p className="text-xs text-slate-500 mt-2 italic">{tool.notes}</p>
                  )}
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  {isAvail && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoanTool(tool);
                        setTargetTechId(currentProfile?.id || '');
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-white active:scale-95 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Emprestar</span>
                    </button>
                  )}

                  {isLoaned && (
                    <button
                      type="button"
                      onClick={() => handleReturnTool(tool)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Devolver ao Estoque</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleMaintenance(tool)}
                    className="p-2 rounded-xl text-slate-500 hover:text-amberAlert-600 hover:bg-slate-100 active:scale-90"
                    title={isMaint ? 'Finalizar manutenção' : 'Enviar para manutenção'}
                  >
                    <Wrench className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(tool)}
                    className="p-2 rounded-xl text-slate-500 hover:text-industrial-800 hover:bg-slate-100 active:scale-90"
                    title="Editar ferramenta"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Loan to Tech */}
      {loanTool && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Emprestar Ferramenta</h2>
                <p className="text-xs text-blue-200">{loanTool.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setLoanTool(null)}
                className="p-1 rounded-lg text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Selecione o Técnico Responsável *
                </label>
                <select
                  value={targetTechId}
                  onChange={(e) => setTargetTechId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-white"
                >
                  <option value="">Selecione quem está retirando...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role === 'adm' ? 'ADM' : 'Técnico'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setLoanTool(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLoan}
                  disabled={!targetTechId}
                  className="px-5 py-2.5 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Confirmar Retirada</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tool Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingTool ? 'Editar Ferramenta' : 'Nova Ferramenta'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTool} className="p-4 sm:p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Nome da Ferramenta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Martelete Perfurador Bosch 800W"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Código / TAG
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: FER-01"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Elétrica, Manuais..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Status Inicial
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="disponivel">Disponível no Estoque</option>
                  <option value="emprestada">Emprestada</option>
                  <option value="manutencao">Em Manutenção</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Observações / N° Série
                </label>
                <textarea
                  rows={2}
                  placeholder="Voltagem, maleta de acessórios, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
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
                  <span>{saving ? 'Gravando...' : 'Salvar Ferramenta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
