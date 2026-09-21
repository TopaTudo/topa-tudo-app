import React, { Suspense, lazy } from 'react';
import { ToastProvider } from '@/core/context/ToastContext';
import { AuthProvider, useAuth } from '@/core/context/AuthContext';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { AppLayout } from '@/features/layout/AppLayout';

// Code-splitting via React.lazy nas 9 telas principais do app
const OSList = lazy(() => import('@/features/os/OSList').then((m) => ({ default: m.OSList })));
const AgendaView = lazy(() => import('@/features/agenda/AgendaView').then((m) => ({ default: m.AgendaView })));
const ClientList = lazy(() => import('@/features/clientes/ClientList').then((m) => ({ default: m.ClientList })));
const EstoqueScreen = lazy(() => import('@/features/estoque/EstoqueScreen').then((m) => ({ default: m.EstoqueScreen })));
const FinancialView = lazy(() => import('@/features/financeiro/FinancialView').then((m) => ({ default: m.FinancialView })));
const ToolsView = lazy(() => import('@/features/ferramentas/ToolsView').then((m) => ({ default: m.ToolsView })));
const DashboardView = lazy(() => import('@/features/dashboard/DashboardView').then((m) => ({ default: m.DashboardView })));
const ServicesCatalogView = lazy(() => import('@/features/config/ServicesCatalogView').then((m) => ({ default: m.ServicesCatalogView })));
const TechManagementView = lazy(() => import('@/features/config/TechManagementView').then((m) => ({ default: m.TechManagementView })));

const ScreenLoader: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-industrial-600 animate-in fade-in duration-200">
    <div className="w-8 h-8 border-3 border-industrial-200 border-t-industrial-600 rounded-full animate-spin mb-3" />
    <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Carregando módulo...</span>
  </div>
);

const MainNavigator: React.FC = () => {
  const { currentProfile } = useAuth();

  // If no profile is authenticated with PIN, show PIN Login Screen
  if (!currentProfile) {
    return <LoginScreen />;
  }

  return (
    <AppLayout>
      {(currentTab, onNavigate) => (
        <Suspense fallback={<ScreenLoader />}>
          {(() => {
            switch (currentTab) {
              case 'os':
                return <OSList />;
              case 'agenda':
                return <AgendaView />;
              case 'clientes':
                return <ClientList />;
              case 'estoque':
                return <EstoqueScreen />;
              case 'financeiro':
                return <FinancialView />;
              case 'ferramentas':
                return <ToolsView />;
              case 'dashboard':
                return <DashboardView />;
              case 'servicos':
                return <ServicesCatalogView />;
              case 'tecnicos':
                return <TechManagementView />;
              default:
                return <OSList />;
            }
          })()}
        </Suspense>
      )}
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainNavigator />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
