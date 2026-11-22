import { openDB, type IDBPDatabase } from 'idb';
import type { UserDTO } from '../../shared/types';

export type OfflineEntityType = 'RENTAL' | 'RETURN' | 'PAYMENT' | 'EXPENSE';

export interface PendingSyncItem {
  clientTransactionId: string;
  entityType: OfflineEntityType;
  payload: Record<string, unknown>;
  clientCreatedAt: string;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  retryCount: number;
  lastError?: string;
  displaySummary: string;
}

const DB_NAME = 'msh_jeeg_kabaleeti_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
        if (!db.objectStoreNames.contains('pendingQueue')) {
          db.createObjectStore('pendingQueue', { keyPath: 'clientTransactionId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function setCachedValue<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDb();
    await db.put('cache', value, key);
  } catch (err) {
    console.warn('[IndexedDB] Cache write skipped:', err);
  }
}

export async function getCachedValue<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    const val = await db.get('cache', key);
    return (val as T) ?? null;
  } catch {
    return null;
  }
}

export async function saveOfflineSessionProfile(user: UserDTO | null): Promise<void> {
  if (!user) {
    try {
      const db = await getDb();
      await db.delete('cache', 'sessionProfile');
    } catch {
      // ignore
    }
    return;
  }
  // Never store passwords or secrets in IndexedDB
  await setCachedValue('sessionProfile', {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  });
}

export async function getOfflineSessionProfile(): Promise<UserDTO | null> {
  return getCachedValue<UserDTO>('sessionProfile');
}

export async function enqueueOfflineTransaction(item: PendingSyncItem): Promise<void> {
  const db = await getDb();
  await db.put('pendingQueue', item);
}

export async function listPendingTransactions(): Promise<PendingSyncItem[]> {
  try {
    const db = await getDb();
    const all = (await db.getAll('pendingQueue')) as PendingSyncItem[];
    return all.sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt));
  } catch {
    return [];
  }
}

export async function updatePendingTransaction(item: PendingSyncItem): Promise<void> {
  const db = await getDb();
  await db.put('pendingQueue', item);
}

export async function removePendingTransaction(clientTransactionId: string): Promise<void> {
  const db = await getDb();
  await db.delete('pendingQueue', clientTransactionId);
}
