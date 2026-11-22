import {
  listPendingTransactions,
  removePendingTransaction,
  updatePendingTransaction,
  type PendingSyncItem,
} from '../offline/indexedDb';
import { api } from './api';

export type SyncStateStatus = 'IDLE' | 'SYNCING' | 'SYNCED' | 'FAILED';

let isSyncRunning = false;

export async function runPendingSync(userRole?: string): Promise<{
  syncedCount: number;
  failedCount: number;
}> {
  if (isSyncRunning || !navigator.onLine) {
    return { syncedCount: 0, failedCount: 0 };
  }
  if (userRole && userRole !== 'ADMIN') {
    return { syncedCount: 0, failedCount: 0 };
  }

  const pending = await listPendingTransactions();
  if (pending.length === 0) {
    return { syncedCount: 0, failedCount: 0 };
  }

  isSyncRunning = true;
  window.dispatchEvent(new CustomEvent('msh-sync-status', { detail: { status: 'SYNCING' as SyncStateStatus } }));

  let syncedCount = 0;
  let failedCount = 0;

  try {
    for (const item of pending) {
      await updatePendingTransaction({ ...item, status: 'SYNCING' });
    }

    const { results } = await api.syncBatch(
      pending.map((item) => ({
        clientTransactionId: item.clientTransactionId,
        entityType: item.entityType,
        payload: item.payload,
        clientCreatedAt: item.clientCreatedAt,
      }))
    );

    const byId = new Map(pending.map((p) => [p.clientTransactionId, p]));

    for (const res of results) {
      const original = byId.get(res.clientTransactionId);
      if (!original) continue;
      if (res.status === 'SYNCED') {
        await removePendingTransaction(res.clientTransactionId);
        syncedCount += 1;
      } else {
        const updated: PendingSyncItem = {
          ...original,
          status: 'FAILED',
          retryCount: original.retryCount + 1,
          lastError: res.error || 'Server rejected transaction',
        };
        await updatePendingTransaction(updated);
        failedCount += 1;
      }
    }

    // Refresh authoritative server caches after sync
    if (syncedCount > 0) {
      await Promise.allSettled([
        api.listInventory(),
        api.listCustomers(),
        api.listRentals(),
        api.listReturns(),
        api.listPayments(),
        api.listExpenses(),
        api.getDashboard(),
        api.getSyncHistory(),
      ]);
    }

    window.dispatchEvent(
      new CustomEvent('msh-sync-status', {
        detail: { status: (failedCount > 0 ? 'FAILED' : 'SYNCED') as SyncStateStatus },
      })
    );
    window.dispatchEvent(new CustomEvent('msh-sync-queue-updated'));
  } catch (err) {
    for (const item of pending) {
      await updatePendingTransaction({
        ...item,
        status: 'FAILED',
        retryCount: item.retryCount + 1,
        lastError: err instanceof Error ? err.message : 'Network error during sync',
      });
    }
    failedCount = pending.length;
    window.dispatchEvent(new CustomEvent('msh-sync-status', { detail: { status: 'FAILED' as SyncStateStatus } }));
    window.dispatchEvent(new CustomEvent('msh-sync-queue-updated'));
  } finally {
    isSyncRunning = false;
  }

  return { syncedCount, failedCount };
}
