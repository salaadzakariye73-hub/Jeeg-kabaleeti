import {
  calculateRentalAmounts,
  calculateRentalDays,
  convertToUsd,
  DEFAULT_EXCHANGE_RATE,
  round2,
} from '../../shared/calculations';
import type {
  AuditLogDTO,
  BackupRecordDTO,
  CompanySettingsDTO,
  CustomerDTO,
  DashboardSummaryDTO,
  ExchangeRateDTO,
  ExpenseDTO,
  InventoryItemDTO,
  PaymentDTO,
  RentalDTO,
  ReturnRecordDTO,
  SyncRecordDTO,
  UserDTO,
  UserRole,
} from '../../shared/types';
import {
  enqueueOfflineTransaction,
  getCachedValue,
  setCachedValue,
  type OfflineEntityType,
} from '../offline/indexedDb';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

let memoryToken: string | null = null;
let memoryUserRole: UserRole | null = null;
let memoryUserId: string | null = null;
let memoryUserName: string | null = null;

export function setMemorySession(token: string | null, user: UserDTO | null): void {
  memoryToken = token;
  memoryUserRole = user?.role ?? null;
  memoryUserId = user?.id ?? null;
  memoryUserName = user?.fullName ?? null;
}

export function clearMemorySession(): void {
  memoryToken = null;
  memoryUserRole = null;
  memoryUserId = null;
  memoryUserName = null;
}

export class ApiError extends Error {
  status: number;
  isNetworkError: boolean;
  constructor(message: string, status = 400, isNetworkError = false) {
    super(message);
    this.status = status;
    this.isNetworkError = isNetworkError;
  }
}

export async function rawRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'MShRentalApp',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (memoryToken) {
    headers['Authorization'] = `Bearer ${memoryToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Network unreachable', 0, true);
  }

  const json = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));
  if (!res.ok || !json.success) {
    throw new ApiError(json.error || `Request failed (${res.status})`, res.status, false);
  }
  return json.data as T;
}

async function cachedGet<T>(cacheKey: string, path: string): Promise<{ data: T; fromCache: boolean }> {
  try {
    const data = await rawRequest<T>(path);
    await setCachedValue(cacheKey, data);
    return { data, fromCache: false };
  } catch (err) {
    if (err instanceof ApiError && err.isNetworkError) {
      const cached = await getCachedValue<T>(cacheKey);
      if (cached !== null) {
        return { data: cached, fromCache: true };
      }
    }
    throw err;
  }
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function queueOfflineMutation(
  entityType: OfflineEntityType,
  payload: Record<string, unknown>,
  displaySummary: string
): Promise<string> {
  if (memoryUserRole !== 'ADMIN') {
    throw new ApiError('Manager accounts are strictly read-only, including offline.', 403);
  }
  const clientTransactionId = makeUuid();
  const clientCreatedAt = new Date().toISOString();
  await enqueueOfflineTransaction({
    clientTransactionId,
    entityType,
    payload: { ...payload, clientTransactionId },
    clientCreatedAt,
    status: 'PENDING',
    retryCount: 0,
    displaySummary,
  });
  window.dispatchEvent(new CustomEvent('msh-sync-queue-updated'));
  return clientTransactionId;
}

export const api = {
  // Public & Auth
  getPublicBranding: () =>
    cachedGet<{
      systemName: string;
      websiteName: string;
      companyName: string;
      logoDataUrl: string;
      defaultLanguage: 'so' | 'en';
    }>('publicBranding', '/api/public/branding'),

  getSetupStatus: () => rawRequest<{ hasManager: boolean }>('/api/auth/setup-status'),

  setupManager: (body: { fullName: string; email: string; password: string }) =>
    rawRequest<{ token: string; user: UserDTO }>('/api/auth/setup-manager', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    rawRequest<{ token: string; user: UserDTO }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () => rawRequest<{ loggedOut: boolean }>('/api/auth/logout', { method: 'POST' }),

  me: () => rawRequest<{ user: UserDTO; token: string }>('/api/auth/me'),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    rawRequest<{ updated: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Users (Manager only)
  listUsers: () => rawRequest<UserDTO[]>('/api/users'),
  createAdmin: (body: { fullName: string; email: string; password: string }) =>
    rawRequest<UserDTO>('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  toggleAdminStatus: (id: string, isActive: boolean) =>
    rawRequest<UserDTO>(`/api/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  // Dashboard
  getDashboard: async (startDate?: string, endDate?: string) => {
    const qs = new URLSearchParams();
    if (startDate) qs.set('startDate', startDate);
    if (endDate) qs.set('endDate', endDate);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return cachedGet<DashboardSummaryDTO>('dashboard', `/api/dashboard${suffix}`);
  },

  // Inventory
  listInventory: () => cachedGet<InventoryItemDTO[]>('inventory', '/api/inventory'),
  createInventory: (body: Record<string, unknown>) =>
    rawRequest<InventoryItemDTO>('/api/inventory', { method: 'POST', body: JSON.stringify(body) }),
  adjustInventory: (id: string, body: Record<string, unknown>) =>
    rawRequest<InventoryItemDTO>(`/api/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // Customers
  listCustomers: async (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await cachedGet<CustomerDTO[]>('customers', `/api/customers${qs}`);
    if (res.fromCache && search && search.trim()) {
      const q = search.trim().toLowerCase();
      return {
        ...res,
        data: res.data.filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.customerId.toLowerCase().includes(q)
        ),
      };
    }
    return res;
  },
  getCustomerProfile: async (id: string) => {
    try {
      const data = await rawRequest<{
        customer: CustomerDTO;
        rentals: RentalDTO[];
        returns: ReturnRecordDTO[];
        payments: PaymentDTO[];
        expenses: ExpenseDTO[];
        summary: {
          totalEquipmentRented: number;
          totalEquipmentReturned: number;
          remainingEquipment: number;
          totalRentalChargesUsd: number;
          customerChargedExpensesUsd: number;
          totalAmountDueUsd: number;
          paymentsReceivedUsd: number;
          outstandingBalanceUsd: number;
        };
      }>(`/api/customers/${id}/profile`);
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        // Compute profile locally from IndexedDB cache while offline
        const [customers, rentals, returns, payments, expenses] = await Promise.all([
          getCachedValue<CustomerDTO[]>('customers'),
          getCachedValue<RentalDTO[]>('rentals'),
          getCachedValue<ReturnRecordDTO[]>('returns'),
          getCachedValue<PaymentDTO[]>('payments'),
          getCachedValue<ExpenseDTO[]>('expenses'),
        ]);
        const customer = (customers || []).find((c) => c.id === id);
        if (!customer) throw err;
        const cRentals = (rentals || []).filter((r) => r.customerId === id);
        const cReturns = (returns || []).filter((r) => r.customerId === id);
        const cPayments = (payments || []).filter((p) => p.customerId === id);
        const rIds = new Set(cRentals.map((r) => r.id));
        const cExpenses = (expenses || []).filter(
          (e) => e.customerId === id || (e.rentalId && rIds.has(e.rentalId))
        );
        const totalEquipmentRented = cRentals.reduce((s, r) => s + r.quantityRented, 0);
        const totalEquipmentReturned = cRentals.reduce((s, r) => s + r.quantityReturned, 0);
        const remainingEquipment = cRentals.reduce((s, r) => s + r.quantityRemaining, 0);
        const totalRentalChargesUsd = round2(cRentals.reduce((s, r) => s + r.usdAmount, 0));
        const customerChargedExpensesUsd = round2(
          cExpenses.filter((e) => e.payerType === 'CUSTOMER_CHARGED').reduce((s, e) => s + e.usdAmount, 0)
        );
        const paymentsReceivedUsd = round2(cPayments.reduce((s, p) => s + p.usdAmount, 0));
        const totalAmountDueUsd = round2(totalRentalChargesUsd + customerChargedExpensesUsd);
        const outstandingBalanceUsd = round2(Math.max(0, totalAmountDueUsd - paymentsReceivedUsd));
        return {
          customer,
          rentals: cRentals,
          returns: cReturns,
          payments: cPayments,
          expenses: cExpenses,
          summary: {
            totalEquipmentRented,
            totalEquipmentReturned,
            remainingEquipment,
            totalRentalChargesUsd,
            customerChargedExpensesUsd,
            totalAmountDueUsd,
            paymentsReceivedUsd,
            outstandingBalanceUsd,
          },
        };
      }
      throw err;
    }
  },
  createCustomer: (body: Record<string, unknown>) =>
    rawRequest<CustomerDTO>('/api/customers', { method: 'POST', body: JSON.stringify(body) }),
  updateCustomer: (id: string, body: Record<string, unknown>) =>
    rawRequest<CustomerDTO>(`/api/customers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Rentals (Offline-capable for Admin)
  listRentals: () => cachedGet<RentalDTO[]>('rentals', '/api/rentals'),
  createRental: async (
    body: Record<string, unknown>
  ): Promise<{ record: RentalDTO; queuedOffline: boolean }> => {
    try {
      const record = await rawRequest<RentalDTO>('/api/rentals', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { record, queuedOffline: false };
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        const rateCache = await getCachedValue<{ currentRate: number }>('exchangeRates');
        const rate = Number(body.exchangeRateSnapshot) || rateCache?.currentRate || DEFAULT_EXCHANGE_RATE;
        const qty = Math.max(1, Math.floor(Number(body.quantityRented) || 1));
        const days = body.expectedReturnDate
          ? calculateRentalDays(String(body.startDate), String(body.expectedReturnDate))
          : Math.max(1, Math.floor(Number(body.rentalDays) || 1));
        const { originalAmount, usdAmount } = calculateRentalAmounts({
          pricingMethod: body.pricingMethod as RentalDTO['pricingMethod'],
          unitOrContractPrice: Number(body.unitOrContractPrice),
          quantityRented: qty,
          rentalDays: days,
          currency: body.currency as RentalDTO['currency'],
          exchangeRate: rate,
        });

        const inventoryList = (await getCachedValue<InventoryItemDTO[]>('inventory')) || [];
        const inv = inventoryList.find((i) => i.id === body.inventoryId);
        if (inv && inv.availableQuantity < qty) {
          throw new ApiError(`Insufficient cached stock (${inv.availableQuantity} available)`, 400);
        }

        const txId = await queueOfflineMutation(
          'RENTAL',
          { ...body, exchangeRateSnapshot: rate },
          `${String(body.customerName || 'Customer')} · ${qty} ${inv?.category || 'Equipment'} ($${usdAmount})`
        );

        const now = new Date().toISOString();
        const optimistic: RentalDTO = {
          id: txId,
          rentalId: `OFFLINE-${txId.slice(0, 6).toUpperCase()}`,
          clientTransactionId: txId,
          customerId: String(body.customerId || 'NEW'),
          customerCode: 'PENDING',
          customerName: String(body.customerName || 'Customer'),
          customerPhone: String(body.customerPhone || ''),
          siteLocation: String(body.siteLocation || ''),
          vehicleType: String(body.vehicleType || ''),
          vehiclePlate: String(body.vehiclePlate || ''),
          productCategory: inv?.category || 'KABALEETI',
          inventoryId: String(body.inventoryId || ''),
          inventoryProductId: inv?.productId || '',
          inventoryName: inv?.name || 'Equipment',
          quantityRented: qty,
          quantityReturned: 0,
          quantityDamaged: 0,
          quantityLost: 0,
          quantityRemaining: qty,
          startDate: String(body.startDate || now.slice(0, 10)),
          expectedReturnDate: body.expectedReturnDate ? String(body.expectedReturnDate) : null,
          actualReturnDate: null,
          pricingMethod: body.pricingMethod as RentalDTO['pricingMethod'],
          unitOrContractPrice: Number(body.unitOrContractPrice),
          rentalDays: days,
          currency: body.currency as RentalDTO['currency'],
          exchangeRateSnapshot: rate,
          originalAmount,
          usdAmount,
          status: 'ACTIVE',
          notes: String(body.notes || ''),
          createdBy: memoryUserId || '',
          createdByName: memoryUserName || 'Admin',
          createdAt: now,
          updatedAt: now,
          pendingSync: true,
        };

        const existingRentals = (await getCachedValue<RentalDTO[]>('rentals')) || [];
        await setCachedValue('rentals', [optimistic, ...existingRentals]);

        if (inv) {
          const updatedInv = inventoryList.map((i) =>
            i.id === inv.id
              ? {
                  ...i,
                  availableQuantity: Math.max(0, i.availableQuantity - qty),
                  rentedQuantity: i.rentedQuantity + qty,
                }
              : i
          );
          await setCachedValue('inventory', updatedInv);
        }

        return { record: optimistic, queuedOffline: true };
      }
      throw err;
    }
  },

  // Returns (Offline-capable for Admin)
  listReturns: () => cachedGet<ReturnRecordDTO[]>('returns', '/api/returns'),
  createReturn: async (
    body: Record<string, unknown>
  ): Promise<{ record: ReturnRecordDTO; queuedOffline: boolean }> => {
    try {
      const record = await rawRequest<ReturnRecordDTO>('/api/returns', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { record, queuedOffline: false };
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        const rentals = (await getCachedValue<RentalDTO[]>('rentals')) || [];
        const rental = rentals.find((r) => r.id === body.rentalId);
        if (!rental) throw new ApiError('Rental not found in offline cache', 404);
        const good = Math.floor(Number(body.quantityReturnedGood) || 0);
        const damaged = Math.floor(Number(body.damagedQuantity) || 0);
        const lost = Math.floor(Number(body.lostQuantity) || 0);
        const total = good + damaged + lost;
        if (total <= 0 || total > rental.quantityRemaining) {
          throw new ApiError('Invalid return quantity against remaining equipment', 400);
        }

        const txId = await queueOfflineMutation(
          'RETURN',
          body,
          `${rental.rentalId} · ${total} returned`
        );
        const remaining = rental.quantityRemaining - total;
        const now = new Date().toISOString();
        const optimistic: ReturnRecordDTO = {
          id: txId,
          returnId: `OFFLINE-${txId.slice(0, 6).toUpperCase()}`,
          clientTransactionId: txId,
          rentalId: rental.id,
          rentalCode: rental.rentalId,
          customerId: rental.customerId,
          customerName: rental.customerName,
          productCategory: rental.productCategory,
          inventoryId: rental.inventoryId,
          originalQuantity: rental.quantityRented,
          quantityReturnedGood: good,
          damagedQuantity: damaged,
          lostQuantity: lost,
          remainingAfterReturn: remaining,
          returnDate: String(body.returnDate || now.slice(0, 10)),
          condition: (body.condition as ReturnRecordDTO['condition']) || 'GOOD',
          notes: String(body.notes || ''),
          createdBy: memoryUserId || '',
          createdByName: memoryUserName || 'Admin',
          createdAt: now,
          pendingSync: true,
        };

        const existingReturns = (await getCachedValue<ReturnRecordDTO[]>('returns')) || [];
        await setCachedValue('returns', [optimistic, ...existingReturns]);

        const updatedRentals = rentals.map((r) =>
          r.id === rental.id
            ? {
                ...r,
                quantityReturned: r.quantityReturned + good,
                quantityDamaged: r.quantityDamaged + damaged,
                quantityLost: r.quantityLost + lost,
                quantityRemaining: remaining,
                status: remaining === 0 ? ('COMPLETED' as const) : ('PARTIAL_RETURN' as const),
              }
            : r
        );
        await setCachedValue('rentals', updatedRentals);

        return { record: optimistic, queuedOffline: true };
      }
      throw err;
    }
  },

  // Payments (Offline-capable for Admin)
  listPayments: () => cachedGet<PaymentDTO[]>('payments', '/api/payments'),
  createPayment: async (
    body: Record<string, unknown>
  ): Promise<{ record: PaymentDTO; queuedOffline: boolean }> => {
    try {
      const record = await rawRequest<PaymentDTO>('/api/payments', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { record, queuedOffline: false };
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        const rateCache = await getCachedValue<{ currentRate: number }>('exchangeRates');
        const rate = Number(body.exchangeRateSnapshot) || rateCache?.currentRate || DEFAULT_EXCHANGE_RATE;
        const amount = Number(body.amount);
        const currency = (body.currency as PaymentDTO['currency']) || 'USD';
        const usdAmount = convertToUsd(amount, currency, rate);
        const customers = (await getCachedValue<CustomerDTO[]>('customers')) || [];
        const cust = customers.find((c) => c.id === body.customerId);

        const txId = await queueOfflineMutation(
          'PAYMENT',
          { ...body, exchangeRateSnapshot: rate },
          `${cust?.fullName || 'Customer'} · $${usdAmount}`
        );
        const now = new Date().toISOString();
        const optimistic: PaymentDTO = {
          id: txId,
          paymentId: `OFFLINE-${txId.slice(0, 6).toUpperCase()}`,
          clientTransactionId: txId,
          customerId: String(body.customerId || ''),
          customerName: cust?.fullName || 'Customer',
          rentalId: body.rentalId ? String(body.rentalId) : null,
          rentalCode: null,
          amount: round2(amount),
          currency,
          exchangeRateSnapshot: rate,
          usdAmount,
          paymentDate: String(body.paymentDate || now.slice(0, 10)),
          paymentMethod: (body.paymentMethod as PaymentDTO['paymentMethod']) || 'CASH',
          referenceNumber: String(body.referenceNumber || ''),
          notes: String(body.notes || ''),
          createdBy: memoryUserId || '',
          createdByName: memoryUserName || 'Admin',
          createdAt: now,
          pendingSync: true,
        };
        const existing = (await getCachedValue<PaymentDTO[]>('payments')) || [];
        await setCachedValue('payments', [optimistic, ...existing]);
        return { record: optimistic, queuedOffline: true };
      }
      throw err;
    }
  },

  // Expenses (Offline-capable for Admin)
  listExpenses: () => cachedGet<ExpenseDTO[]>('expenses', '/api/expenses'),
  createExpense: async (
    body: Record<string, unknown>
  ): Promise<{ record: ExpenseDTO; queuedOffline: boolean }> => {
    try {
      const record = await rawRequest<ExpenseDTO>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { record, queuedOffline: false };
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        const rateCache = await getCachedValue<{ currentRate: number }>('exchangeRates');
        const rate = Number(body.exchangeRateSnapshot) || rateCache?.currentRate || DEFAULT_EXCHANGE_RATE;
        const amount = Number(body.amount);
        const currency = (body.currency as ExpenseDTO['currency']) || 'USD';
        const usdAmount = convertToUsd(amount, currency, rate);

        const txId = await queueOfflineMutation(
          'EXPENSE',
          { ...body, exchangeRateSnapshot: rate },
          `${String(body.category)} · $${usdAmount}`
        );
        const now = new Date().toISOString();
        const optimistic: ExpenseDTO = {
          id: txId,
          expenseId: `OFFLINE-${txId.slice(0, 6).toUpperCase()}`,
          clientTransactionId: txId,
          rentalId: body.rentalId ? String(body.rentalId) : null,
          rentalCode: null,
          customerId: null,
          category: body.category as ExpenseDTO['category'],
          description: String(body.description || ''),
          amount: round2(amount),
          currency,
          exchangeRateSnapshot: rate,
          usdAmount,
          expenseDate: String(body.expenseDate || now.slice(0, 10)),
          paidByPerson: String(body.paidByPerson || ''),
          payerType: (body.payerType as ExpenseDTO['payerType']) || 'COMPANY',
          notes: String(body.notes || ''),
          createdBy: memoryUserId || '',
          createdByName: memoryUserName || 'Admin',
          createdAt: now,
          pendingSync: true,
        };
        const existing = (await getCachedValue<ExpenseDTO[]>('expenses')) || [];
        await setCachedValue('expenses', [optimistic, ...existing]);
        return { record: optimistic, queuedOffline: true };
      }
      throw err;
    }
  },

  // Exchange Rates
  getExchangeRates: () =>
    cachedGet<{ currentRate: number; history: ExchangeRateDTO[] }>('exchangeRates', '/api/exchange-rates'),
  updateExchangeRate: (body: { rate: number; notes?: string }) =>
    rawRequest<ExchangeRateDTO>('/api/exchange-rates', { method: 'POST', body: JSON.stringify(body) }),

  // Settings
  getSettings: () => cachedGet<CompanySettingsDTO>('settings', '/api/settings'),
  updateSettings: (body: Record<string, unknown>) =>
    rawRequest<CompanySettingsDTO>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),

  // Audit Logs
  listAuditLogs: () => rawRequest<AuditLogDTO[]>('/api/audit-logs'),

  // Sync
  syncBatch: (items: Array<{ clientTransactionId: string; entityType: string; payload: Record<string, unknown>; clientCreatedAt: string }>) =>
    rawRequest<{
      results: Array<{
        clientTransactionId: string;
        entityType: string;
        status: 'SYNCED' | 'FAILED';
        serverEntityId?: string;
        error?: string;
      }>;
    }>('/api/sync/batch', { method: 'POST', body: JSON.stringify({ items }) }),

  getSyncHistory: () => cachedGet<SyncRecordDTO[]>('syncHistory', '/api/sync/history'),

  // Backups
  listBackups: () =>
    rawRequest<{
      databaseEngine: string;
      scheduleIntervalHours: number;
      backups: BackupRecordDTO[];
    }>('/api/backups'),
  runBackupNow: () => rawRequest<BackupRecordDTO>('/api/backups/run', { method: 'POST' }),
};
