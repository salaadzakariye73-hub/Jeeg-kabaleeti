import {
  Activity,
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  RefreshCw,
  RotateCcw,
  Settings,
  Shield,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';

export type NavSection =
  | 'dashboard'
  | 'inventory'
  | 'rentals'
  | 'returns'
  | 'customers'
  | 'payments'
  | 'expenses'
  | 'reports'
  | 'users'
  | 'auditLogs'
  | 'syncCenter'
  | 'settings';

interface LayoutProps {
  activeTab: NavSection;
  onSelectTab: (tab: NavSection) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, onSelectTab, children }) => {
  const {
    user,
    lang,
    setLang,
    t,
    settings,
    isOnline,
    pendingCount,
    syncStatus,
    triggerSync,
    logout,
  } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const systemName = settings?.systemName || t.app.defaultSystemName;
  const websiteName = settings?.websiteName || t.app.defaultWebsiteName;
  const isManager = user?.role === 'MANAGER';

  const navItems: Array<{ id: NavSection; label: string; icon: React.FC<{ className?: string }>; managerOnly?: boolean }> = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'inventory', label: t.nav.inventory, icon: Package },
    { id: 'rentals', label: t.nav.rentals, icon: ClipboardList },
    { id: 'returns', label: t.nav.returns, icon: RotateCcw },
    { id: 'customers', label: t.nav.customers, icon: Users },
    { id: 'payments', label: t.nav.payments, icon: CreditCard },
    { id: 'expenses', label: t.nav.expenses, icon: Receipt },
    { id: 'reports', label: t.nav.reports, icon: BarChart3 },
    { id: 'users', label: t.nav.users, icon: Shield, managerOnly: true },
    { id: 'auditLogs', label: t.nav.auditLogs, icon: Activity, managerOnly: true },
    { id: 'syncCenter', label: t.nav.syncCenter, icon: RefreshCw },
    { id: 'settings', label: t.nav.settings, icon: Settings },
  ].filter((item) => !item.managerOnly || isManager) as Array<{
    id: NavSection;
    label: string;
    icon: React.FC<{ className?: string }>;
  }>;

  const activeTitle = navItems.find((n) => n.id === activeTab)?.label || t.nav.dashboard;

  const handleSelect = (id: NavSection) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F3F5F8] text-[#202B38] flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#172B42] text-white border-r border-[#102033]">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          {settings?.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={systemName}
              className="w-10 h-10 rounded-lg object-contain bg-white p-0.5 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#245B91] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{systemName}</p>
            <p className="text-xs text-slate-300 truncate">{websiteName}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-[#245B91] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'syncCenter' && pendingCount > 0 && (
                  <span className="font-mono-tabular text-xs font-bold text-[#E58A24]">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="text-xs">
            <p className="font-semibold text-white truncate">{user?.fullName}</p>
            <p className="text-slate-300 truncate">
              {isManager ? t.app.managerRole : t.app.adminRole}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-semibold text-white transition-colors min-h-[40px]"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.app.logout}</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-[#172B42] hover:bg-slate-50 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-[#202B38] truncate">
              {activeTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Connectivity & Sync Trigger */}
            <button
              type="button"
              onClick={() => {
                if (isOnline && pendingCount > 0 && !isManager) {
                  triggerSync();
                } else {
                  handleSelect('syncCenter');
                }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors min-h-[36px] whitespace-nowrap ${
                !isOnline
                  ? 'border-[#E5A12A]/40 bg-[#E5A12A]/10 text-[#9a6700]'
                  : pendingCount > 0
                  ? 'border-[#E58A24]/40 bg-[#E58A24]/10 text-[#b4640d]'
                  : 'border-[#238653]/30 bg-[#238653]/10 text-[#238653]'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {!isOnline
                  ? t.app.offlineMode
                  : syncStatus === 'SYNCING'
                  ? t.app.synchronizing
                  : pendingCount > 0
                  ? `${t.app.pendingSync} (${pendingCount})`
                  : t.app.onlineMode}
              </span>
              {pendingCount > 0 && <span className="sm:hidden font-mono-tabular">{pendingCount}</span>}
            </button>

            <div className="hidden sm:block">
              <PWAInstallButton t={t} />
            </div>

            {/* Language Switcher */}
            <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setLang('so')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  lang === 'so' ? 'bg-white text-[#172B42] shadow-sm' : 'text-slate-600'
                }`}
              >
                SO
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  lang === 'en' ? 'bg-white text-[#172B42] shadow-sm' : 'text-slate-600'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </header>

        {/* Read-only supervisory notice for Manager */}
        {isManager && (
          <div className="no-print bg-[#172B42]/5 border-b border-slate-200 px-4 sm:px-6 py-2 flex items-center gap-2 text-xs font-medium text-[#172B42]">
            <Shield className="w-3.5 h-3.5 text-[#245B91] shrink-0" />
            <span>{t.app.readOnlyNotice}</span>
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 h-16">
        {(
          [
            { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
            { id: 'rentals', label: t.nav.rentals, icon: ClipboardList },
            { id: 'returns', label: t.nav.returns, icon: RotateCcw },
            { id: 'inventory', label: t.nav.inventory, icon: Package },
          ] as Array<{ id: NavSection; label: string; icon: React.FC<{ className?: string }> }>
        ).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex flex-col items-center justify-center px-1 min-h-[44px] ${
                active ? 'text-[#245B91] font-semibold' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-1 truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center px-1 min-h-[44px] text-slate-500"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-1">{t.nav.more}</span>
        </button>
      </nav>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="no-print lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#172B42] text-white h-full flex flex-col z-10 shadow-xl">
            <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {settings?.logoDataUrl ? (
                  <img
                    src={settings.logoDataUrl}
                    alt={systemName}
                    className="w-8 h-8 rounded object-contain bg-white p-0.5 shrink-0"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-[#E58A24] shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{systemName}</p>
                  <p className="text-[11px] text-slate-300 truncate">{websiteName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-300 hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-lg text-sm font-medium text-left min-h-[44px] ${
                      active ? 'bg-[#245B91] text-white' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {item.id === 'syncCenter' && pendingCount > 0 && (
                      <span className="font-mono-tabular text-xs font-bold text-[#E58A24]">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="pt-2 px-1">
                <PWAInstallButton t={t} />
              </div>
            </div>

            <div className="p-4 border-t border-white/10 space-y-3">
              <div className="text-xs">
                <p className="font-semibold text-white truncate">{user?.fullName}</p>
                <p className="text-slate-300 truncate">
                  {isManager ? t.app.managerRole : t.app.adminRole}
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-xs font-semibold text-white min-h-[44px]"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.app.logout}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
