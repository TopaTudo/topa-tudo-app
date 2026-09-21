import React, { useState, useEffect } from 'react';
import { supabase } from '@/core/supabase';
import { useToast } from '@/core/context/ToastContext';
import type { ServiceCatalogItem } from '@/core/types/database';
import { BookOpen, Plus, Edit2, Trash2, X, Save, Search, Sparkles } from 'lucide-react';

export const ServicesCatalogView: React.FC = () => {
  const { success, error: toastError } = useToast();

  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceCatalogItem | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [defaultPrice, setDefaultPrice] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services_catalog')
        .select('*')
        .order('category')
        .order('title');

      if (error) throw error;
      setServices((data as ServiceCatalogItem[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar catálogo de serviços:', err);
      toastError('Erro ao carregar catálogo', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filtered = services.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || (s.category && s.category.toLowerCase().includes(q));
  });

  const handleOpenCreate = () => {
    setEditingItem(null);
    setTitle('');
    setCategory('Elétrica');
    setDefaultPrice(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ServiceCatalogItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setCategory(item.category || '');
    setDefaultPrice(Number(item.default_price) || 0);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    try {
      const payload = {
        title: title.trim(),
        category: category.trim() || null,
        default_price: Number(defaultPrice) || 0,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('services_catalog')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        success('Serviço atualizado!');
      } else {
        const { error } = await supabase.from('services_catalog').insert(payload);
        if (error) throw error;
        success('Novo serviço adicionado ao catálogo!');
      }

      setIsModalOpen(false);
      fetchServices();
    } catch (err: any) {
      toastError('Erro ao salvar serviço', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirm = window.confirm(`Deseja realmente remover o serviço "${name}" do catálogo?`);
    if (!confirm) return;

    try {
      const { error } = await supabase.from('services_catalog').delete().eq('id', id);
      if (error) throw error;
      success('Serviço removido com sucesso!');
      fetchServices();
    } catch (err: any) {
      toastError('Erro ao excluir serviço', err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-industrial-900 tracking-tight">
            Catálogo de Serviços
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tabela padronizada de serviços e preços base para orçamentos rápidos
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-industrial-800 hover:bg-industrial-900 active:scale-95 text-white font-bold text-sm shadow-md transition-all min-h-[48px]"
        >
          <Plus className="w-5 h-5 text-amberAlert-500" />
          <span>Novo Serviço</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por serviço ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-industrial-800"
          />
        </div>
      </div>

      {/* Services List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-10 h-10 border-4 border-industrial-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-semibold text-sm">Carregando catálogo...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="font-bold text-base text-slate-700">Nenhum serviço cadastrado</h3>
          <p className="text-xs text-slate-400 mt-1">Toque em "Novo Serviço" para incluir itens.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((service) => (
            <div
              key={service.id}
              className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3"
            >
              <div>
                <span className="text-[10px] font-bold text-industrial-800 bg-blue-50 px-2 py-0.5 rounded-md uppercase">
                  {service.category || 'Geral'}
                </span>
                <h4 className="font-bold text-base text-slate-900 mt-1">{service.title}</h4>
                <span className="text-sm font-black text-emerald-700 block mt-0.5">
                  R$ {Number(service.default_price).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(service)}
                  className="p-2 rounded-xl text-slate-500 hover:text-industrial-800 hover:bg-slate-100"
                  title="Editar serviço"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(service.id, service.title)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  title="Excluir serviço"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingItem ? 'Editar Serviço' : 'Novo Serviço Padrão'}
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
                  Título do Serviço *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Troca de Chuveiro Blindado"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Categoria
                </label>
                <input
                  type="text"
                  placeholder="Elétrica, Hidráulica, Pintura, Alvenaria..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Preço Base Sugerido (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
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
                  <span>{saving ? 'Gravando...' : 'Salvar Serviço'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
