import { AlertTriangle, CheckCircle2, Info, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import type { SyncRecordDTO } from '../../shared/types';
import { useApp } from '../context/AppContext';
import { listPendingTransactions, type PendingSyncItem } from '../offline/indexedDb';
import { api } from '../services/api';

export const SyncCenterPage: React.FC = () => {
  const { user, t, isOnline, syncStatus, triggerSync } = useApp();
  const isAdmin = user?.role === 'ADMIN';

  const [pending, setPending] = useState<PendingSyncItem[]>([]);
  const [history, setHistory] = useState<SyncRecordDTO[]>([]);
  const [syncResultMsg, setSyncResultMsg] = useState('');

  const loadSyncData = useCallback(async () => {
    const items = await listPendingTransactions();
    setPending(items);
    try {
      const histRes = await api.getSyncHistory();
      setHistory(histRes.data);
    } catch {
      // keep existing or offline
    }
  }, []);

  useEffect(() => {
    loadSyncData();
    const onQueueUpdate = () => loadSyncData();
    window.addEventListener('msh-sync-queue-updated', onQueueUpdate);
    return () => window.removeEventListener('msh-sync-queue-updated', onQueueUpdate);
  }, [loadSyncData]);

  const handleSyncNow = async () => {
    setSyncResultMsg('');
    const { syncedCount, failedCount } = await triggerSync();
    setSyncResultMsg(
      `${t.app.synchronized}: ${syncedCount} · ${t.app.syncFailed}: ${failedCount}`
    );
    await loadSyncData();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-[#238653]" />
            ) : (
              <WifiOff className="w-5 h-5 text-[#E5A12A]" />
            )}
            <h2 className="text-lg font-bold text-[#202B38]">{t.sync.title}</h2>
          </div>
          <p className="text-xs text-slate-600">
            Status:{' '}
            <strong className="text-[#172B42]">
              {!isOnline
                ? t.app.offlineMode
                : syncStatus === 'SYNCING'
                ? t.app.synchronizing
                : pending.length > 0
                ? `${t.app.pendingSync} (${pending.length})`
                : t.app.synchronized}
            </strong>
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            disabled={!isOnline || pending.length === 0 || syncStatus === 'SYNCING'}
            onClick={handleSyncNow}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E58A24] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#cf7a1b] disabled:opacity-50 min-h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 ${syncStatus === 'SYNCING' ? 'animate-spin' : ''}`} />
            <span>{t.sync.syncNow}</span>
          </button>
        )}
      </div>

      {/* Honest browser/OS limitation note */}
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <Info className="w-4 h-4 text-[#245B91] shrink-0 mt-0.5" />
        <span>{t.sync.limitationNote}</span>
      </div>

      {syncResultMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-[#238653]/30 bg-[#238653]/10 p-4 text-sm text-[#238653] font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncResultMsg}</span>
        </div>
      )}

      {/* Pending Offline Queue */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-[#202B38]">{t.sync.pendingTitle}</h3>
        </div>
        {pending.length === 0 ? (
          <p className="p-6 text-xs text-slate-500 text-center">{t.sync.noPending}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {pending.map((item) => (
              <div key={item.clientTransactionId} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div>
                  <p className="font-bold text-[#202B38]">
                    {item.entityType} · {item.displaySummary}
                  </p>
                  <p className="font-mono-tabular text-slate-500">
                    TxID: {item.clientTransactionId} · {item.clientCreatedAt.slice(0, 19).replace('T', ' ')}
                  </p>
                  {item.lastError && (
                    <p className="mt-1 flex items-center gap-1 text-[#D64545] font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.lastError}</span>
                    </p>
                  )}
                </div>
                <span
                  className={`font-semibold ${
                    item.status === 'FAILED' ? 'text-[#D64545]' : 'text-[#E58A24]'
                  }`}
                >
                  {item.status} (retries: {item.retryCount})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-[#202B38]">{t.sync.historyTitle}</h3>
        </div>
        {history.length === 0 ? (
          <p className="p-6 text-xs text-slate-500 text-center">{t.app.noData}</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {history.map((h) => (
              <div key={h.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#202B38]">
                    {h.entityType} · {h.serverEntityId || h.clientTransactionId}
                  </p>
                  <p className="font-mono-tabular text-slate-500">
                    {h.syncedAt.slice(0, 19).replace('T', ' ')}
                  </p>
                  {h.errorMessage && <p className="text-[#D64545]">{h.errorMessage}</p>}
                </div>
                <span
                  className={`font-semibold ${
                    h.status === 'SYNCED' ? 'text-[#238653]' : 'text-[#D64545]'
                  }`}
                >
                  {h.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
