import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_EXCHANGE_RATE } from '../../shared/calculations';
import type { CompanySettingsDTO, LanguageCode, UserDTO } from '../../shared/types';
import { getDictionary, type TranslationDict } from '../i18n/translations';
import {
  getOfflineSessionProfile,
  listPendingTransactions,
  saveOfflineSessionProfile,
} from '../offline/indexedDb';
import { api, clearMemorySession, setMemorySession } from '../services/api';
import { runPendingSync, type SyncStateStatus } from '../services/syncEngine';

interface AppContextValue {
  user: UserDTO | null;
  authLoading: boolean;
  hasManager: boolean | null;
  lang: LanguageCode;
  t: TranslationDict;
  settings: CompanySettingsDTO | null;
  currentRate: number;
  isOnline: boolean;
  pendingCount: number;
  syncStatus: SyncStateStatus;
  setLang: (lang: LanguageCode) => void;
  login: (email: string, password: string) => Promise<void>;
  setupFirstManager: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshExchangeRate: () => Promise<void>;
  triggerSync: () => Promise<{ syncedCount: number; failedCount: number }>;
  recheckSetupStatus: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasManager, setHasManager] = useState<boolean | null>(null);
  const [lang, setLangState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem('msh_lang');
      return saved === 'en' ? 'en' : 'so';
    } catch {
      return 'so';
    }
  });
  const [settings, setSettings] = useState<CompanySettingsDTO | null>(null);
  const [currentRate, setCurrentRate] = useState<number>(DEFAULT_EXCHANGE_RATE);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<SyncStateStatus>('IDLE');

  const setLang = useCallback((nextLang: LanguageCode) => {
    setLangState(nextLang);
    try {
      localStorage.setItem('msh_lang', nextLang);
    } catch {
      // ignore storage errors
    }
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const items = await listPendingTransactions();
    setPendingCount(items.length);
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await api.getSettings();
      setSettings(res.data);
    } catch {
      try {
        const pub = await api.getPublicBranding();
        setSettings({
          id: 'public',
          systemName: pub.data.systemName,
          websiteName: pub.data.websiteName,
          companyName: pub.data.companyName,
          logoDataUrl: pub.data.logoDataUrl,
          phone: '',
          email: '',
          address: '',
          description: '',
          defaultLanguage: pub.data.defaultLanguage,
          primaryCurrency: 'USD',
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // offline without cache
      }
    }
  }, []);

  const refreshExchangeRate = useCallback(async () => {
    try {
      const res = await api.getExchangeRates();
      setCurrentRate(res.data.currentRate || DEFAULT_EXCHANGE_RATE);
    } catch {
      // keep default or cached
    }
  }, []);

  const recheckSetupStatus = useCallback(async () => {
    try {
      const status = await api.getSetupStatus();
      setHasManager(status.hasManager);
    } catch {
      // If offline during boot, check if offline session exists
      const offlineUser = await getOfflineSessionProfile();
      if (offlineUser) {
        setHasManager(true);
      }
    }
  }, []);

  const triggerSync = useCallback(async () => {
    return runPendingSync(user?.role);
  }, [user?.role]);

  // Boot session & branding
  useEffect(() => {
    let mounted = true;
    async function init() {
      await refreshPendingCount();
      try {
        const pub = await api.getPublicBranding();
        if (mounted) {
          setSettings((prev) =>
            prev || {
              id: 'public',
              systemName: pub.data.systemName,
              websiteName: pub.data.websiteName,
              companyName: pub.data.companyName,
              logoDataUrl: pub.data.logoDataUrl,
              phone: '',
              email: '',
              address: '',
              description: '',
              defaultLanguage: pub.data.defaultLanguage,
              primaryCurrency: 'USD',
              updatedAt: new Date().toISOString(),
            }
          );
        }
      } catch {
        // ignore
      }

      try {
        const status = await api.getSetupStatus();
        if (mounted) setHasManager(status.hasManager);
      } catch {
        if (mounted) setHasManager(true);
      }

      try {
        const me = await api.me();
        if (mounted) {
          setMemorySession(me.token, me.user);
          setUser(me.user);
          await saveOfflineSessionProfile(me.user);
        }
      } catch {
        // If offline and user previously authenticated on this device, restore offline read/queue session
        if (!navigator.onLine) {
          const offlineUser = await getOfflineSessionProfile();
          if (mounted && offlineUser) {
            setMemorySession(null, offlineUser);
            setUser(offlineUser);
          }
        } else {
          clearMemorySession();
        }
      } finally {
        if (mounted) setAuthLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, [refreshPendingCount]);

  // Load settings & exchange rate & run pending sync once authenticated
  useEffect(() => {
    if (!user) return;
    refreshSettings();
    refreshExchangeRate();
    if (navigator.onLine && user.role === 'ADMIN') {
      runPendingSync(user.role);
    }
  }, [user, refreshSettings, refreshExchangeRate]);

  // Connectivity & sync event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (user?.role === 'ADMIN') {
        runPendingSync(user.role);
      }
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueUpdated = () => {
      refreshPendingCount();
    };
    const handleSyncStatus = (e: Event) => {
      const detail = (e as CustomEvent<{ status: SyncStateStatus }>).detail;
      if (detail?.status) setSyncStatus(detail.status);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('msh-sync-queue-updated', handleQueueUpdated);
    window.addEventListener('msh-sync-status', handleSyncStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('msh-sync-queue-updated', handleQueueUpdated);
      window.removeEventListener('msh-sync-status', handleSyncStatus);
    };
  }, [user?.role, refreshPendingCount]);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setMemorySession(res.token, res.user);
    setUser(res.user);
    setHasManager(true);
    await saveOfflineSessionProfile(res.user);
  };

  const setupFirstManager = async (fullName: string, email: string, password: string) => {
    const res = await api.setupManager({ fullName, email, password });
    setMemorySession(res.token, res.user);
    setUser(res.user);
    setHasManager(true);
    await saveOfflineSessionProfile(res.user);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore if offline
    }
    clearMemorySession();
    await saveOfflineSessionProfile(null);
    setUser(null);
  };

  const t = getDictionary(lang);

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        hasManager,
        lang,
        t,
        settings,
        currentRate,
        isOnline,
        pendingCount,
        syncStatus,
        setLang,
        login,
        setupFirstManager,
        logout,
        refreshSettings,
        refreshExchangeRate,
        triggerSync,
        recheckSetupStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
