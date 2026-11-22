import React, { useState } from 'react';
import { Layout, type NavSection } from './components/Layout';
import { AppProvider, useApp } from './context/AppContext';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { AuthPage } from './pages/AuthPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { InventoryPage } from './pages/InventoryPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { RentalsPage } from './pages/RentalsPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SyncCenterPage } from './pages/SyncCenterPage';
import { UsersPage } from './pages/UsersPage';

const AppShell: React.FC = () => {
  const { user, authLoading, t } = useApp();
  const [activeTab, setActiveTab] = useState<NavSection>('dashboard');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F3F5F8] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-[#245B91] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#202B38]">{t.app.loading}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const isManager = user.role === 'MANAGER';

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActiveTab} />;
      case 'inventory':
        return <InventoryPage />;
      case 'rentals':
        return <RentalsPage />;
      case 'returns':
        return <ReturnsPage />;
      case 'customers':
        return <CustomersPage />;
      case 'payments':
        return <PaymentsPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'reports':
        return <ReportsPage />;
      case 'users':
        return isManager ? <UsersPage /> : <DashboardPage onNavigate={setActiveTab} />;
      case 'auditLogs':
        return isManager ? <AuditLogsPage /> : <DashboardPage onNavigate={setActiveTab} />;
      case 'syncCenter':
        return <SyncCenterPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={setActiveTab} />;
    }
  };

  return (
    <Layout activeTab={activeTab} onSelectTab={setActiveTab}>
      {renderPage()}
    </Layout>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
