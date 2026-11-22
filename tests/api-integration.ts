import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateRentalAmounts,
  convertToUsd,
  DEFAULT_EXCHANGE_RATE,
} from '../shared/calculations';

const PORT = 3199;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_BACKUP_DIR = path.resolve(process.cwd(), '.data_test_backup');

async function req(
  pathStr: string,
  options: { method?: string; token?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = {
    'X-Requested-With': 'MShRentalApp',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(`${BASE_URL}${pathStr}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await req('/api/health');
      if (r.status === 200) return;
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Test server failed to start');
}

async function run() {
  console.log('1. Testing shared currency & pricing calculations...');
  assert.equal(DEFAULT_EXCHANGE_RATE, 28);
  assert.equal(convertToUsd(50000, 'SOS', 28), 1785.71);
  assert.equal(convertToUsd(500, 'SOS', 28), 17.86);
  assert.equal(convertToUsd(5000, 'SOS', 28), 178.57);

  // Method A: Contract Price
  const contractCalc = calculateRentalAmounts({
    pricingMethod: 'CONTRACT',
    unitOrContractPrice: 1500,
    quantityRented: 100,
    rentalDays: 60,
    currency: 'USD',
    exchangeRate: 28,
  });
  assert.equal(contractCalc.originalAmount, 1500);
  assert.equal(contractCalc.usdAmount, 1500);

  // Method B: Daily Total Price (500 SOS * 100 days = 50,000 SOS -> $1,785.71)
  const dailyTotalCalc = calculateRentalAmounts({
    pricingMethod: 'DAILY_TOTAL',
    unitOrContractPrice: 500,
    quantityRented: 100,
    rentalDays: 100,
    currency: 'SOS',
    exchangeRate: 28,
  });
  assert.equal(dailyTotalCalc.originalAmount, 50000);
  assert.equal(dailyTotalCalc.usdAmount, 1785.71);

  // Method C: Per-Piece Daily Price (100 * $0.20 * 100 = $2,000)
  const perPieceCalc = calculateRentalAmounts({
    pricingMethod: 'PER_PIECE_DAILY',
    unitOrContractPrice: 0.2,
    quantityRented: 100,
    rentalDays: 100,
    currency: 'USD',
    exchangeRate: 28,
  });
  assert.equal(perPieceCalc.originalAmount, 2000);
  assert.equal(perPieceCalc.usdAmount, 2000);

  // Preserve existing .data if any
  const hadData = fs.existsSync(DATA_DIR);
  if (hadData) {
    fs.rmSync(DATA_BACKUP_DIR, { recursive: true, force: true });
    fs.cpSync(DATA_DIR, DATA_BACKUP_DIR, { recursive: true });
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }

  const serverProc = spawn('npx', ['tsx', 'server.ts'], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development', MONGODB_URI: '' },
    stdio: 'pipe',
  });

  try {
    await waitForHealth();
    console.log('2. Testing first-time Manager setup & lock...');
    const s1 = await req('/api/auth/setup-status');
    assert.equal(s1.json.data.hasManager, false);

    const mgrCreate = await req('/api/auth/setup-manager', {
      method: 'POST',
      body: { fullName: 'Test Manager', email: 'manager@msh.test', password: 'Password123!' },
    });
    assert.equal(mgrCreate.status, 201);
    const mgrToken = mgrCreate.json.data.token as string;
    assert.ok(mgrToken);

    // Second setup attempt must be blocked (403)
    const mgrSecond = await req('/api/auth/setup-manager', {
      method: 'POST',
      body: { fullName: 'Evil Manager', email: 'evil@msh.test', password: 'Password123!' },
    });
    assert.equal(mgrSecond.status, 403);

    console.log('3. Testing Manager read-only enforcement & Admin creation...');
    // Manager CANNOT create inventory (403)
    const mgrInvAttempt = await req('/api/inventory', {
      method: 'POST',
      token: mgrToken,
      body: { name: 'Kabaleeti 3m', category: 'KABALEETI', totalQuantity: 100 },
    });
    assert.equal(mgrInvAttempt.status, 403);

    // Manager CAN create Admin account
    const adminCreate = await req('/api/users', {
      method: 'POST',
      token: mgrToken,
      body: { fullName: 'Test Admin', email: 'admin@msh.test', password: 'AdminPass123!' },
    });
    assert.equal(adminCreate.status, 201);
    const adminId = adminCreate.json.data.id as string;

    // Admin login
    const adminLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@msh.test', password: 'AdminPass123!' },
    });
    assert.equal(adminLogin.status, 200);
    const adminToken = adminLogin.json.data.token as string;

    // Admin CANNOT view Manager-only users list (403)
    const adminUsersAttempt = await req('/api/users', { token: adminToken });
    assert.equal(adminUsersAttempt.status, 403);

    console.log('4. Testing Inventory, Rentals (all 3 pricing methods), Returns & Expenses...');
    const invJeeg = await req('/api/inventory', {
      method: 'POST',
      token: adminToken,
      body: {
        name: 'Jeeg Frame Standard',
        category: 'JEEG',
        totalQuantity: 200,
        purchasePricePerPiece: 25,
        purchaseCurrency: 'USD',
        purchaseDate: '2026-11-01',
      },
    });
    assert.equal(invJeeg.status, 201);
    const jeegId = invJeeg.json.data.id as string;

    // Register Rental with SOS Daily Total & NO expectedReturnDate (optional!)
    const rentalRes = await req('/api/rentals', {
      method: 'POST',
      token: adminToken,
      body: {
        customerId: 'NEW',
        customerName: 'Axmed Cali',
        customerPhone: '+252615551111',
        siteLocation: 'Hodan District, Mogadishu',
        vehicleType: 'Dyna Truck',
        inventoryId: jeegId,
        quantityRented: 200,
        startDate: '2026-11-01',
        expectedReturnDate: null,
        pricingMethod: 'DAILY_TOTAL',
        unitOrContractPrice: 500,
        rentalDays: 100,
        currency: 'SOS',
      },
    });
    assert.equal(rentalRes.status, 201);
    assert.equal(rentalRes.json.data.usdAmount, 1785.71);
    assert.equal(rentalRes.json.data.quantityRemaining, 200);
    const rentalId = rentalRes.json.data.id as string;
    const customerId = rentalRes.json.data.customerId as string;

    // Partial Return 1: 100 returned good -> 100 remaining
    const ret1 = await req('/api/returns', {
      method: 'POST',
      token: adminToken,
      body: {
        rentalId,
        quantityReturnedGood: 100,
        damagedQuantity: 0,
        lostQuantity: 0,
        returnDate: '2026-11-10',
        condition: 'GOOD',
      },
    });
    assert.equal(ret1.status, 201);
    assert.equal(ret1.json.data.remainingAfterReturn, 100);

    // Partial Return 2: 50 good + 5 damaged + 5 lost -> 40 remaining
    const ret2 = await req('/api/returns', {
      method: 'POST',
      token: adminToken,
      body: {
        rentalId,
        quantityReturnedGood: 50,
        damagedQuantity: 5,
        lostQuantity: 5,
        returnDate: '2026-11-15',
        condition: 'PARTIAL_DAMAGE',
      },
    });
    assert.equal(ret2.status, 201);
    assert.equal(ret2.json.data.remainingAfterReturn, 40);

    // Check inventory never counts damaged/lost as available
    const invCheck = await req('/api/inventory', { token: mgrToken });
    const jeegRow = invCheck.json.data.find((i: { id: string }) => i.id === jeegId);
    assert.equal(jeegRow.availableQuantity, 150);
    assert.equal(jeegRow.rentedQuantity, 40);
    assert.equal(jeegRow.damagedQuantity, 5);
    assert.equal(jeegRow.lostQuantity, 5);

    // Record Company Loading Expense & Payment
    const expRes = await req('/api/expenses', {
      method: 'POST',
      token: adminToken,
      body: {
        rentalId,
        category: 'LOADING',
        description: 'Rarista qalabka Jeeg',
        amount: 280,
        currency: 'SOS',
        expenseDate: '2026-11-01',
        paidByPerson: 'Xasan',
        payerType: 'COMPANY',
      },
    });
    assert.equal(expRes.status, 201);
    assert.equal(expRes.json.data.usdAmount, 10);

    const payRes = await req('/api/payments', {
      method: 'POST',
      token: adminToken,
      body: {
        customerId,
        rentalId,
        amount: 500,
        currency: 'USD',
        paymentDate: '2026-11-05',
        paymentMethod: 'EVC_PLUS',
      },
    });
    assert.equal(payRes.status, 201);

    // Offline Sync Idempotency Test (same clientTransactionId twice -> no duplicate!)
    console.log('5. Testing Offline Batch Sync idempotency & Manager block...');
    const mgrSyncBlock = await req('/api/sync/batch', {
      method: 'POST',
      token: mgrToken,
      body: { items: [] },
    });
    assert.equal(mgrSyncBlock.status, 403);

    const txId = 'offline-test-pay-001';
    const sync1 = await req('/api/sync/batch', {
      method: 'POST',
      token: adminToken,
      body: {
        items: [
          {
            clientTransactionId: txId,
            entityType: 'PAYMENT',
            clientCreatedAt: '2026-11-06T10:00:00Z',
            payload: {
              customerId,
              rentalId,
              amount: 280,
              currency: 'SOS',
              paymentDate: '2026-11-06',
              paymentMethod: 'CASH',
            },
          },
        ],
      },
    });
    assert.equal(sync1.status, 200);
    assert.equal(sync1.json.data.results[0].status, 'SYNCED');
    const firstPayId = sync1.json.data.results[0].serverEntityId;

    const sync2 = await req('/api/sync/batch', {
      method: 'POST',
      token: adminToken,
      body: {
        items: [
          {
            clientTransactionId: txId,
            entityType: 'PAYMENT',
            clientCreatedAt: '2026-11-06T10:00:00Z',
            payload: {
              customerId,
              rentalId,
              amount: 280,
              currency: 'SOS',
              paymentDate: '2026-11-06',
              paymentMethod: 'CASH',
            },
          },
        ],
      },
    });
    assert.equal(sync2.json.data.results[0].serverEntityId, firstPayId);

    // Verify customer outstanding balance: 1785.71 - (500 + 10) = 1275.71
    const profileRes = await req(`/api/customers/${customerId}/profile`, { token: mgrToken });
    assert.equal(profileRes.json.data.summary.outstandingBalanceUsd, 1275.71);

    // Verify Manager can deactivate Admin and deactivated Admin cannot login
    const deactRes = await req(`/api/users/${adminId}/status`, {
      method: 'PATCH',
      token: mgrToken,
      body: { isActive: false },
    });
    assert.equal(deactRes.status, 200);

    const blockedLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@msh.test', password: 'AdminPass123!' },
    });
    assert.equal(blockedLogin.status, 403);

    // Verify Dashboard live totals
    const dashRes = await req('/api/dashboard', { token: mgrToken });
    assert.equal(dashRes.status, 200);
    assert.equal(dashRes.json.data.totalJeeg, 200);
    assert.equal(dashRes.json.data.totalRentalRevenueUsd, 1785.71);
    assert.equal(dashRes.json.data.totalPaymentsReceivedUsd, 510);
    assert.equal(dashRes.json.data.totalCompanyExpensesUsd, 10);

    console.log('ALL TESTS PASSED SUCCESSFULLY!');
  } finally {
    serverProc.kill('SIGTERM');
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    if (hadData) {
      fs.cpSync(DATA_BACKUP_DIR, DATA_DIR, { recursive: true });
      fs.rmSync(DATA_BACKUP_DIR, { recursive: true, force: true });
    }
  }
}

run().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exit(1);
});
