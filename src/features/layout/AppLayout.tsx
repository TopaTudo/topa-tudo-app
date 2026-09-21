import React, { useState } from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { AdminDrawer } from './AdminDrawer';

interface AppLayoutProps {
  children: (currentTab: string, onNavigate: (tab: string) => void) => React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [currentTab, setCurrentTab] = useState<string>('os');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      {/* Mobile Top Header */}
      <Header onNavigate={setCurrentTab} currentTab={currentTab} />

      {/* Main Dynamic Viewport */}
      <main className="flex-1 pb-20 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 overflow-x-hidden">
        {children(currentTab, setCurrentTab)}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onNavigate={setCurrentTab}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      {/* Slide-in Administrative & Extra Tools Drawer */}
      <AdminDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={setCurrentTab}
        currentTab={currentTab}
      />
    </div>
  );
};
