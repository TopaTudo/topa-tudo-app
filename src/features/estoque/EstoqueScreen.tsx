import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import { parseBRLNumber } from '@/core/utils/currency';
import type { InventoryStockView, InventoryMovement } from '@/core/types/database';
import {
  Package,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  History,
  Edit2,
  X,
  Save,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export const EstoqueScreen: React.FC = () => {
  const { isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [stockList, setStockList] = useState<InventoryStockView[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [filterMode, setFilterMode] = useState<'todos' | 'criticos' | 'disponiveis'>('todos');

  const categories = useMemo(() => {
    const cats = new Set(stockList.map(item => item.category).filter(Boolean) as string[]);
    return ['Todas', ...Array.from(cats).sort()];
  }, [stockList]);

  // Modal State: Movement (Entrada / Saída Avulsa)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<InventoryStockView | null>(null);
  const [movementType, setMovementType] = useState<'entrada' | 'saida'>('entrada');
  const [movementQty, setMovementQty] = useState<string>('1');
  const [movementNotes, setMovementNotes] = useState('');
  const [submittingMovement, setSubmittingMovement] = useState(false);

  // Modal State: Material Create / Edit
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<InventoryStockView | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('un');
  const [minStock, setMinStock] = useState<string>('5');
  const [maxStock, setMaxStock] = useState<string>('50');
  const [costPrice, setCostPrice] = useState<string>('0');
  const [supplier, setSupplier] = useState('');
  const [savingMaterial, setSavingMaterial] = useState(false);

  // Modal State: Movement History
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyMaterial, setHistoryMaterial] = useState<InventoryStockView | null>(null);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_inventory_stock')
        .select('*')
        .order('name');

      if (error) throw error;
      setStockList((data as InventoryStockView[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar estoque:', err);
      toastError('Erro ao carregar estoque', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const filteredItems = useMemo(() => {
    return stockList.filter((item) => {
      const isCritical = Number(item.saldo_atual) <= Number(item.min_stock);

      if (filterMode === 'criticos' && !isCritical) return false;
      if (filterMode === 'disponiveis' && Number(item.saldo_atual) <= 0) return false;

      if (categoryFilter !== 'Todas' && item.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(q);
        const codeMatch = item.code?.toLowerCase().includes(q) || false;
        const catMatch = item.category?.toLowerCase().includes(q) || false;
        const supMatch = item.supplier?.toLowerCase().includes(q) || false;
        return nameMatch || codeMatch || catMatch || supMatch;
      }

      return true;
    });
  }, [stockList, filterMode, searchQuery, categoryFilter]);

  // Handle Quick Movement (Entrada / Saída)
  const handleOpenMovement = (item: InventoryStockView, type: 'entrada' | 'saida') => {
    setSelectedMaterial(item);
    setMovementType(type);
    setMovementQty('1');
    setMovementNotes('');
    setIsMovementModalOpen(true);
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseBRLNumber(movementQty);
    if (!selectedMaterial || qty <= 0) return;
    setSubmittingMovement(true);

    try {
      const { error } = await supabase.from('inventory_movements').insert({
        material_id: selectedMaterial.id,
        type: movementType,
        quantity: qty,
        notes: movementNotes.trim() || `Lançamento manual avulso (${movementType})`,
      });

      if (error) throw error;

      success(
        `Movimentação registrada com sucesso!`,
        `${movementType === 'entrada' ? '+' : '-'}${qty} ${selectedMaterial.unit} em ${selectedMaterial.name}`
      );
      setIsMovementModalOpen(false);
      fetchStock();
    } catch (err: any) {
      toastError('Erro ao registrar movimentação', err.message);
    } finally {
      setSubmittingMovement(false);
    }
  };

  // Handle Material Create / Edit
  const handleOpenCreateMaterial = () => {
    setEditingMaterial(null);
    setName('');
    setCode('');
    setCategory('');
    setUnit('un');
    setMinStock('5');
    setMaxStock('50');
    setCostPrice('0');
    setSupplier('');
    setIsMaterialModalOpen(true);
  };

  const handleOpenEditMaterial = (m: InventoryStockView) => {
    setEditingMaterial(m);
    setName(m.name);
    setCode(m.code || '');
    setCategory(m.category || '');
    setUnit(m.unit || 'un');
    setMinStock(m.min_stock != null ? String(m.min_stock) : '0');
    setMaxStock(m.max_stock != null ? String(m.max_stock) : '0');
    setCostPrice(m.cost_price != null ? String(m.cost_price) : '0');
    setSupplier(m.supplier || '');
    setIsMaterialModalOpen(true);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSavingMaterial(true);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        category: category.trim() || null,
        unit: unit.trim() || 'un',
        min_stock: parseBRLNumber(minStock),
        max_stock: parseBRLNumber(maxStock),
        cost_price: parseBRLNumber(costPrice),
        supplier: supplier.trim() || null,
      };

      if (editingMaterial) {
        const { error } = await supabase.from('inventory').update(payload).eq('id', editingMaterial.id);
        if (error) throw error;
        success('Material atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('inventory').insert(payload);
        if (error) throw error;
        success('Novo material cadastrado com sucesso!');
      }

      setIsMaterialModalOpen(false);
      fetchStock();
    } catch (err: any) {
      toastError('Erro ao salvar material', err.message);
    } finally {
      setSavingMaterial(false);
    }
  };

  // Open Movement History
  const handleOpenHistory = async (mat: InventoryStockView) => {
    setHistoryMaterial(mat);
    setIsHistoryModalOpen(true);
    const { data } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('material_id', mat.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (data) setMovements(data as InventoryMovement[]);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-industrial-900 tracking-tight">
            Controle de Estoque
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Saldo de materiais em tempo real com baixa automática por OS
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateMaterial}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-industrial-800 hover:bg-industrial-900 active:scale-95 text-white font-bold text-sm shadow-md transition-all min-h-[48px]"
        >
          <Plus className="w-5 h-5 text-amberAlert-500" />
          <span>Novo Material</span>
        </button>
      </div>

      {/* Search & Filter Strip */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por código (ex: MAT-ELE-001), nome do material, fornecedor ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-industrial-800 focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-100 font-semibold text-slate-700 focus:ring-2 focus:ring-industrial-800"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <button
            type="button"
            onClick={() => setFilterMode('todos')}
            className={`px-3 py-1.5 rounded-xl border transition-all active:scale-95 whitespace-nowrap ${
              filterMode === 'todos'
                ? 'bg-industrial-800 text-white border-industrial-800 shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            Todos ({stockList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('criticos')}
            className={`px-3 py-1.5 rounded-xl border transition-all active:scale-95 flex items-center gap-1 whitespace-nowrap ${
              filterMode === 'criticos'
                ? 'bg-amberAlert-600 text-white border-amberAlert-600 shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Criticos (
            {stockList.filter((i) => Number(i.saldo_atual) <= Number(i.min_stock)).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('disponiveis')}
            className={`px-3 py-1.5 rounded-xl border transition-all active:scale-95 whitespace-nowrap ${
              filterMode === 'disponiveis'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
            }`}
          >
            Com Saldo Positivo
          </button>
        </div>
        
        <p className="text-xs text-slate-500 font-medium pt-1 px-1">
          Exibindo {filteredItems.length} de {stockList.length} materiais
        </p>
      </div>

      {/* Materials Cards List */}
      {loading ? (
        <div className="p-12 text-center text-slate-600">
          <div className="w-10 h-10 border-4 border-industrial-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-semibold text-sm">Carregando saldo do estoque...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-600">
          <Package className="w-10 h-10 text-slate-500 mx-auto mb-2" />
          <h3 className="font-bold text-base text-slate-800">
            Nenhum material encontrado com o termo '{searchQuery}'
          </h3>
          <button
            onClick={() => { setSearchQuery(''); setCategoryFilter('Todas'); setFilterMode('todos'); }}
            className="text-sm font-bold text-industrial-800 hover:underline mt-2"
          >
            [Limpar busca]
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredItems.map((item) => {
            const isCritical = Number(item.saldo_atual) <= Number(item.min_stock);
            const isZero = Number(item.saldo_atual) <= 0;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-4 shadow-xs flex flex-col justify-between gap-3 ${
                  isZero
                    ? 'border-rose-300 bg-rose-50/20'
                    : isCritical
                    ? 'border-amberAlert-500/60 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {item.code && (
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                          Cód: {item.code}
                        </span>
                      )}
                      <h3 className="font-bold text-base text-slate-900 leading-snug">
                        {item.name}
                      </h3>
                      {item.category && (
                        <span className="inline-block text-[11px] font-semibold text-industrial-800 bg-blue-50 px-2 py-0.5 rounded-md mt-1">
                          {item.category}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <div
                        className={`inline-flex flex-col items-end px-3 py-1.5 rounded-xl border font-black text-lg ${
                          isZero
                            ? 'bg-rose-100 border-rose-300 text-rose-800'
                            : isCritical
                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                            : 'bg-emerald-100 border-emerald-300 text-emerald-800'
                        }`}
                      >
                        <span>
                          {item.saldo_atual} <span className="text-xs font-semibold">{item.unit}</span>
                        </span>
                        <span className="text-[9px] font-bold tracking-tight uppercase">
                          {isZero ? 'Esgotado' : isCritical ? 'Repor' : 'Saldo Atual'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stock bounds & price */}
                  <div className="grid grid-cols-3 gap-2 mt-3 p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-600 block text-[9px] font-bold uppercase">Mín / Máx</span>
                      <span className="font-bold text-slate-700">
                        {item.min_stock} / {item.max_stock} {item.unit}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600 block text-[9px] font-bold uppercase">Custo Médio</span>
                      <span className="font-bold text-slate-700">
                        R$ {Number(item.cost_price).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600 block text-[9px] font-bold uppercase">Saídas Totais</span>
                      <span className="font-bold text-slate-700">
                        {item.saidas} {item.unit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Movement Buttons: + Entrada, - Saída, Histórico */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleOpenMovement(item, 'entrada')}
                    className="flex-1 min-h-[44px] py-2 px-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+ Entrada</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenMovement(item, 'saida')}
                    className="flex-1 min-h-[44px] py-2 px-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 active:scale-95 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                    <span>- Saída</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenHistory(item)}
                    aria-label={`Ver histórico de movimentações de ${item.name}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:text-industrial-900 hover:bg-slate-100 active:scale-90 transition-colors"
                    title="Ver histórico de movimentações"
                  >
                    <History className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditMaterial(item)}
                    aria-label={`Editar dados do material ${item.name}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:text-industrial-900 hover:bg-slate-100 active:scale-90 transition-colors"
                    title="Editar dados do material"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Quick Movement (Entrada/Saída) */}
      {isMovementModalOpen && selectedMaterial && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Lançar Movimentação</h2>
                <p className="text-xs text-blue-200">{selectedMaterial.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                aria-label="Fechar lançamento de movimentação"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-industrial-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMovement} className="p-4 sm:p-6 space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100">
                <button
                  type="button"
                  onClick={() => setMovementType('entrada')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    movementType === 'entrada'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Entrada (Reposição/Compra)
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('saida')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    movementType === 'saida'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Saída (Uso Avulso/Perda)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Quantidade ({selectedMaterial.unit}) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={movementQty}
                  onChange={(e) => setMovementQty(e.target.value)}
                  placeholder="1,0"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-industrial-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Justificativa / Motivo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Compra NF 1290 ou quebra em transporte"
                  value={movementNotes}
                  onChange={(e) => setMovementNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-industrial-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingMovement}
                  className="px-5 py-2.5 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{submittingMovement ? 'Lançando...' : 'Confirmar Lançamento'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Material Create / Edit */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingMaterial ? 'Editar Material' : 'Cadastrar Material'}
              </h2>
              <button
                type="button"
                onClick={() => setIsMaterialModalOpen(false)}
                aria-label="Fechar formulário de material"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-industrial-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="p-4 sm:p-6 space-y-3.5 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Nome do Material *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Disjuntor Bipolar 32A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Código Interno
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: ELE-01"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Elétrica, Hidráulica, etc."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Unidade de Medida
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="m">Metros (m)</option>
                    <option value="kg">Quilos (kg)</option>
                    <option value="pct">Pacote (pct)</option>
                    <option value="cx">Caixa (cx)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Estoque Mínimo
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Estoque Máximo
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={maxStock}
                    onChange={(e) => setMaxStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Preço de Custo (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Fornecedor Principal
                </label>
                <input
                  type="text"
                  placeholder="Ex: Comercial Elétrica Silva"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsMaterialModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMaterial}
                  className="px-5 py-2.5 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingMaterial ? 'Gravando...' : 'Salvar Material'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Movement History */}
      {isHistoryModalOpen && historyMaterial && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Histórico de Movimentações</h2>
                <p className="text-xs text-blue-200">{historyMaterial.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                aria-label="Fechar histórico de movimentações"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-industrial-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5">
              {movements.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-6">
                  Nenhuma movimentação registrada para este item.
                </p>
              ) : (
                movements.map((mov) => {
                  const isEntry = mov.type === 'entrada';
                  return (
                    <div
                      key={mov.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            isEntry
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isEntry ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 block">
                            {isEntry ? '+' : '-'} {mov.quantity} {historyMaterial.unit}
                          </span>
                          <span className="text-[11px] text-slate-600">
                            {mov.notes || (isEntry ? 'Entrada no estoque' : 'Baixa de estoque')}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-600">
                        {new Date(mov.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
