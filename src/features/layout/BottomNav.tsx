import React from 'react';
import { ClipboardList, Calendar, Users, Package, Menu } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  onOpenDrawer: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onNavigate,
  onOpenDrawer,
}) => {
  const tabs = [
    {
      id: 'os',
      label: 'Ordens',
      icon: <ClipboardList className="w-6 h-6" />,
    },
    {
      id: 'agenda',
      label: 'Agenda',
      icon: <Calendar className="w-6 h-6" />,
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: <Users className="w-6 h-6" />,
    },
    {
      id: 'estoque',
      label: 'Estoque',
      icon: <Package className="w-6 h-6" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl safe-bottom select-none">
      <div className="max-w-md mx-auto grid grid-cols-5 h-[64px] items-center px-1">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[52px] h-full rounded-xl transition-all active:scale-95 ${
                isActive
                  ? 'text-amberAlert-500 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-transform ${
                  isActive ? 'bg-industrial-800 scale-110 shadow-sm' : ''
                }`}
              >
                {tab.icon}
              </div>
              <span className="text-[11px] leading-tight mt-0.5 tracking-tight">
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Menu / Drawer button */}
        <button
          type="button"
          onClick={onOpenDrawer}
          className={`flex flex-col items-center justify-center min-h-[52px] h-full rounded-xl transition-all active:scale-95 ${
            ['financeiro', 'dashboard', 'ferramentas', 'servicos', 'tecnicos'].includes(currentTab)
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-transform ${
              ['financeiro', 'dashboard', 'ferramentas', 'servicos', 'tecnicos'].includes(currentTab)
                ? 'bg-industrial-800 scale-110 shadow-sm'
                : ''
            }`}
          >
            <Menu className="w-6 h-6" />
          </div>
          <span className="text-[11px] leading-tight mt-0.5 tracking-tight">
            Mais
          </span>
        </button>
      </div>
    </nav>
  );
};
