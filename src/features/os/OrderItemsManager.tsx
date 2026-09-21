import React, { useState, useEffect } from 'react';
import { supabase } from '@/core/supabase';
import type { InventoryStockView, OrderItem } from '@/core/types/database';
import { Plus, Trash2, Package, ShoppingCart, AlertCircle } from 'lucide-react';

interface OrderItemsManagerProps {
  items: Array<Omit<OrderItem, 'id' | 'order_id'>>;
  onChange: (items: Array<Omit<OrderItem, 'id' | 'order_id'>>) => void;
  disabled?: boolean;
}

export const OrderItemsManager: React.FC<OrderItemsManagerProps> = ({
  items,
  onChange,
  disabled = false,
}) => {
  const [stockList, setStockList] = useState<InventoryStockView[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // New item form state
  const [source, setSource] = useState<'estoque' | 'comprado'>('estoque');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);

  useEffect(() => {
    async function loadStock() {
      const { data, error } = await supabase
        .from('v_inventory_stock')
        .select('*')
        .order('name');
      if (!error && data) {
        setStockList(data as InventoryStockView[]);
      }
    }
    loadStock();
  }, []);

  const handleMaterialChange = (matId: string) => {
    setSelectedMaterialId(matId);
    const found = stockList.find((m) => m.id === matId);
    if (found) {
      setName(found.name);
      setUnitCost(Number(found.cost_price) || 0);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || quantity <= 0) return;

    const newItem: Omit<OrderItem, 'id' | 'order_id'> = {
      material_id: source === 'estoque' ? selectedMaterialId || null : null,
      name: name.trim(),
      quantity: Number(quantity),
      unit_cost: Number(unitCost),
      source,
    };

    onChange([...items, newItem]);

    // Reset Form
    setName('');
    setSelectedMaterialId('');
    setQuantity(1);
    setUnitCost(0);
    setShowAddForm(false);
  };

  const handleRemoveItem = (index: number) => {
    if (disabled) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const totalCost = items.reduce((acc, it) => acc + it.quantity * it.unit_cost, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Peças e Materiais Utilizados ({items.length})
          </label>
          <span className="text-xs text-slate-500">
            Itens do estoque dão baixa automática ao concluir a OS
          </span>
        </div>

        {!disabled && !showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-industrial-800 text-white text-xs font-bold hover:bg-industrial-700 active:scale-95 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Adicionar Peça
          </button>
        )}
      </div>

      {/* Add Item Modal / Inline Card */}
      {showAddForm && (
        <form
          onSubmit={handleAddItem}
          className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-blue-900">
              Nova Peça / Insumo
            </span>
            {/* Source Toggle */}
            <div className="flex bg-white rounded-lg p-0.5 border border-blue-200">
              <button
                type="button"
                onClick={() => {
                  setSource('estoque');
                  setName('');
                  setSelectedMaterialId('');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                  source === 'estoque'
                    ? 'bg-industrial-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Do Estoque
              </button>
              <button
                type="button"
                onClick={() => {
                  setSource('comprado');
                  setSelectedMaterialId('');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                  source === 'comprado'
                    ? 'bg-industrial-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Comprado Avulso
              </button>
            </div>
          </div>

          {source === 'estoque' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selecione o Material do Estoque:
              </label>
              <select
                value={selectedMaterialId}
                onChange={(e) => handleMaterialChange(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="">Selecione um item disponível...</option>
                {stockList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Saldo: {m.saldo_atual} {m.unit} | R$ {Number(m.cost_price).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome da Peça / Fornecedor:
              </label>
              <input
                type="text"
                placeholder="Ex: Fita veda rosca tigre 18mm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantidade:
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custo Unitário (R$):
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-industrial-800 text-white hover:bg-industrial-700 active:scale-95 shadow-xs"
            >
              Confirmar Peça
            </button>
          </div>
        </form>
      )}

      {/* Items List */}
      {items.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
          Nenhuma peça ou material vinculado a esta ordem de serviço.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    item.source === 'estoque'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {item.source === 'estoque' ? (
                    <Package className="w-4 h-4" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-800 leading-tight">
                    {item.name}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="font-medium">
                      Qtd: <strong>{item.quantity}</strong>
                    </span>
                    <span>•</span>
                    <span>Unit: R$ {Number(item.unit_cost).toFixed(2)}</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">
                      Total: R$ {(item.quantity * item.unit_cost).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  aria-label="Remover peça da OS"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 active:scale-90 transition-colors"
                  title="Remover peça"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {/* Subtotal of parts */}
          <div className="flex justify-between items-center px-3 py-2 bg-slate-200/70 rounded-xl text-xs font-bold text-slate-700">
            <span>Custo Total dos Materiais:</span>
            <span className="text-sm text-industrial-900">
              R$ {totalCost.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
