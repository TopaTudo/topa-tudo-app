import React from 'react';
import { ToastProvider } from '@/core/context/ToastContext';
import { AuthProvider, useAuth } from '@/core/context/AuthContext';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { AppLayout } from '@/features/layout/AppLayout';
import { OSList } from '@/features/os/OSList';
import { AgendaView } from '@/features/agenda/AgendaView';
import { ClientList } from '@/features/clientes/ClientList';
import { EstoqueScreen } from '@/features/estoque/EstoqueScreen';
import { FinancialView } from '@/features/financeiro/FinancialView';
import { ToolsView } from '@/features/ferramentas/ToolsView';
import { DashboardView } from '@/features/dashboard/DashboardView';
import { ServicesCatalogView } from '@/features/config/ServicesCatalogView';
import { TechManagementView } from '@/features/config/TechManagementView';

const MainNavigator: React.FC = () => {
  const { currentProfile } = useAuth();

  // If no profile is authenticated with PIN, show PIN Login Screen
  if (!currentProfile) {
    return <LoginScreen />;
  }

  return (
    <AppLayout>
      {(currentTab, onNavigate) => {
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
      }}
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
