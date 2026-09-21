import React, { useState } from 'react';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import { generateAndDownloadBackup } from '@/core/services/backupService';
import { BackupManagerModal } from '@/features/dashboard/BackupManagerModal';
import {
  DollarSign,
  Hammer,
  BarChart3,
  BookOpen,
  UsersRound,
  LogOut,
  X,
  ChevronRight,
  ShieldCheck,
  Package,
  Calendar,
  Users,
  ClipboardList,
  Database,
  RefreshCw,
  Layers,
} from 'lucide-react';

interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  currentTab: string;
}

export const AdminDrawer: React.FC<AdminDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  currentTab,
}) => {
  const { currentProfile, logout, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleSelect = (tab: string) => {
    onNavigate(tab);
    onClose();
  };

  const handleExecuteBackup = async () => {
    if (!isAdmin) {
      toastError('Acesso restrito', 'Apenas administradores podem fazer backup do banco de dados.');
      return;
    }
    setIsBackupLoading(true);
    try {
      await generateAndDownloadBackup(currentProfile?.name);
      success('Backup exportado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao exportar backup:', err);
      toastError('Falha no backup', err.message || 'Erro inesperado ao gerar backup.');
    } finally {
      setIsBackupLoading(false);
    }
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard & Indicadores',
      description: 'KPIs mensais, metas e faturamento',
      icon: <BarChart3 className="w-5 h-5 text-indigo-400" />,
      admOnly: true,
    },
    {
      id: 'financeiro',
      label: 'Financeiro & Fluxo de Caixa',
      description: 'Receitas de OS, despesas e saldo líquido',
      icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
      admOnly: true,
    },
    {
      id: 'ferramentas',
      label: 'Inventário de Ferramentas',
      description: 'Empréstimos, devoluções e manutenção',
      icon: <Hammer className="w-5 h-5 text-amberAlert-500" />,
      admOnly: false,
    },
    {
      id: 'servicos',
      label: 'Catálogo de Serviços',
      description: 'Tabela de preços e serviços padrão',
      icon: <BookOpen className="w-5 h-5 text-blue-400" />,
      admOnly: true,
    },
    {
      id: 'tecnicos',
      label: 'Equipe & Técnicos',
      description: 'Gestão de usuários, PINs e perfis',
      icon: <UsersRound className="w-5 h-5 text-purple-400" />,
      admOnly: true,
    },
    {
      id: 'os',
      label: 'Ordens de Serviço',
      description: 'Todas as OSs e status',
      icon: <ClipboardList className="w-5 h-5 text-sky-400" />,
      admOnly: false,
    },
    {
      id: 'agenda',
      label: 'Agenda do Dia',
      description: 'Visitas e agendamentos',
      icon: <Calendar className="w-5 h-5 text-cyan-400" />,
      admOnly: false,
    },
    {
      id: 'clientes',
      label: 'Clientes CRM',
      description: 'Histórico, contatos e WhatsApp',
      icon: <Users className="w-5 h-5 text-teal-400" />,
      admOnly: false,
    },
    {
      id: 'estoque',
      label: 'Estoque de Peças',
      description: 'Materiais, saldo e reposição',
      icon: <Package className="w-5 h-5 text-amber-400" />,
      admOnly: false,
    },
  ];

  const visibleItems = navItems.filter((item) => (item.admOnly ? isAdmin : true));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm sm:max-w-md bg-slate-900 border-l border-slate-800 text-white flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-250"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-industrial-800 border border-industrial-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-amberAlert-500" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Menu Topa Tudo</h3>
              <p className="text-xs text-slate-400">
                Logado como <strong className="text-slate-200">{currentProfile?.name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu administrativo"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Drawer Menu List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {visibleItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all active:scale-[0.98] ${
                  isActive
                    ? 'bg-industrial-800/90 border-blue-500 text-white shadow-md'
                    : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/60 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 shadow-inner">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm leading-tight">{item.label}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-2">
          {isAdmin && (
            <button
              type="button"
              onClick={handleExecuteBackup}
              disabled={isBackupLoading}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-amberAlert-400 border border-industrial-600 font-semibold text-sm active:scale-95 transition-all disabled:opacity-50 shadow-sm"
              title="Fazer Backup Completo do Banco de Dados"
            >
              {isBackupLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-amberAlert-400" />
              ) : (
                <Database className="w-4 h-4 text-amberAlert-400" />
              )}
              <span>
                {isBackupLoading ? 'Exportando Backup...' : 'Fazer Backup Completo do Banco de Dados'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800 font-semibold text-sm active:scale-95 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão / Trocar PIN</span>
          </button>
        </div>
      </div>

      {/* Modal de Gestão Completa de Backups na Nuvem */}
      {isAdmin && (
        <BackupManagerModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
        />
      )}
    </div>
  );
};
