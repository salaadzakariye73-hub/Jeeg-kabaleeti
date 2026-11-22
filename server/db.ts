import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { DEFAULT_EXCHANGE_RATE } from '../shared/calculations';
import type {
  AuditLogDTO,
  BackupRecordDTO,
  CompanySettingsDTO,
  CustomerDTO,
  ExchangeRateDTO,
  ExpenseDTO,
  InventoryItemDTO,
  PaymentDTO,
  RentalDTO,
  RentalItemDTO,
  ReturnRecordDTO,
  SyncRecordDTO,
  UserDTO,
} from '../shared/types';
import { MongoModels } from './models/mongooseModels';

export interface StoredUser extends UserDTO {
  passwordHash: string;
  createdBy?: string | null;
}

interface LocalDatabaseState {
  users: StoredUser[];
  inventory: InventoryItemDTO[];
  customers: CustomerDTO[];
  rentals: RentalDTO[];
  rentalItems: RentalItemDTO[];
  returns: ReturnRecordDTO[];
  payments: PaymentDTO[];
  expenses: ExpenseDTO[];
  exchangeRates: ExchangeRateDTO[];
  settings: CompanySettingsDTO[];
  auditLogs: AuditLogDTO[];
  syncRecords: SyncRecordDTO[];
  backups: BackupRecordDTO[];
  counters: Record<string, number>;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'msh_database.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

let usingMongo = false;
let localState: LocalDatabaseState | null = null;

function createEmptyLocalState(): LocalDatabaseState {
  return {
    users: [],
    inventory: [],
    customers: [],
    rentals: [],
    rentalItems: [],
    returns: [],
    payments: [],
    expenses: [],
    exchangeRates: [],
    settings: [],
    auditLogs: [],
    syncRecords: [],
    backups: [],
    counters: {},
  };
}

function loadLocalState(): LocalDatabaseState {
  if (localState) return localState;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<LocalDatabaseState>;
      localState = { ...createEmptyLocalState(), ...parsed };
      return localState;
    } catch {
      localState = createEmptyLocalState();
      return localState;
    }
  }
  localState = createEmptyLocalState();
  saveLocalState();
  return localState;
}

function saveLocalState(): void {
  if (!localState) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(localState, null, 2), 'utf8');
  fs.renameSync(tempFile, DB_FILE);
}

function toPlainId<T extends Record<string, unknown>>(doc: T): T & { id: string } {
  const obj = typeof (doc as { toObject?: () => Record<string, unknown> }).toObject === 'function'
    ? (doc as unknown as { toObject: () => Record<string, unknown> }).toObject()
    : { ...doc };
  const id = String(obj._id || obj.id || '');
  delete obj._id;
  delete obj.__v;
  return { ...(obj as T), id };
}

export function isMongoConnected(): boolean {
  return usingMongo;
}

export async function initDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      usingMongo = true;
      console.log('[DB] Connected to MongoDB Atlas');
    } catch (err) {
      console.error('[DB] MongoDB connection failed, falling back to local persistent store:', err);
      usingMongo = false;
      loadLocalState();
    }
  } else {
    usingMongo = false;
    loadLocalState();
    console.log('[DB] MONGODB_URI not set; using persistent local disk store (.data/msh_database.json)');
  }

  await ensureDefaultSystemRecords();
}

async function ensureDefaultSystemRecords(): Promise<void> {
  const rates = await db.getExchangeRates();
  if (rates.length === 0) {
    await db.createExchangeRate({
      rate: DEFAULT_EXCHANGE_RATE,
      effectiveFrom: new Date().toISOString(),
      changedBy: 'SYSTEM',
      changedByName: 'System Initializer',
      notes: 'Initial company rate: 1 USD = 28 SOS',
      isCurrent: true,
    });
  }

  const settings = await db.getSettings();
  if (!settings) {
    await db.upsertSettings({
      systemName: 'MSh Company',
      websiteName: 'Jeeg iyo Kabaleeti',
      companyName: 'MSh Company',
      logoDataUrl: '',
      phone: '+252 61 000 0000',
      email: 'info@mshcompany.so',
      address: 'Mogadishu, Somalia',
      description: 'Construction Equipment Rental Management System',
      defaultLanguage: 'so',
      primaryCurrency: 'USD',
    });
  }
}

export const db = {
  // Sequence IDs
  async nextCode(prefix: string, pad: number = 4): Promise<string> {
    if (usingMongo) {
      const countMap: Record<string, () => Promise<number>> = {
        KAB: () => MongoModels.Inventory.countDocuments({ category: 'KABALEETI' }),
        JEG: () => MongoModels.Inventory.countDocuments({ category: 'JEEG' }),
        CUS: () => MongoModels.Customer.countDocuments(),
        RNT: () => MongoModels.Rental.countDocuments(),
        RET: () => MongoModels.ReturnRecord.countDocuments(),
        PAY: () => MongoModels.Payment.countDocuments(),
        EXP: () => MongoModels.Expense.countDocuments(),
        BKP: () => MongoModels.BackupRecord.countDocuments(),
      };
      const baseCount = countMap[prefix] ? await countMap[prefix]() : 0;
      const randSuffix = Math.floor(10 + Math.random() * 89);
      const seq = String(baseCount + 1).padStart(pad, '0');
      return `${prefix}-${seq}-${randSuffix}`;
    }
    const state = loadLocalState();
    state.counters[prefix] = (state.counters[prefix] || 0) + 1;
    saveLocalState();
    return `${prefix}-${String(state.counters[prefix]).padStart(pad, '0')}`;
  },

  // Users
  async countManagers(): Promise<number> {
    if (usingMongo) {
      return MongoModels.User.countDocuments({ role: 'MANAGER' });
    }
    return loadLocalState().users.filter((u) => u.role === 'MANAGER').length;
  },

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const normalized = email.trim().toLowerCase();
    if (usingMongo) {
      const doc = await MongoModels.User.findOne({ email: normalized });
      return doc ? (toPlainId(doc) as unknown as StoredUser) : null;
    }
    return loadLocalState().users.find((u) => u.email.toLowerCase() === normalized) || null;
  },

  async findUserById(id: string): Promise<StoredUser | null> {
    if (usingMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongoModels.User.findById(id);
      return doc ? (toPlainId(doc) as unknown as StoredUser) : null;
    }
    return loadLocalState().users.find((u) => u.id === id) || null;
  },

  async listUsers(): Promise<UserDTO[]> {
    if (usingMongo) {
      const docs = await MongoModels.User.find().sort({ createdAt: -1 });
      return docs.map((d) => {
        const plain = toPlainId(d) as unknown as StoredUser;
        const { passwordHash: _, ...safe } = plain;
        return safe;
      });
    }
    return loadLocalState().users
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ passwordHash: _, ...safe }) => safe);
  },

  async createUser(input: Omit<StoredUser, 'id' | 'createdAt'>): Promise<UserDTO> {
    if (usingMongo) {
      const doc = await MongoModels.User.create(input);
      const plain = toPlainId(doc) as unknown as StoredUser;
      const { passwordHash: _, ...safe } = plain;
      return safe;
    }
    const state = loadLocalState();
    const record: StoredUser = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    state.users.push(record);
    saveLocalState();
    const { passwordHash: _, ...safe } = record;
    return safe;
  },

  async updateUser(id: string, patch: Partial<StoredUser>): Promise<UserDTO | null> {
    if (usingMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongoModels.User.findByIdAndUpdate(id, patch, { new: true });
      if (!doc) return null;
      const plain = toPlainId(doc) as unknown as StoredUser;
      const { passwordHash: _, ...safe } = plain;
      return safe;
    }
    const state = loadLocalState();
    const idx = state.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    state.users[idx] = { ...state.users[idx], ...patch };
    saveLocalState();
    const { passwordHash: _, ...safe } = state.users[idx];
    return safe;
  },

  // Inventory
  async listInventory(): Promise<InventoryItemDTO[]> {
    if (usingMongo) {
      const docs = await MongoModels.Inventory.find({ isArchived: { $ne: true } }).sort({ createdAt: -1 });
      return docs.map((d) => toPlainId(d) as unknown as InventoryItemDTO);
    }
    return loadLocalState().inventory
      .filter((i) => !i.isArchived)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async findInventoryById(id: string): Promise<InventoryItemDTO | null> {
    if (usingMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongoModels.Inventory.findById(id);
      return doc ? (toPlainId(doc) as unknown as InventoryItemDTO) : null;
    }
    return loadLocalState().inventory.find((i) => i.id === id) || null;
  },

  async createInventory(input: Omit<InventoryItemDTO, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItemDTO> {
    if (usingMongo) {
      const doc = await MongoModels.Inventory.create(input);
      return toPlainId(doc) as unknown as InventoryItemDTO;
    }
    const state = loadLocalState();
    const now = new Date().toISOString();
    const item: InventoryItemDTO = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    state.inventory.push(item);
    saveLocalState();
    return item;
  },

  async updateInventory(id: string, patch: Partial<InventoryItemDTO>): Promise<InventoryItemDTO | null> {
    if (usingMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongoModels.Inventory.findByIdAndUpdate(id, patch, { new: true });
      return doc ? (toPlainId(doc) as unknown as InventoryItemDTO) : null;
    }
    const state = loadLocalState();
    const idx = state.inventory.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    state.inventory[idx] = { ...state.inventory[idx], ...patch, updatedAt: new Date().toISOString() };
    saveLocalState();
    return state.inventory[idx];
  },

  // Customers
  async listCustomers(search?: string): Promise<CustomerDTO[]> {
    if (usingMongo) {
      const filter: Record<string, unknown> = { isArchived: { $ne: true } };
      if (search && search.trim()) {
        const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(escaped, 'i');
        filter.$or = [{ fullName: rx }, { phone: rx }, { customerId: rx }, { siteLocation: rx }];
      }
      const docs = await MongoModels.Customer.find(filter).sort({ createdAt: -1 });
      return docs.map((d) => toPlainId(d) as unknown as CustomerDTO);
    }
    let items = loadLocalState().customers.filter((c) => !c.isArchived);
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.customerId.toLowerCase().includes(q) ||
          c.siteLocation.toLowerCase().includes(q)
      );
    }
    return items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async findCustomerById(id: string): Promise<CustomerDTO | null> {
    if (usingMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongoModels.Customer.findById(id);
      return doc ? (toPlainId(doc) as unknown as CustomerDTO) : null;
    }
    return loadLocalState().customers.find((c) => c.id === id) || null;
  },

  async findCustomerByPhone(phone: string): Promise<CustomerDTO | null> {
    const clean = phone.trim();
    if (usingMongo) {
      const doc = await MongoModels.Customer.findOne({ phone: clean, isArchived: { $ne: true } });
      return doc ? (toPlainId(doc) as unknown as CustomerDTO) : null;
    }
    return loadLocalState().customers.find((c) => c.phone.trim() === clean && !c.isArchived) || null;
  },

  async createCustomer(input: Omit<CustomerDTO, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomerDTO> {
    if (usingMongo) {
      const doc = await MongoModels.Customer.create(input);
      return toPlainId(doc) as unknown as CustomerDTO;
    }
    const state = loadLocalState();
    const now = new Date().toISOString();
    const customer: CustomerDTO = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    state.customers.push(customer);
    saveLocalState();
    return customer;
  },

  async updateCustomer(id: string, patch: Partial<CustomerDTO>): Promise<CustomerDTO | null> {
    if (usingMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongoModels.Customer.findByIdAndUpdate(id, patch, { new: true });
      return doc ? (toPlainId(doc) as unknown as CustomerDTO) : null;
    }
    const state = loadLocalState();
    const idx = state.customers.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    state.customers[idx] = { ...state.customers[idx], ...patch, updatedAt: new Date().toISOString() };
    saveLocalState();
    return state.customers[idx];
  },

  // Rentals
  async listRentals(): Promise<RentalDTO[]> {
    if (usingMongo) {
      const docs = await MongoModels.Rental.find().sort({ createdAt: -1 });
      return docs.map((d) => toPlainId(d) as unknown as RentalDTO);
    }
    return loadLocalState().rentals.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async findRentalById(id: string): Promise<RentalDTO | null> {
    if (usingMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongoModels.Rental.findById(id);
      return doc ? (toPlainId(doc) as unknown as RentalDTO) : null;
    }
    return loadLocalState().rentals.find((r) => r.id === id) || null;
  },

  async findRentalByClientTx(clientTransactionId: string): Promise<RentalDTO | null> {
    if (!clientTransactionId) return null;
    if (usingMongo) {
      const doc = await MongoModels.Rental.findOne({ clientTransactionId });
      return doc ? (toPlainId(doc) as unknown as RentalDTO) : null;
    }
    return loadLocalState().rentals.find((r) => r.clientTransactionId === clientTransactionId) || null;
  },

  async createRental(
    input: Omit<RentalDTO, 'id' | 'createdAt' | 'updatedAt'>,
    itemInput: Omit<RentalItemDTO, 'id' | 'rentalId' | 'createdAt'>
  ): Promise<RentalDTO> {
    if (usingMongo) {
      const doc = await MongoModels.Rental.create(input);
      const rental = toPlainId(doc) as unknown as RentalDTO;
      await MongoModels.RentalItem.create({ ...itemInput, rentalId: rental.id });
      return rental;
    }
    const state = loadLocalState();
    const now = new Date().toISOString();
    const rental: RentalDTO = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    state.rentals.push(rental);
    state.rentalItems.push({ ...itemInput, id: crypto.randomUUID(), rentalId: rental.id, createdAt: now });
    saveLocalState();
    return rental;
  },

  async updateRental(id: string, patch: Partial<RentalDTO>): Promise<RentalDTO | null> {
    if (usingMongo) {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongoModels.Rental.findByIdAndUpdate(id, patch, { new: true });
      return doc ? (toPlainId(doc) as unknown as RentalDTO) : null;
    }
    const state = loadLocalState();
    const idx = state.rentals.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    state.rentals[idx] = { ...state.rentals[idx], ...patch, updatedAt: new Date().toISOString() };
    saveLocalState();
    return state.rentals[idx];
  },

  // Returns
  async listReturns(): Promise<ReturnRecordDTO[]> {
    if (usingMongo) {
      const docs = await MongoModels.ReturnRecord.find().sort({ createdAt: -1 });
      return docs.map((d) => toPlainId(d) as unknown as ReturnRecordDTO);
    }
    return loadLocalState().returns.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async findReturnByClientTx(clientTransactionId: string): Promise<ReturnRecordDTO | null> {
    if (!clientTransactionId) return null;
    if (usingMongo) {
      const doc = await MongoModels.ReturnRecord.findOne({ clientTransactionId });
      return doc ? (toPlainId(doc) as unknown as ReturnRecordDTO) : null;
    }
    return loadLocalState().returns.find((r) => r.clientTransactionId === clientTransactionId) || null;
  },

  async createReturn(input: Omit<ReturnRecordDTO, 'id' | 'createdAt'>): Promise<ReturnRecordDTO> {
    if (usingMongo) {
      const doc = await MongoModels.ReturnRecord.create(input);
      return toPlainId(doc) as unknown as ReturnRecordDTO;
    }
    const state = loadLocalState();
    const record: ReturnRecordDTO = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    state.returns.push(record);
    saveLocalState();
    return record;
  },

  // Payments
  async listPayments(): Promise<PaymentDTO[]> {
    if (usingMongo) {
      const docs = await MongoModels.Payment.find().sort({ createdAt: -1 });
      return docs.map((d) => toPlainId(d) as unknown as PaymentDTO);
    }
    return loadLocalState().payments.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async findPaymentByClientTx(clientTransactionId: string): Promise<PaymentDTO | null> {
    if (!clientTransactionId) return null;
    if (usingMongo) {
      const doc = await MongoModels.Payment.findOne({ clientTransactionId });
      return doc ? (toPlainId(doc) as unknown as PaymentDTO) : null;
    }
    return loadLocalState().payments.find((p) => p.clientTransactionId === clientTransactionId) || null;
  },

  async createPayment(input: Omit<PaymentDTO, 'id' | 'createdAt'>): Promise<PaymentDTO> {
    if (usingMongo) {
      const doc = await MongoModels.Payment.create(input);
      return toPlainId(doc) as unknown as PaymentDTO;
    }
    const state = loadLocalState();
    const record: PaymentDTO = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    state.payments.push(record);
    saveLocalState();
    return record;
  },

  // Expenses
  async listExpenses(): Promise<ExpenseDTO[]> {
    if (usingMongo) {
      const docs = await MongoModels.Expense.find().sort({ createdAt: -1 });
      return docs.map((d) => toPlainId(d) as unknown as ExpenseDTO);
    }
    return loadLocalState().expenses.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async findExpenseByClientTx(clientTransactionId: string): Promise<ExpenseDTO | null> {
    if (!clientTransactionId) return null;
    if (usingMongo) {
      const doc = await MongoModels.Expense.findOne({ clientTransactionId });
      return doc ? (toPlainId(doc) as unknown as ExpenseDTO) : null;
    }
    return loadLocalState().expenses.find((e) => e.clientTransactionId === clientTransactionId) || null;
  },

  async createExpense(input: Omit<ExpenseDTO, 'id' | 'createdAt'>): Promise<ExpenseDTO> {
    if (usingMongo) {
      const doc = await MongoModels.Expense.create(input);
      return toPlainId(doc) as unknown as ExpenseDTO;
    }
    const state = loadLocalState();
    const record: ExpenseDTO = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    state.expenses.push(record);
    saveLocalState();
    return record;
  },

  // Exchange Rates
  async getExchangeRates(): Promise<ExchangeRateDTO[]> {
    if (usingMongo) {
      const docs = await MongoModels.ExchangeRate.find().sort({ createdAt: -1 });
      return docs.map((d) => toPlainId(d) as unknown as ExchangeRateDTO);
    }
    return loadLocalState().exchangeRates.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getCurrentExchangeRate(): Promise<number> {
    const rates = await this.getExchangeRates();
    const current = rates.find((r) => r.isCurrent) || rates[0];
    return current ? current.rate : DEFAULT_EXCHANGE_RATE;
  },

  async createExchangeRate(input: Omit<ExchangeRateDTO, 'id' | 'createdAt'>): Promise<ExchangeRateDTO> {
    if (usingMongo) {
      await MongoModels.ExchangeRate.updateMany({ isCurrent: true }, { isCurrent: false });
      const doc = await MongoModels.ExchangeRate.create(input);
      return toPlainId(doc) as unknown as ExchangeRateDTO;
    }
    const state = loadLocalState();
    state.exchangeRates = state.exchangeRates.map((r) => ({ ...r, isCurrent: false }));
    const record: ExchangeRateDTO = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    state.exchangeRates.push(record);
    saveLocalState();
    return record;
  },

  // Settings
  async getSettings(): Promise<CompanySettingsDTO | null> {
    if (usingMongo) {
      const doc = await MongoModels.CompanySettings.findOne();
      return doc ? (toPlainId(doc) as unknown as CompanySettingsDTO) : null;
    }
    return loadLocalState().settings[0] || null;
  },

  async upsertSettings(
    patch: Partial<Omit<CompanySettingsDTO, 'id' | 'updatedAt'>> & { updatedBy?: string }
  ): Promise<CompanySettingsDTO> {
    if (usingMongo) {
      const existing = await MongoModels.CompanySettings.findOne();
      if (existing) {
        Object.assign(existing, patch);
        await existing.save();
        return toPlainId(existing) as unknown as CompanySettingsDTO;
      }
      const doc = await MongoModels.CompanySettings.create(patch);
      return toPlainId(doc) as unknown as CompanySettingsDTO;
    }
    const state = loadLocalState();
    const now = new Date().toISOString();
    if (state.settings[0]) {
      state.settings[0] = { ...state.settings[0], ...patch, updatedAt: now };
    } else {
      state.settings[0] = {
        id: crypto.randomUUID(),
        systemName: 'MSh Company',
        websiteName: 'Jeeg iyo Kabaleeti',
        companyName: 'MSh Company',
        logoDataUrl: '',
        phone: '+252 61 000 0000',
        email: 'info@mshcompany.so',
        address: 'Mogadishu, Somalia',
        description: 'Construction Equipment Rental Management System',
        defaultLanguage: 'so',
        primaryCurrency: 'USD',
        ...patch,
        updatedAt: now,
      };
    }
    saveLocalState();
    return state.settings[0];
  },

  // Audit Logs (immutable append-only)
  async listAuditLogs(limit: number = 200): Promise<AuditLogDTO[]> {
    if (usingMongo) {
      const docs = await MongoModels.AuditLog.find().sort({ createdAt: -1 }).limit(limit);
      return docs.map((d) => toPlainId(d) as unknown as AuditLogDTO);
    }
    return loadLocalState().auditLogs
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },

  async appendAuditLog(input: Omit<AuditLogDTO, 'id' | 'createdAt'>): Promise<AuditLogDTO> {
    if (usingMongo) {
      const doc = await MongoModels.AuditLog.create(input);
      return toPlainId(doc) as unknown as AuditLogDTO;
    }
    const state = loadLocalState();
    const entry: AuditLogDTO = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    state.auditLogs.push(entry);
    saveLocalState();
    return entry;
  },

  // Sync History
  async listSyncRecords(limit: number = 100): Promise<SyncRecordDTO[]> {
    if (usingMongo) {
      const docs = await MongoModels.SyncRecord.find().sort({ syncedAt: -1 }).limit(limit);
      return docs.map((d) => toPlainId(d) as unknown as SyncRecordDTO);
    }
    return loadLocalState().syncRecords
      .slice()
      .sort((a, b) => b.syncedAt.localeCompare(a.syncedAt))
      .slice(0, limit);
  },

  async recordSync(input: Omit<SyncRecordDTO, 'id'>): Promise<SyncRecordDTO> {
    if (usingMongo) {
      const existing = await MongoModels.SyncRecord.findOne({ clientTransactionId: input.clientTransactionId });
      if (existing) {
        Object.assign(existing, input);
        await existing.save();
        return toPlainId(existing) as unknown as SyncRecordDTO;
      }
      const doc = await MongoModels.SyncRecord.create(input);
      return toPlainId(doc) as unknown as SyncRecordDTO;
    }
    const state = loadLocalState();
    const idx = state.syncRecords.findIndex((s) => s.clientTransactionId === input.clientTransactionId);
    const record: SyncRecordDTO = { ...input, id: idx >= 0 ? state.syncRecords[idx].id : crypto.randomUUID() };
    if (idx >= 0) state.syncRecords[idx] = record;
    else state.syncRecords.push(record);
    saveLocalState();
    return record;
  },

  // Backups
  async listBackups(limit: number = 30): Promise<BackupRecordDTO[]> {
    if (usingMongo) {
      const docs = await MongoModels.BackupRecord.find().sort({ createdAt: -1 }).limit(limit);
      return docs.map((d) => toPlainId(d) as unknown as BackupRecordDTO);
    }
    return loadLocalState().backups
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },

  async runAutomaticBackup(triggerType: BackupRecordDTO['triggerType']): Promise<BackupRecordDTO> {
    const [inventory, customers, rentals, returns, payments, expenses, exchangeRates] = await Promise.all([
      this.listInventory(),
      this.listCustomers(),
      this.listRentals(),
      this.listReturns(),
      this.listPayments(),
      this.listExpenses(),
      this.getExchangeRates(),
    ]);

    const snapshot = {
      timestamp: new Date().toISOString(),
      inventory,
      customers,
      rentals,
      returns,
      payments,
      expenses,
      exchangeRates,
    };
    const serialized = JSON.stringify(snapshot);
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');

    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const backupId = await this.nextCode('BKP', 4);
    const filename = `${backupId}_${Date.now()}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filePath, serialized, 'utf8');

    // Retain last 25 backup files on disk
    const files = fs.readdirSync(BACKUP_DIR).sort();
    if (files.length > 25) {
      for (const old of files.slice(0, files.length - 25)) {
        fs.unlinkSync(path.join(BACKUP_DIR, old));
      }
    }

    const recordCounts = {
      inventory: inventory.length,
      customers: customers.length,
      rentals: rentals.length,
      returns: returns.length,
      payments: payments.length,
      expenses: expenses.length,
    };

    if (usingMongo) {
      const doc = await MongoModels.BackupRecord.create({
        backupId,
        triggerType,
        storageLocation: `.data/backups/${filename}`,
        recordCounts,
        checksum,
        status: 'COMPLETED',
      });
      return toPlainId(doc) as unknown as BackupRecordDTO;
    }

    const state = loadLocalState();
    const record: BackupRecordDTO = {
      id: crypto.randomUUID(),
      backupId,
      triggerType,
      storageLocation: `.data/backups/${filename}`,
      recordCounts,
      checksum,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };
    state.backups.push(record);
    saveLocalState();
    return record;
  },
};
