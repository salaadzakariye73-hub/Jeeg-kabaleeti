import bcrypt from 'bcryptjs';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { round2 } from '../shared/calculations';
import type { LanguageCode } from '../shared/types';
import { db, isMongoConnected } from './db';
import {
  clearAuthCookie,
  requireAdmin,
  requireAuth,
  requireManager,
  setAuthCookie,
  signAuthToken,
  type AuthenticatedRequest,
} from './middleware/auth';
import {
  adjustInventoryItem,
  BusinessError,
  computeEffectiveRentalStatus,
  createExpenseRecord,
  createInventoryItem,
  createPaymentRecord,
  createRentalRecord,
  createReturnRecord,
  getDashboardSummary,
} from './services/businessService';

export const apiRouter = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts. Please wait and try again.' },
});

function handleRouteError(res: express.Response, err: unknown) {
  if (err instanceof BusinessError) {
    res.status(err.status).json({ success: false, error: err.message });
    return;
  }
  console.error('[API Error]', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// Health check
apiRouter.get('/health', async (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      databaseEngine: isMongoConnected() ? 'mongodb_atlas' : 'local_persistent_store',
      timestamp: new Date().toISOString(),
    },
  });
});

// Public branding (for login / setup page)
apiRouter.get('/public/branding', async (_req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({
      success: true,
      data: {
        systemName: settings?.systemName || 'MSh Company',
        websiteName: settings?.websiteName || 'Jeeg iyo Kabaleeti',
        companyName: settings?.companyName || 'MSh Company',
        logoDataUrl: settings?.logoDataUrl || '',
        defaultLanguage: settings?.defaultLanguage || 'so',
      },
    });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Setup status (checks if first Manager exists)
apiRouter.get('/auth/setup-status', async (_req, res) => {
  try {
    const managerCount = await db.countManagers();
    res.json({ success: true, data: { hasManager: managerCount > 0 } });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// First-time Manager setup (permanently locked once 1 Manager exists)
apiRouter.post('/auth/setup-manager', authLimiter, async (req, res) => {
  try {
    const managerCount = await db.countManagers();
    if (managerCount > 0) {
      res.status(403).json({
        success: false,
        error: 'Initial Manager setup is already completed and disabled.',
      });
      return;
    }

    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!fullName || fullName.length < 2) {
      res.status(400).json({ success: false, error: 'Full name is required' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'Valid email address is required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const manager = await db.createUser({
      fullName,
      email,
      passwordHash,
      role: 'MANAGER',
      isActive: true,
      createdBy: 'INITIAL_SETUP',
      lastLoginAt: new Date().toISOString(),
    });

    await db.appendAuditLog({
      userId: manager.id,
      userName: manager.fullName,
      userRole: 'MANAGER',
      action: 'INITIAL_MANAGER_CREATED',
      entityType: 'USER',
      entityId: manager.email,
      previousValues: null,
      newValues: { role: 'MANAGER', email: manager.email },
    });

    const token = signAuthToken({
      id: manager.id,
      fullName: manager.fullName,
      email: manager.email,
      role: manager.role,
    });
    setAuthCookie(req, res, token);

    res.status(201).json({ success: true, data: { token, user: manager } });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Login
apiRouter.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: 'This account has been deactivated by the Manager.',
      });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const now = new Date().toISOString();
    await db.updateUser(user.id, { lastLoginAt: now });

    const safeUser = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: now,
      createdAt: user.createdAt,
    };

    const token = signAuthToken({
      id: safeUser.id,
      fullName: safeUser.fullName,
      email: safeUser.email,
      role: safeUser.role,
    });
    setAuthCookie(req, res, token);

    await db.appendAuditLog({
      userId: safeUser.id,
      userName: safeUser.fullName,
      userRole: safeUser.role,
      action: 'USER_LOGIN',
      entityType: 'AUTH',
      entityId: safeUser.email,
      previousValues: null,
      newValues: { role: safeUser.role },
    });

    res.json({ success: true, data: { token, user: safeUser } });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Logout
apiRouter.post('/auth/logout', async (req: AuthenticatedRequest, res) => {
  clearAuthCookie(req, res);
  res.json({ success: true, data: { loggedOut: true } });
});

// Current session
apiRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await db.findUserById(req.user!.id);
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }
    const { passwordHash: _, ...safe } = user;
    const token = signAuthToken({
      id: safe.id,
      fullName: safe.fullName,
      email: safe.email,
      role: safe.role,
    });
    res.json({ success: true, data: { user: safe, token } });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Change own password (both Manager and Admin)
apiRouter.post('/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || newPassword.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Current password and a new password (min 8 characters) are required',
      });
      return;
    }

    const user = await db.findUserById(req.user!.id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.updateUser(user.id, { passwordHash });

    await db.appendAuditLog({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: req.user!.role,
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: req.user!.email,
      previousValues: null,
      newValues: null,
    });

    res.json({ success: true, data: { updated: true } });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Manager-only: User Management (Admins only)
apiRouter.get('/users', requireAuth, requireManager, async (_req, res) => {
  try {
    const users = await db.listUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.post('/users', requireAuth, requireManager, async (req: AuthenticatedRequest, res) => {
  try {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!fullName || fullName.length < 2) {
      res.status(400).json({ success: false, error: 'Full name is required' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'Valid email address is required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      return;
    }

    const existing = await db.findUserByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // Manager can ONLY create ADMIN accounts
    const adminUser = await db.createUser({
      fullName,
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      createdBy: req.user!.id,
      lastLoginAt: null,
    });

    await db.appendAuditLog({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: 'MANAGER',
      action: 'ADMIN_ACCOUNT_CREATED',
      entityType: 'USER',
      entityId: adminUser.email,
      previousValues: null,
      newValues: { fullName: adminUser.fullName, role: 'ADMIN', isActive: true },
    });

    res.status(201).json({ success: true, data: adminUser });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.patch('/users/:id/status', requireAuth, requireManager, async (req: AuthenticatedRequest, res) => {
  try {
    const target = await db.findUserById(req.params.id);
    if (!target) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    if (target.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Manager accounts cannot be deactivated here' });
      return;
    }
    const isActive = Boolean(req.body?.isActive);
    const updated = await db.updateUser(target.id, { isActive });

    await db.appendAuditLog({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: 'MANAGER',
      action: isActive ? 'ADMIN_ACTIVATED' : 'ADMIN_DEACTIVATED',
      entityType: 'USER',
      entityId: target.email,
      previousValues: { isActive: target.isActive },
      newValues: { isActive },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Dashboard
apiRouter.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    const summary = await getDashboardSummary(startDate, endDate);
    res.json({ success: true, data: summary });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Inventory
apiRouter.get('/inventory', requireAuth, async (_req, res) => {
  try {
    const items = await db.listInventory();
    res.json({ success: true, data: items });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.post('/inventory', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const item = await createInventoryItem(req.user!, req.body || {});
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.patch('/inventory/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const item = await adjustInventoryItem(req.user!, req.params.id, req.body || {});
    res.json({ success: true, data: item });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Customers
apiRouter.get('/customers', requireAuth, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const customers = await db.listCustomers(search);
    res.json({ success: true, data: customers });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.get('/customers/:id/profile', requireAuth, async (req, res) => {
  try {
    const customer = await db.findCustomerById(req.params.id);
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }
    const [allRentals, allReturns, allPayments, allExpenses] = await Promise.all([
      db.listRentals(),
      db.listReturns(),
      db.listPayments(),
      db.listExpenses(),
    ]);

    const todayStr = new Date().toISOString().slice(0, 10);
    const rentals = allRentals
      .filter((r) => r.customerId === customer.id)
      .map((r) => ({ ...r, status: computeEffectiveRentalStatus(r, todayStr) }));
    const returns = allReturns.filter((ret) => ret.customerId === customer.id);
    const payments = allPayments.filter((p) => p.customerId === customer.id);
    const rentalIds = new Set(rentals.map((r) => r.id));
    const expenses = allExpenses.filter(
      (e) => e.customerId === customer.id || (e.rentalId && rentalIds.has(e.rentalId))
    );

    const totalEquipmentRented = rentals.reduce((s, r) => s + r.quantityRented, 0);
    const totalEquipmentReturned = rentals.reduce((s, r) => s + r.quantityReturned, 0);
    const remainingEquipment = rentals.reduce((s, r) => s + r.quantityRemaining, 0);
    const totalRentalChargesUsd = round2(rentals.reduce((s, r) => s + r.usdAmount, 0));
    const customerChargedExpensesUsd = round2(
      expenses.filter((e) => e.payerType === 'CUSTOMER_CHARGED').reduce((s, e) => s + e.usdAmount, 0)
    );
    const paymentsReceivedUsd = round2(payments.reduce((s, p) => s + p.usdAmount, 0));
    const totalAmountDueUsd = round2(totalRentalChargesUsd + customerChargedExpensesUsd);
    const outstandingBalanceUsd = round2(Math.max(0, totalAmountDueUsd - paymentsReceivedUsd));

    res.json({
      success: true,
      data: {
        customer,
        rentals,
        returns,
        payments,
        expenses,
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
      },
    });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.post('/customers', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const siteLocation = typeof req.body?.siteLocation === 'string' ? req.body.siteLocation.trim() : '';
    if (!fullName || !phone || !siteLocation) {
      res.status(400).json({
        success: false,
        error: 'Customer full name, phone number, and construction site location are required',
      });
      return;
    }

    const customerId = await db.nextCode('CUS', 4);
    const customer = await db.createCustomer({
      customerId,
      fullName,
      phone,
      siteLocation,
      registrationDate:
        typeof req.body?.registrationDate === 'string' && req.body.registrationDate
          ? req.body.registrationDate
          : new Date().toISOString().slice(0, 10),
      notes: typeof req.body?.notes === 'string' ? req.body.notes.trim() : '',
      isArchived: false,
    });

    await db.appendAuditLog({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: 'ADMIN',
      action: 'CUSTOMER_CREATED',
      entityType: 'CUSTOMER',
      entityId: customer.customerId,
      previousValues: null,
      newValues: { fullName: customer.fullName, phone: customer.phone, siteLocation: customer.siteLocation },
    });

    res.status(201).json({ success: true, data: customer });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.patch('/customers/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await db.findCustomerById(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const patch = {
      fullName: typeof req.body?.fullName === 'string' && req.body.fullName.trim() ? req.body.fullName.trim() : existing.fullName,
      phone: typeof req.body?.phone === 'string' && req.body.phone.trim() ? req.body.phone.trim() : existing.phone,
      siteLocation:
        typeof req.body?.siteLocation === 'string' && req.body.siteLocation.trim()
          ? req.body.siteLocation.trim()
          : existing.siteLocation,
      notes: typeof req.body?.notes === 'string' ? req.body.notes.trim() : existing.notes,
    };

    const updated = await db.updateCustomer(existing.id, patch);

    await db.appendAuditLog({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: 'ADMIN',
      action: 'CUSTOMER_UPDATED',
      entityType: 'CUSTOMER',
      entityId: existing.customerId,
      previousValues: { fullName: existing.fullName, phone: existing.phone, siteLocation: existing.siteLocation },
      newValues: patch,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Rentals
apiRouter.get('/rentals', requireAuth, async (_req, res) => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const rentals = (await db.listRentals()).map((r) => ({
      ...r,
      status: computeEffectiveRentalStatus(r, todayStr),
    }));
    res.json({ success: true, data: rentals });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.post('/rentals', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const rental = await createRentalRecord(req.user!, req.body || {});
    res.status(201).json({ success: true, data: rental });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Returns
apiRouter.get('/returns', requireAuth, async (_req, res) => {
  try {
    const returns = await db.listReturns();
    res.json({ success: true, data: returns });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.post('/returns', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const record = await createReturnRecord(req.user!, req.body || {});
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Payments
apiRouter.get('/payments', requireAuth, async (_req, res) => {
  try {
    const payments = await db.listPayments();
    res.json({ success: true, data: payments });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.post('/payments', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const record = await createPaymentRecord(req.user!, req.body || {});
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Expenses
apiRouter.get('/expenses', requireAuth, async (_req, res) => {
  try {
    const expenses = await db.listExpenses();
    res.json({ success: true, data: expenses });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.post('/expenses', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const record = await createExpenseRecord(req.user!, req.body || {});
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Exchange Rates
apiRouter.get('/exchange-rates', requireAuth, async (_req, res) => {
  try {
    const rates = await db.getExchangeRates();
    const current = rates.find((r) => r.isCurrent)?.rate ?? 28;
    res.json({ success: true, data: { currentRate: current, history: rates } });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.post('/exchange-rates', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const rate = Number(req.body?.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      res.status(400).json({ success: false, error: 'Exchange rate must be greater than zero' });
      return;
    }
    const prevRate = await db.getCurrentExchangeRate();
    const created = await db.createExchangeRate({
      rate: round2(rate),
      effectiveFrom: new Date().toISOString(),
      changedBy: req.user!.id,
      changedByName: req.user!.fullName,
      notes: typeof req.body?.notes === 'string' ? req.body.notes.trim() : '',
      isCurrent: true,
    });

    await db.appendAuditLog({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: 'ADMIN',
      action: 'EXCHANGE_RATE_UPDATED',
      entityType: 'EXCHANGE_RATE',
      entityId: created.id,
      previousValues: { rate: prevRate },
      newValues: { rate: created.rate },
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Settings
apiRouter.get('/settings', requireAuth, async (_req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.put('/settings', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await db.getSettings();
    const logoDataUrl = typeof req.body?.logoDataUrl === 'string' ? req.body.logoDataUrl : existing?.logoDataUrl || '';
    if (logoDataUrl && logoDataUrl.length > 2_000_000) {
      res.status(400).json({ success: false, error: 'Logo image is too large (max ~1.5MB)' });
      return;
    }
    if (logoDataUrl && !logoDataUrl.startsWith('data:image/')) {
      res.status(400).json({ success: false, error: 'Invalid logo image format' });
      return;
    }

    const defaultLanguage: LanguageCode = req.body?.defaultLanguage === 'en' ? 'en' : 'so';
    const patch = {
      systemName:
        typeof req.body?.systemName === 'string' && req.body.systemName.trim()
          ? req.body.systemName.trim()
          : existing?.systemName || 'MSh Company',
      websiteName:
        typeof req.body?.websiteName === 'string' && req.body.websiteName.trim()
          ? req.body.websiteName.trim()
          : existing?.websiteName || 'Jeeg iyo Kabaleeti',
      companyName:
        typeof req.body?.companyName === 'string' && req.body.companyName.trim()
          ? req.body.companyName.trim()
          : existing?.companyName || 'MSh Company',
      logoDataUrl,
      phone: typeof req.body?.phone === 'string' ? req.body.phone.trim() : existing?.phone || '',
      email: typeof req.body?.email === 'string' ? req.body.email.trim() : existing?.email || '',
      address: typeof req.body?.address === 'string' ? req.body.address.trim() : existing?.address || '',
      description:
        typeof req.body?.description === 'string' ? req.body.description.trim() : existing?.description || '',
      defaultLanguage,
      updatedBy: req.user!.id,
    };

    const updated = await db.upsertSettings(patch);

    await db.appendAuditLog({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: 'ADMIN',
      action: 'COMPANY_SETTINGS_UPDATED',
      entityType: 'SETTINGS',
      entityId: updated.id,
      previousValues: {
        systemName: existing?.systemName,
        websiteName: existing?.websiteName,
        companyName: existing?.companyName,
      },
      newValues: {
        systemName: updated.systemName,
        websiteName: updated.websiteName,
        companyName: updated.companyName,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Audit Logs (Manager read-only)
apiRouter.get('/audit-logs', requireAuth, requireManager, async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(20, Number(req.query.limit) || 200));
    const logs = await db.listAuditLogs(limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Offline Sync Batch (Admin only — Manager strictly blocked)
interface OfflineQueueItemInput {
  clientTransactionId: string;
  entityType: 'RENTAL' | 'RETURN' | 'PAYMENT' | 'EXPENSE';
  payload: Record<string, unknown>;
  clientCreatedAt: string;
}

apiRouter.post('/sync/batch', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? (req.body.items as OfflineQueueItemInput[]) : [];
    if (items.length === 0) {
      res.json({ success: true, data: { results: [] } });
      return;
    }

    // Sort chronologically so rentals precede returns/payments created offline
    const sorted = items.slice().sort((a, b) => (a.clientCreatedAt || '').localeCompare(b.clientCreatedAt || ''));

    const results: Array<{
      clientTransactionId: string;
      entityType: string;
      status: 'SYNCED' | 'FAILED';
      serverEntityId?: string;
      error?: string;
    }> = [];

    for (const item of sorted) {
      const txId = String(item.clientTransactionId || '').trim();
      if (!txId) continue;

      try {
        let serverEntityId = '';
        const payload = { ...(item.payload || {}), clientTransactionId: txId };

        if (item.entityType === 'RENTAL') {
          const r = await createRentalRecord(req.user!, payload);
          serverEntityId = r.rentalId;
        } else if (item.entityType === 'RETURN') {
          const ret = await createReturnRecord(req.user!, payload);
          serverEntityId = ret.returnId;
        } else if (item.entityType === 'PAYMENT') {
          const pay = await createPaymentRecord(req.user!, payload);
          serverEntityId = pay.paymentId;
        } else if (item.entityType === 'EXPENSE') {
          const exp = await createExpenseRecord(req.user!, payload);
          serverEntityId = exp.expenseId;
        } else {
          throw new BusinessError(`Unsupported sync entity type: ${item.entityType}`);
        }

        await db.recordSync({
          clientTransactionId: txId,
          entityType: item.entityType,
          userId: req.user!.id,
          status: 'SYNCED',
          serverEntityId,
          clientCreatedAt: item.clientCreatedAt || new Date().toISOString(),
          syncedAt: new Date().toISOString(),
        });

        results.push({
          clientTransactionId: txId,
          entityType: item.entityType,
          status: 'SYNCED',
          serverEntityId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync validation failed';
        await db.recordSync({
          clientTransactionId: txId,
          entityType: item.entityType,
          userId: req.user!.id,
          status: 'FAILED',
          clientCreatedAt: item.clientCreatedAt || new Date().toISOString(),
          syncedAt: new Date().toISOString(),
          errorMessage: msg,
        });
        results.push({
          clientTransactionId: txId,
          entityType: item.entityType,
          status: 'FAILED',
          error: msg,
        });
      }
    }

    res.json({ success: true, data: { results } });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.get('/sync/history', requireAuth, async (_req, res) => {
  try {
    const records = await db.listSyncRecords(100);
    res.json({ success: true, data: records });
  } catch (err) {
    handleRouteError(res, err);
  }
});

// Automatic Backups & Recovery Monitoring
apiRouter.get('/backups', requireAuth, async (_req, res) => {
  try {
    const backups = await db.listBackups(30);
    res.json({
      success: true,
      data: {
        databaseEngine: isMongoConnected() ? 'mongodb_atlas' : 'local_persistent_store',
        scheduleIntervalHours: 6,
        backups,
      },
    });
  } catch (err) {
    handleRouteError(res, err);
  }
});

apiRouter.post('/backups/run', requireAuth, requireManager, async (req: AuthenticatedRequest, res) => {
  try {
    const backup = await db.runAutomaticBackup('MANUAL_TRIGGER');
    await db.appendAuditLog({
      userId: req.user!.id,
      userName: req.user!.fullName,
      userRole: 'MANAGER',
      action: 'BACKUP_CHECKPOINT_VERIFIED',
      entityType: 'BACKUP',
      entityId: backup.backupId,
      previousValues: null,
      newValues: { checksum: backup.checksum, recordCounts: backup.recordCounts },
    });
    res.status(201).json({ success: true, data: backup });
  } catch (err) {
    handleRouteError(res, err);
  }
});
