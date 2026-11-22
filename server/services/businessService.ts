import {
  calculateRentalAmounts,
  calculateRentalDays,
  convertToUsd,
  round2,
} from '../../shared/calculations';
import type {
  CurrencyCode,
  DashboardSummaryDTO,
  EquipmentCategory,
  ExpenseCategory,
  ExpenseDTO,
  ExpensePayerType,
  InventoryItemDTO,
  PaymentDTO,
  PaymentMethod,
  PricingMethod,
  RentalDTO,
  RentalStatus,
  ReturnCondition,
  ReturnRecordDTO,
} from '../../shared/types';
import { db } from '../db';
import type { AuthUser } from '../middleware/auth';

export class BusinessError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function asPositiveNumber(val: unknown, fieldName: string): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) {
    throw new BusinessError(`${fieldName} must be a positive number`);
  }
  return num;
}

function asNonNegativeNumber(val: unknown, fieldName: string): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) {
    throw new BusinessError(`${fieldName} must be zero or greater`);
  }
  return num;
}

function asNonEmptyString(val: unknown, fieldName: string): string {
  if (typeof val !== 'string' || !val.trim()) {
    throw new BusinessError(`${fieldName} is required`);
  }
  return val.trim();
}

export async function createInventoryItem(
  user: AuthUser,
  body: Record<string, unknown>
): Promise<InventoryItemDTO> {
  const name = asNonEmptyString(body.name, 'Product name');
  const category = String(body.category || '') as EquipmentCategory;
  if (category !== 'KABALEETI' && category !== 'JEEG') {
    throw new BusinessError('Product category must be KABALEETI or JEEG');
  }
  const totalQuantity = Math.floor(asNonNegativeNumber(body.totalQuantity, 'Total quantity'));
  if (totalQuantity <= 0) {
    throw new BusinessError('Total quantity must be greater than zero');
  }
  const purchasePricePerPiece = asNonNegativeNumber(body.purchasePricePerPiece ?? 0, 'Purchase price');
  const purchaseCurrency = (String(body.purchaseCurrency || 'USD') as CurrencyCode);
  if (purchaseCurrency !== 'USD' && purchaseCurrency !== 'SOS') {
    throw new BusinessError('Purchase currency must be USD or SOS');
  }
  const purchaseDate = asNonEmptyString(
    body.purchaseDate || new Date().toISOString().slice(0, 10),
    'Purchase date'
  );

  const currentRate = await db.getCurrentExchangeRate();
  const purchasePriceUsd = convertToUsd(purchasePricePerPiece, purchaseCurrency, currentRate);
  const prefix = category === 'KABALEETI' ? 'KAB' : 'JEG';
  const productId = await db.nextCode(prefix, 3);

  const item = await db.createInventory({
    productId,
    name,
    category,
    totalQuantity,
    availableQuantity: totalQuantity,
    rentedQuantity: 0,
    returnedQuantity: 0,
    damagedQuantity: 0,
    lostQuantity: 0,
    purchasePricePerPiece: round2(purchasePricePerPiece),
    purchaseCurrency,
    purchasePriceUsd,
    purchaseDate,
    description: typeof body.description === 'string' ? body.description.trim() : '',
    photoUrl: typeof body.photoUrl === 'string' ? body.photoUrl.trim() : '',
    isArchived: false,
  });

  await db.appendAuditLog({
    userId: user.id,
    userName: user.fullName,
    userRole: user.role,
    action: 'INVENTORY_CREATED',
    entityType: 'INVENTORY',
    entityId: item.productId,
    previousValues: null,
    newValues: { name: item.name, category: item.category, totalQuantity: item.totalQuantity },
  });

  return item;
}

export async function adjustInventoryItem(
  user: AuthUser,
  id: string,
  body: Record<string, unknown>
): Promise<InventoryItemDTO> {
  const existing = await db.findInventoryById(id);
  if (!existing) {
    throw new BusinessError('Inventory item not found', 404);
  }

  const prev = {
    name: existing.name,
    totalQuantity: existing.totalQuantity,
    availableQuantity: existing.availableQuantity,
    damagedQuantity: existing.damagedQuantity,
    lostQuantity: existing.lostQuantity,
  };

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : existing.name;
  const description = typeof body.description === 'string' ? body.description.trim() : existing.description;
  const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl.trim() : existing.photoUrl;

  let totalQuantity = existing.totalQuantity;
  let availableQuantity = existing.availableQuantity;

  if (body.addQuantity !== undefined && Number(body.addQuantity) !== 0) {
    const delta = Math.floor(Number(body.addQuantity));
    if (!Number.isFinite(delta)) throw new BusinessError('Invalid quantity adjustment');
    if (availableQuantity + delta < 0) {
      throw new BusinessError('Cannot reduce inventory below currently rented/unavailable stock');
    }
    totalQuantity += delta;
    availableQuantity += delta;
  }

  const updated = await db.updateInventory(id, {
    name,
    description,
    photoUrl,
    totalQuantity,
    availableQuantity,
  });
  if (!updated) throw new BusinessError('Failed to update inventory', 500);

  await db.appendAuditLog({
    userId: user.id,
    userName: user.fullName,
    userRole: user.role,
    action: 'INVENTORY_ADJUSTED',
    entityType: 'INVENTORY',
    entityId: existing.productId,
    previousValues: prev,
    newValues: {
      name: updated.name,
      totalQuantity: updated.totalQuantity,
      availableQuantity: updated.availableQuantity,
    },
  });

  return updated;
}

export async function createRentalRecord(
  user: AuthUser,
  body: Record<string, unknown>
): Promise<RentalDTO> {
  const clientTransactionId =
    typeof body.clientTransactionId === 'string' && body.clientTransactionId.trim()
      ? body.clientTransactionId.trim()
      : undefined;

  if (clientTransactionId) {
    const duplicate = await db.findRentalByClientTx(clientTransactionId);
    if (duplicate) return duplicate;
  }

  const inventoryId = asNonEmptyString(body.inventoryId, 'Equipment item');
  const inventory = await db.findInventoryById(inventoryId);
  if (!inventory) {
    throw new BusinessError('Selected equipment item not found', 404);
  }

  const quantityRented = Math.floor(asPositiveNumber(body.quantityRented, 'Quantity rented'));
  if (inventory.availableQuantity < quantityRented) {
    throw new BusinessError(
      `Insufficient available ${inventory.category} stock. Available: ${inventory.availableQuantity}, Requested: ${quantityRented}`
    );
  }

  // Resolve or create customer
  let customer = body.customerId && body.customerId !== 'NEW'
    ? await db.findCustomerById(String(body.customerId))
    : null;

  const customerName = customer?.fullName || asNonEmptyString(body.customerName, 'Customer full name');
  const customerPhone = customer?.phone || asNonEmptyString(body.customerPhone, 'Customer phone number');
  const siteLocation =
    (typeof body.siteLocation === 'string' && body.siteLocation.trim()) ||
    customer?.siteLocation ||
    asNonEmptyString(body.siteLocation, 'House / construction site location');

  if (!customer) {
    const byPhone = await db.findCustomerByPhone(customerPhone);
    if (byPhone) {
      customer = byPhone;
    } else {
      const customerCode = await db.nextCode('CUS', 4);
      customer = await db.createCustomer({
        customerId: customerCode,
        fullName: customerName,
        phone: customerPhone,
        siteLocation,
        registrationDate: new Date().toISOString().slice(0, 10),
        notes: 'Registered via rental form',
        isArchived: false,
      });
    }
  }

  const vehicleType = asNonEmptyString(body.vehicleType, 'Transport vehicle');
  const vehiclePlate = typeof body.vehiclePlate === 'string' ? body.vehiclePlate.trim() : '';
  const startDate = asNonEmptyString(
    body.startDate || new Date().toISOString().slice(0, 10),
    'Rental start date'
  );
  const expectedReturnDate =
    typeof body.expectedReturnDate === 'string' && body.expectedReturnDate.trim()
      ? body.expectedReturnDate.trim()
      : null;

  const pricingMethod = String(body.pricingMethod || '') as PricingMethod;
  if (!['CONTRACT', 'DAILY_TOTAL', 'PER_PIECE_DAILY'].includes(pricingMethod)) {
    throw new BusinessError('Invalid pricing method');
  }

  const currency = String(body.currency || '') as CurrencyCode;
  if (currency !== 'USD' && currency !== 'SOS') {
    throw new BusinessError('Currency must be USD or SOS');
  }

  const unitOrContractPrice = asNonNegativeNumber(body.unitOrContractPrice, 'Rental price');
  const computedDays = expectedReturnDate
    ? calculateRentalDays(startDate, expectedReturnDate)
    : Math.max(1, Math.floor(Number(body.rentalDays) || 1));

  const currentRate = await db.getCurrentExchangeRate();
  const snapshotRate =
    body.exchangeRateSnapshot && Number(body.exchangeRateSnapshot) > 0
      ? Number(body.exchangeRateSnapshot)
      : currentRate;

  const { originalAmount, usdAmount } = calculateRentalAmounts({
    pricingMethod,
    unitOrContractPrice,
    quantityRented,
    rentalDays: computedDays,
    currency,
    exchangeRate: snapshotRate,
  });

  // Update inventory quantities atomically
  await db.updateInventory(inventory.id, {
    availableQuantity: inventory.availableQuantity - quantityRented,
    rentedQuantity: inventory.rentedQuantity + quantityRented,
  });

  const rentalCode = await db.nextCode('RNT', 4);
  const rental = await db.createRental(
    {
      rentalId: rentalCode,
      clientTransactionId,
      customerId: customer.id,
      customerCode: customer.customerId,
      customerName,
      customerPhone,
      siteLocation,
      vehicleType,
      vehiclePlate,
      productCategory: inventory.category,
      inventoryId: inventory.id,
      inventoryProductId: inventory.productId,
      inventoryName: inventory.name,
      quantityRented,
      quantityReturned: 0,
      quantityDamaged: 0,
      quantityLost: 0,
      quantityRemaining: quantityRented,
      startDate,
      expectedReturnDate,
      actualReturnDate: null,
      pricingMethod,
      unitOrContractPrice: round2(unitOrContractPrice),
      rentalDays: computedDays,
      currency,
      exchangeRateSnapshot: snapshotRate,
      originalAmount,
      usdAmount,
      status: 'ACTIVE',
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
      createdBy: user.id,
      createdByName: user.fullName,
    },
    {
      inventoryId: inventory.id,
      productId: inventory.productId,
      productCategory: inventory.category,
      quantity: quantityRented,
      pricingMethod,
      unitPrice: round2(unitOrContractPrice),
      currency,
      originalSubtotal: originalAmount,
      usdSubtotal: usdAmount,
    }
  );

  await db.appendAuditLog({
    userId: user.id,
    userName: user.fullName,
    userRole: user.role,
    action: 'RENTAL_CREATED',
    entityType: 'RENTAL',
    entityId: rental.rentalId,
    previousValues: { availableQuantity: inventory.availableQuantity },
    newValues: {
      customerName: rental.customerName,
      productCategory: rental.productCategory,
      quantityRented: rental.quantityRented,
      usdAmount: rental.usdAmount,
      currency: rental.currency,
    },
  });

  return rental;
}

export async function createReturnRecord(
  user: AuthUser,
  body: Record<string, unknown>
): Promise<ReturnRecordDTO> {
  const clientTransactionId =
    typeof body.clientTransactionId === 'string' && body.clientTransactionId.trim()
      ? body.clientTransactionId.trim()
      : undefined;

  if (clientTransactionId) {
    const duplicate = await db.findReturnByClientTx(clientTransactionId);
    if (duplicate) return duplicate;
  }

  const rentalId = asNonEmptyString(body.rentalId, 'Rental ID');
  const rental = await db.findRentalById(rentalId);
  if (!rental) {
    throw new BusinessError('Rental record not found', 404);
  }
  if (rental.quantityRemaining <= 0) {
    throw new BusinessError('All equipment on this rental has already been returned or accounted for');
  }

  const quantityReturnedGood = Math.floor(
    asNonNegativeNumber(body.quantityReturnedGood ?? 0, 'Quantity returned')
  );
  const damagedQuantity = Math.floor(
    asNonNegativeNumber(body.damagedQuantity ?? 0, 'Damaged quantity')
  );
  const lostQuantity = Math.floor(asNonNegativeNumber(body.lostQuantity ?? 0, 'Lost quantity'));

  const totalAccounted = quantityReturnedGood + damagedQuantity + lostQuantity;
  if (totalAccounted <= 0) {
    throw new BusinessError('Total returned, damaged, or lost quantity must be at least 1');
  }
  if (totalAccounted > rental.quantityRemaining) {
    throw new BusinessError(
      `Return quantity (${totalAccounted}) exceeds remaining rented quantity (${rental.quantityRemaining})`
    );
  }

  const inventory = await db.findInventoryById(rental.inventoryId);
  if (!inventory) {
    throw new BusinessError('Linked inventory record not found', 404);
  }

  const remainingAfterReturn = rental.quantityRemaining - totalAccounted;
  const returnDate = asNonEmptyString(
    body.returnDate || new Date().toISOString().slice(0, 10),
    'Return date'
  );

  let condition = String(body.condition || 'GOOD') as ReturnCondition;
  if (!['GOOD', 'PARTIAL_DAMAGE', 'DAMAGED', 'LOST_REPORTED'].includes(condition)) {
    condition = damagedQuantity > 0 ? 'PARTIAL_DAMAGE' : lostQuantity > 0 ? 'LOST_REPORTED' : 'GOOD';
  }

  const newStatus: RentalStatus = remainingAfterReturn === 0 ? 'COMPLETED' : 'PARTIAL_RETURN';

  // Update rental
  await db.updateRental(rental.id, {
    quantityReturned: rental.quantityReturned + quantityReturnedGood,
    quantityDamaged: rental.quantityDamaged + damagedQuantity,
    quantityLost: rental.quantityLost + lostQuantity,
    quantityRemaining: remainingAfterReturn,
    status: newStatus,
    actualReturnDate: remainingAfterReturn === 0 ? returnDate : rental.actualReturnDate,
  });

  // Update inventory: ONLY good returned pieces return to availableQuantity!
  await db.updateInventory(inventory.id, {
    availableQuantity: inventory.availableQuantity + quantityReturnedGood,
    rentedQuantity: Math.max(0, inventory.rentedQuantity - totalAccounted),
    returnedQuantity: inventory.returnedQuantity + quantityReturnedGood,
    damagedQuantity: inventory.damagedQuantity + damagedQuantity,
    lostQuantity: inventory.lostQuantity + lostQuantity,
  });

  const returnCode = await db.nextCode('RET', 4);
  const record = await db.createReturn({
    returnId: returnCode,
    clientTransactionId,
    rentalId: rental.id,
    rentalCode: rental.rentalId,
    customerId: rental.customerId,
    customerName: rental.customerName,
    productCategory: rental.productCategory,
    inventoryId: rental.inventoryId,
    originalQuantity: rental.quantityRented,
    quantityReturnedGood,
    damagedQuantity,
    lostQuantity,
    remainingAfterReturn,
    returnDate,
    condition,
    notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    createdBy: user.id,
    createdByName: user.fullName,
  });

  await db.appendAuditLog({
    userId: user.id,
    userName: user.fullName,
    userRole: user.role,
    action: remainingAfterReturn === 0 ? 'RENTAL_FULL_RETURN' : 'RENTAL_PARTIAL_RETURN',
    entityType: 'RETURN',
    entityId: record.returnId,
    previousValues: { quantityRemaining: rental.quantityRemaining, status: rental.status },
    newValues: {
      quantityReturnedGood,
      damagedQuantity,
      lostQuantity,
      remainingAfterReturn,
      status: newStatus,
    },
  });

  return record;
}

export async function createPaymentRecord(
  user: AuthUser,
  body: Record<string, unknown>
): Promise<PaymentDTO> {
  const clientTransactionId =
    typeof body.clientTransactionId === 'string' && body.clientTransactionId.trim()
      ? body.clientTransactionId.trim()
      : undefined;

  if (clientTransactionId) {
    const duplicate = await db.findPaymentByClientTx(clientTransactionId);
    if (duplicate) return duplicate;
  }

  const customerId = asNonEmptyString(body.customerId, 'Customer');
  const customer = await db.findCustomerById(customerId);
  if (!customer) {
    throw new BusinessError('Customer not found', 404);
  }

  let rentalCode: string | null = null;
  let rentalId: string | null = null;
  if (typeof body.rentalId === 'string' && body.rentalId.trim()) {
    const rental = await db.findRentalById(body.rentalId.trim());
    if (!rental) throw new BusinessError('Linked rental not found', 404);
    rentalId = rental.id;
    rentalCode = rental.rentalId;
  }

  const amount = asPositiveNumber(body.amount, 'Payment amount');
  const currency = String(body.currency || 'USD') as CurrencyCode;
  if (currency !== 'USD' && currency !== 'SOS') {
    throw new BusinessError('Currency must be USD or SOS');
  }

  const currentRate = await db.getCurrentExchangeRate();
  const snapshotRate =
    body.exchangeRateSnapshot && Number(body.exchangeRateSnapshot) > 0
      ? Number(body.exchangeRateSnapshot)
      : currentRate;

  const usdAmount = convertToUsd(amount, currency, snapshotRate);
  const paymentDate = asNonEmptyString(
    body.paymentDate || new Date().toISOString().slice(0, 10),
    'Payment date'
  );
  const paymentMethod = String(body.paymentMethod || 'CASH') as PaymentMethod;
  if (!['CASH', 'EVC_PLUS', 'SAHAL', 'BANK_TRANSFER', 'OTHER'].includes(paymentMethod)) {
    throw new BusinessError('Invalid payment method');
  }

  const paymentCode = await db.nextCode('PAY', 4);
  const record = await db.createPayment({
    paymentId: paymentCode,
    clientTransactionId,
    customerId: customer.id,
    customerName: customer.fullName,
    rentalId,
    rentalCode,
    amount: round2(amount),
    currency,
    exchangeRateSnapshot: snapshotRate,
    usdAmount,
    paymentDate,
    paymentMethod,
    referenceNumber: typeof body.referenceNumber === 'string' ? body.referenceNumber.trim() : '',
    notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    createdBy: user.id,
    createdByName: user.fullName,
  });

  await db.appendAuditLog({
    userId: user.id,
    userName: user.fullName,
    userRole: user.role,
    action: 'PAYMENT_RECORDED',
    entityType: 'PAYMENT',
    entityId: record.paymentId,
    previousValues: null,
    newValues: {
      customerName: customer.fullName,
      amount: record.amount,
      currency: record.currency,
      usdAmount: record.usdAmount,
    },
  });

  return record;
}

export async function createExpenseRecord(
  user: AuthUser,
  body: Record<string, unknown>
): Promise<ExpenseDTO> {
  const clientTransactionId =
    typeof body.clientTransactionId === 'string' && body.clientTransactionId.trim()
      ? body.clientTransactionId.trim()
      : undefined;

  if (clientTransactionId) {
    const duplicate = await db.findExpenseByClientTx(clientTransactionId);
    if (duplicate) return duplicate;
  }

  const category = String(body.category || '') as ExpenseCategory;
  if (!['LOADING', 'UNLOADING', 'TRANSPORTATION', 'FUEL', 'MAINTENANCE', 'OTHER'].includes(category)) {
    throw new BusinessError('Invalid expense category');
  }

  const description = asNonEmptyString(body.description, 'Description');
  const amount = asPositiveNumber(body.amount, 'Expense amount');
  const currency = String(body.currency || 'USD') as CurrencyCode;
  if (currency !== 'USD' && currency !== 'SOS') {
    throw new BusinessError('Currency must be USD or SOS');
  }

  const payerType = String(body.payerType || 'COMPANY') as ExpensePayerType;
  if (payerType !== 'COMPANY' && payerType !== 'CUSTOMER_CHARGED') {
    throw new BusinessError('Payer type must be COMPANY or CUSTOMER_CHARGED');
  }

  let rentalId: string | null = null;
  let rentalCode: string | null = null;
  let customerId: string | null = null;
  if (typeof body.rentalId === 'string' && body.rentalId.trim()) {
    const rental = await db.findRentalById(body.rentalId.trim());
    if (!rental) throw new BusinessError('Related rental not found', 404);
    rentalId = rental.id;
    rentalCode = rental.rentalId;
    customerId = rental.customerId;
  }

  const currentRate = await db.getCurrentExchangeRate();
  const snapshotRate =
    body.exchangeRateSnapshot && Number(body.exchangeRateSnapshot) > 0
      ? Number(body.exchangeRateSnapshot)
      : currentRate;

  const usdAmount = convertToUsd(amount, currency, snapshotRate);
  const expenseDate = asNonEmptyString(
    body.expenseDate || new Date().toISOString().slice(0, 10),
    'Expense date'
  );
  const paidByPerson = asNonEmptyString(body.paidByPerson, 'Person who paid');

  const expenseCode = await db.nextCode('EXP', 4);
  const record = await db.createExpense({
    expenseId: expenseCode,
    clientTransactionId,
    rentalId,
    rentalCode,
    customerId,
    category,
    description,
    amount: round2(amount),
    currency,
    exchangeRateSnapshot: snapshotRate,
    usdAmount,
    expenseDate,
    paidByPerson,
    payerType,
    notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    createdBy: user.id,
    createdByName: user.fullName,
  });

  await db.appendAuditLog({
    userId: user.id,
    userName: user.fullName,
    userRole: user.role,
    action: 'EXPENSE_RECORDED',
    entityType: 'EXPENSE',
    entityId: record.expenseId,
    previousValues: null,
    newValues: {
      category: record.category,
      payerType: record.payerType,
      usdAmount: record.usdAmount,
      rentalCode: record.rentalCode,
    },
  });

  return record;
}

export function computeEffectiveRentalStatus(rental: RentalDTO, todayStr: string): RentalStatus {
  if (rental.quantityRemaining === 0 || rental.status === 'COMPLETED') {
    return 'COMPLETED';
  }
  if (rental.expectedReturnDate && rental.expectedReturnDate < todayStr && rental.quantityRemaining > 0) {
    return 'OVERDUE';
  }
  if (rental.quantityReturned > 0 || rental.quantityDamaged > 0 || rental.quantityLost > 0) {
    return 'PARTIAL_RETURN';
  }
  return 'ACTIVE';
}

export async function getDashboardSummary(
  startDate?: string,
  endDate?: string
): Promise<DashboardSummaryDTO> {
  const [inventory, rentals, payments, expenses] = await Promise.all([
    db.listInventory(),
    db.listRentals(),
    db.listPayments(),
    db.listExpenses(),
  ]);

  const inRange = (d: string) => {
    const day = d.slice(0, 10);
    if (startDate && day < startDate) return false;
    if (endDate && day > endDate) return false;
    return true;
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  let totalKabaleeti = 0;
  let totalJeeg = 0;
  let availableInventory = 0;
  let rentedEquipment = 0;
  let returnedEquipment = 0;
  let damagedEquipment = 0;
  let lostEquipment = 0;

  for (const item of inventory) {
    if (item.category === 'KABALEETI') totalKabaleeti += item.totalQuantity;
    if (item.category === 'JEEG') totalJeeg += item.totalQuantity;
    availableInventory += item.availableQuantity;
    rentedEquipment += item.rentedQuantity;
    returnedEquipment += item.returnedQuantity;
    damagedEquipment += item.damagedQuantity;
    lostEquipment += item.lostQuantity;
  }

  const filteredRentals = rentals.filter((r) => inRange(r.startDate));
  const filteredPayments = payments.filter((p) => inRange(p.paymentDate));
  const filteredExpenses = expenses.filter((e) => inRange(e.expenseDate));

  const rentalStatusCounts: Record<RentalStatus, number> = {
    ACTIVE: 0,
    PARTIAL_RETURN: 0,
    COMPLETED: 0,
    OVERDUE: 0,
  };

  let activeRentalsCount = 0;
  let overdueRentalsCount = 0;
  let totalRentalRevenueUsd = 0;

  for (const r of filteredRentals) {
    const effStatus = computeEffectiveRentalStatus(r, todayStr);
    rentalStatusCounts[effStatus] += 1;
    if (effStatus !== 'COMPLETED') activeRentalsCount += 1;
    if (effStatus === 'OVERDUE') overdueRentalsCount += 1;
    totalRentalRevenueUsd += r.usdAmount;
  }

  const totalPaymentsReceivedUsd = round2(
    filteredPayments.reduce((sum, p) => sum + p.usdAmount, 0)
  );

  // Outstanding balance across ALL rentals + customer-charged expenses minus ALL payments (or filtered)
  const allRentalCharges = rentals.reduce((sum, r) => sum + r.usdAmount, 0);
  const allCustomerChargedExp = expenses
    .filter((e) => e.payerType === 'CUSTOMER_CHARGED')
    .reduce((sum, e) => sum + e.usdAmount, 0);
  const allPaymentsTotal = payments.reduce((sum, p) => sum + p.usdAmount, 0);
  const outstandingCustomerBalancesUsd = round2(
    Math.max(0, allRentalCharges + allCustomerChargedExp - allPaymentsTotal)
  );

  const totalCompanyExpensesUsd = round2(
    filteredExpenses
      .filter((e) => e.payerType === 'COMPANY')
      .reduce((sum, e) => sum + e.usdAmount, 0)
  );
  const totalCustomerChargedExpensesUsd = round2(
    filteredExpenses
      .filter((e) => e.payerType === 'CUSTOMER_CHARGED')
      .reduce((sum, e) => sum + e.usdAmount, 0)
  );

  const netProfitUsd = round2(totalRentalRevenueUsd - totalCompanyExpensesUsd);

  // Daily activity (last 14 days with activity or calendar days)
  const dailyMap = new Map<string, { rentalsCount: number; revenueUsd: number }>();
  for (const r of filteredRentals) {
    const day = r.startDate.slice(0, 10);
    const cur = dailyMap.get(day) || { rentalsCount: 0, revenueUsd: 0 };
    cur.rentalsCount += 1;
    cur.revenueUsd = round2(cur.revenueUsd + r.usdAmount);
    dailyMap.set(day, cur);
  }
  const dailyActivity = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, val]) => ({ date, ...val }));

  // Monthly revenue/payments/expenses
  const monthMap = new Map<string, { revenueUsd: number; paymentsUsd: number; expensesUsd: number }>();
  const ensureMonth = (m: string) => {
    if (!monthMap.has(m)) monthMap.set(m, { revenueUsd: 0, paymentsUsd: 0, expensesUsd: 0 });
    return monthMap.get(m)!;
  };
  for (const r of filteredRentals) {
    const entry = ensureMonth(r.startDate.slice(0, 7));
    entry.revenueUsd = round2(entry.revenueUsd + r.usdAmount);
  }
  for (const p of filteredPayments) {
    const entry = ensureMonth(p.paymentDate.slice(0, 7));
    entry.paymentsUsd = round2(entry.paymentsUsd + p.usdAmount);
  }
  for (const e of filteredExpenses) {
    if (e.payerType === 'COMPANY') {
      const entry = ensureMonth(e.expenseDate.slice(0, 7));
      entry.expensesUsd = round2(entry.expensesUsd + e.usdAmount);
    }
  }
  const monthlyRevenue = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, val]) => ({ month, ...val }));

  // Expense by category
  const catMap = new Map<ExpenseCategory, number>();
  for (const e of filteredExpenses) {
    catMap.set(e.category, round2((catMap.get(e.category) || 0) + e.usdAmount));
  }
  const expenseByCategory = Array.from(catMap.entries()).map(([category, amountUsd]) => ({
    category,
    amountUsd,
  }));

  return {
    totalKabaleeti,
    totalJeeg,
    availableInventory,
    rentedEquipment,
    returnedEquipment,
    damagedEquipment,
    lostEquipment,
    activeRentalsCount,
    overdueRentalsCount,
    totalRentalRevenueUsd: round2(totalRentalRevenueUsd),
    totalPaymentsReceivedUsd,
    outstandingCustomerBalancesUsd,
    totalCompanyExpensesUsd,
    totalCustomerChargedExpensesUsd,
    netProfitUsd,
    dailyActivity,
    monthlyRevenue,
    expenseByCategory,
    rentalStatusCounts,
  };
}
