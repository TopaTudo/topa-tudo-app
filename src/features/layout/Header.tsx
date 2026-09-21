import React, { useState, useEffect } from 'react';
import { useAuth } from '@/core/context/AuthContext';
import { useOnlineStatus } from '@/core/hooks/useOnlineStatus';
import { supabase } from '@/core/supabase';
import type { InventoryStockView } from '@/core/types/database';
import { AlertTriangle, LogOut, Wrench, ShieldCheck, UserCheck, X, WifiOff } from 'lucide-react';

interface HeaderProps {
  onNavigate: (tab: string) => void;
  currentTab: string;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, currentTab }) => {
  const { currentProfile, logout, isAdmin } = useAuth();
  const isOnline = useOnlineStatus();
  const [lowStockItems, setLowStockItems] = useState<InventoryStockView[]>([]);
  const [showLowStockModal, setShowLowStockModal] = useState(false);

  // Check inventory stock view periodically
  useEffect(() => {
    let isMounted = true;

    async function checkStock() {
      try {
        const { data, error } = await supabase
          .from('v_inventory_stock')
          .select('*');

        if (!error && data && isMounted) {
          const critical = (data as InventoryStockView[]).filter(
            (item) => Number(item.saldo_atual) <= Number(item.min_stock)
          );
          setLowStockItems(critical);
        }
      } catch (e) {
        console.error('Erro ao verificar estoque baixo:', e);
      }
    }

    checkStock();
    const interval = setInterval(checkStock, 20000); // 20s poll or on demand
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentTab]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-industrial-900 border-b border-industrial-800 text-white shadow-md select-none">
        {/* Offline Status Banner */}
        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            className="bg-amber-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 shadow-inner transition-colors duration-200"
          >
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-100" />
            <span>Modo Offline — exibindo dados salvos</span>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          {/* Logo Brand */}
          <div
            onClick={() => onNavigate('os')}
            className="flex items-center gap-2.5 cursor-pointer active:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-industrial-700 to-industrial-800 border border-blue-400/40 flex items-center justify-center shadow-inner">
              <Wrench className="w-5 h-5 text-amberAlert-500" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-wider block leading-none">
                TOPA TUDO
              </span>
              <span className="text-[10px] text-blue-200/80 font-medium tracking-wide uppercase">
                {isAdmin ? 'Painel Gestor' : 'Terminal Técnico'}
              </span>
            </div>
          </div>

          {/* Right Action Icons: Stock Alert + Profile Chip */}
          <div className="flex items-center gap-2">
            {/* Low Stock Alert Badge */}
            {lowStockItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowLowStockModal(true)}
                aria-label={`${lowStockItems.length} materiais com estoque crítico`}
                className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold active:scale-95 transition-transform animate-pulse"
                title={`${lowStockItems.length} materiais com estoque crítico`}
              >
                <AlertTriangle className="w-4 h-4 text-amberAlert-500" />
                <span>{lowStockItems.length}</span>
              </button>
            )}

            {/* Profile Info & Logout */}
            <div className="flex items-center bg-industrial-800/80 rounded-xl border border-industrial-700/60 p-1 pl-2.5 gap-2">
              <div className="text-right">
                <span className="text-xs font-bold block text-slate-100 max-w-[110px] truncate leading-tight">
                  {currentProfile?.name}
                </span>
                <span className="text-[9px] font-semibold text-blue-300 uppercase leading-none">
                  {isAdmin ? 'ADM' : 'Técnico'}
                </span>
              </div>

              <button
                type="button"
                onClick={logout}
                aria-label="Sair da conta"
                title="Sair / Trocar de usuário"
                className="min-h-[44px] min-w-[44px] rounded-lg bg-industrial-700 hover:bg-rose-900/60 text-slate-300 hover:text-white flex items-center justify-center active:scale-90 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Low Stock Modal */}
      {showLowStockModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-md p-5 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amberAlert-500 font-bold text-base">
                <AlertTriangle className="w-5 h-5" />
                <h3>Alerta: Materiais com Estoque Baixo</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLowStockModal(false)}
                aria-label="Fechar alerta de estoque"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 my-3">
              Os itens abaixo estão no nível mínimo ou esgotados. Realize reposição urgente para não paralisar ordens de serviço.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-semibold text-sm text-slate-100">{item.name}</h4>
                    <span className="text-xs text-slate-400">
                      Mínimo exigido: {item.min_stock} {item.unit}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block font-bold text-sm px-2.5 py-1 rounded-lg ${
                        Number(item.saldo_atual) <= 0
                          ? 'bg-rose-900/60 text-rose-300 border border-rose-700'
                          : 'bg-amber-900/60 text-amber-300 border border-amber-700'
                      }`}
                    >
                      {item.saldo_atual} {item.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowLowStockModal(false);
                  onNavigate('estoque');
                }}
                className="w-full py-2.5 bg-amberAlert-600 hover:bg-amberAlert-700 text-white font-bold rounded-xl active:scale-[0.98] transition-all text-sm"
              >
                Ver Estoque Completo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
