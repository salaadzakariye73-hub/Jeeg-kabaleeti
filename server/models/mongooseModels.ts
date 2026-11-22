import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['MANAGER', 'ADMIN'], required: true, index: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, default: null },
    lastLoginAt: { type: String, default: null },
  },
  { timestamps: true }
);

const InventorySchema = new Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ['KABALEETI', 'JEEG'], required: true, index: true },
    totalQuantity: { type: Number, required: true, min: 0 },
    availableQuantity: { type: Number, required: true, min: 0 },
    rentedQuantity: { type: Number, default: 0, min: 0 },
    returnedQuantity: { type: Number, default: 0, min: 0 },
    damagedQuantity: { type: Number, default: 0, min: 0 },
    lostQuantity: { type: Number, default: 0, min: 0 },
    purchasePricePerPiece: { type: Number, required: true, min: 0 },
    purchaseCurrency: { type: String, enum: ['USD', 'SOS'], required: true },
    purchasePriceUsd: { type: Number, required: true, min: 0 },
    purchaseDate: { type: String, required: true },
    description: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const CustomerSchema = new Schema(
  {
    customerId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    siteLocation: { type: String, required: true, trim: true },
    registrationDate: { type: String, required: true },
    notes: { type: String, default: '' },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const RentalSchema = new Schema(
  {
    rentalId: { type: String, required: true, unique: true, index: true },
    clientTransactionId: { type: String, unique: true, sparse: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerCode: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    siteLocation: { type: String, required: true },
    vehicleType: { type: String, required: true },
    vehiclePlate: { type: String, default: '' },
    productCategory: { type: String, enum: ['KABALEETI', 'JEEG'], required: true, index: true },
    inventoryId: { type: String, required: true, index: true },
    inventoryProductId: { type: String, required: true },
    inventoryName: { type: String, required: true },
    quantityRented: { type: Number, required: true, min: 1 },
    quantityReturned: { type: Number, default: 0, min: 0 },
    quantityDamaged: { type: Number, default: 0, min: 0 },
    quantityLost: { type: Number, default: 0, min: 0 },
    quantityRemaining: { type: Number, required: true, min: 0 },
    startDate: { type: String, required: true, index: true },
    expectedReturnDate: { type: String, default: null },
    actualReturnDate: { type: String, default: null },
    pricingMethod: { type: String, enum: ['CONTRACT', 'DAILY_TOTAL', 'PER_PIECE_DAILY'], required: true },
    unitOrContractPrice: { type: Number, required: true, min: 0 },
    rentalDays: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['USD', 'SOS'], required: true },
    exchangeRateSnapshot: { type: Number, required: true, min: 0.01 },
    originalAmount: { type: Number, required: true, min: 0 },
    usdAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['ACTIVE', 'PARTIAL_RETURN', 'COMPLETED', 'OVERDUE'], required: true, index: true },
    notes: { type: String, default: '' },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

const RentalItemSchema = new Schema(
  {
    rentalId: { type: String, required: true, index: true },
    inventoryId: { type: String, required: true },
    productId: { type: String, required: true },
    productCategory: { type: String, enum: ['KABALEETI', 'JEEG'], required: true },
    quantity: { type: Number, required: true, min: 1 },
    pricingMethod: { type: String, enum: ['CONTRACT', 'DAILY_TOTAL', 'PER_PIECE_DAILY'], required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['USD', 'SOS'], required: true },
    originalSubtotal: { type: Number, required: true, min: 0 },
    usdSubtotal: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

const ReturnRecordSchema = new Schema(
  {
    returnId: { type: String, required: true, unique: true, index: true },
    clientTransactionId: { type: String, unique: true, sparse: true, index: true },
    rentalId: { type: String, required: true, index: true },
    rentalCode: { type: String, required: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    productCategory: { type: String, enum: ['KABALEETI', 'JEEG'], required: true },
    inventoryId: { type: String, required: true },
    originalQuantity: { type: Number, required: true, min: 1 },
    quantityReturnedGood: { type: Number, required: true, min: 0 },
    damagedQuantity: { type: Number, default: 0, min: 0 },
    lostQuantity: { type: Number, default: 0, min: 0 },
    remainingAfterReturn: { type: Number, required: true, min: 0 },
    returnDate: { type: String, required: true, index: true },
    condition: { type: String, enum: ['GOOD', 'PARTIAL_DAMAGE', 'DAMAGED', 'LOST_REPORTED'], required: true },
    notes: { type: String, default: '' },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

const PaymentSchema = new Schema(
  {
    paymentId: { type: String, required: true, unique: true, index: true },
    clientTransactionId: { type: String, unique: true, sparse: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    rentalId: { type: String, default: null, index: true },
    rentalCode: { type: String, default: null },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ['USD', 'SOS'], required: true },
    exchangeRateSnapshot: { type: Number, required: true, min: 0.01 },
    usdAmount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: String, required: true, index: true },
    paymentMethod: { type: String, enum: ['CASH', 'EVC_PLUS', 'SAHAL', 'BANK_TRANSFER', 'OTHER'], required: true },
    referenceNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

const ExpenseSchema = new Schema(
  {
    expenseId: { type: String, required: true, unique: true, index: true },
    clientTransactionId: { type: String, unique: true, sparse: true, index: true },
    rentalId: { type: String, default: null, index: true },
    rentalCode: { type: String, default: null },
    customerId: { type: String, default: null, index: true },
    category: {
      type: String,
      enum: ['LOADING', 'UNLOADING', 'TRANSPORTATION', 'FUEL', 'MAINTENANCE', 'OTHER'],
      required: true,
      index: true,
    },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ['USD', 'SOS'], required: true },
    exchangeRateSnapshot: { type: Number, required: true, min: 0.01 },
    usdAmount: { type: Number, required: true, min: 0.01 },
    expenseDate: { type: String, required: true, index: true },
    paidByPerson: { type: String, required: true },
    payerType: { type: String, enum: ['COMPANY', 'CUSTOMER_CHARGED'], required: true, index: true },
    notes: { type: String, default: '' },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

const ExchangeRateSchema = new Schema(
  {
    rate: { type: Number, required: true, min: 0.01 },
    effectiveFrom: { type: String, required: true },
    changedBy: { type: String, required: true },
    changedByName: { type: String, required: true },
    notes: { type: String, default: '' },
    isCurrent: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

const CompanySettingsSchema = new Schema(
  {
    systemName: { type: String, default: 'MSh Company' },
    websiteName: { type: String, default: 'Jeeg iyo Kabaleeti' },
    companyName: { type: String, default: 'MSh Company' },
    logoDataUrl: { type: String, default: '' },
    phone: { type: String, default: '+252 61 000 0000' },
    email: { type: String, default: 'info@mshcompany.so' },
    address: { type: String, default: 'Mogadishu, Somalia' },
    description: { type: String, default: 'Construction Equipment Rental Management' },
    defaultLanguage: { type: String, enum: ['so', 'en'], default: 'so' },
    primaryCurrency: { type: String, enum: ['USD'], default: 'USD' },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

const AuditLogSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userRole: { type: String, enum: ['MANAGER', 'ADMIN'], required: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true },
    previousValues: { type: Schema.Types.Mixed, default: null },
    newValues: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

const SyncRecordSchema = new Schema(
  {
    clientTransactionId: { type: String, required: true, unique: true, index: true },
    entityType: { type: String, enum: ['RENTAL', 'RETURN', 'PAYMENT', 'EXPENSE'], required: true },
    userId: { type: String, required: true },
    status: { type: String, enum: ['SYNCED', 'FAILED'], required: true },
    serverEntityId: { type: String, default: '' },
    clientCreatedAt: { type: String, required: true },
    syncedAt: { type: String, required: true },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

const BackupRecordSchema = new Schema(
  {
    backupId: { type: String, required: true, unique: true },
    triggerType: { type: String, enum: ['AUTOMATIC_SCHEDULED', 'SYSTEM_CHECKPOINT', 'MANUAL_TRIGGER'], required: true },
    storageLocation: { type: String, required: true },
    recordCounts: { type: Schema.Types.Mixed, required: true },
    checksum: { type: String, required: true },
    status: { type: String, enum: ['COMPLETED', 'FAILED'], required: true },
  },
  { timestamps: true }
);

export const MongoModels = {
  User: mongoose.models.User || mongoose.model('User', UserSchema),
  Inventory: mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema),
  Customer: mongoose.models.Customer || mongoose.model('Customer', CustomerSchema),
  Rental: mongoose.models.Rental || mongoose.model('Rental', RentalSchema),
  RentalItem: mongoose.models.RentalItem || mongoose.model('RentalItem', RentalItemSchema),
  ReturnRecord: mongoose.models.ReturnRecord || mongoose.model('ReturnRecord', ReturnRecordSchema),
  Payment: mongoose.models.Payment || mongoose.model('Payment', PaymentSchema),
  Expense: mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema),
  ExchangeRate: mongoose.models.ExchangeRate || mongoose.model('ExchangeRate', ExchangeRateSchema),
  CompanySettings: mongoose.models.CompanySettings || mongoose.model('CompanySettings', CompanySettingsSchema),
  AuditLog: mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema),
  SyncRecord: mongoose.models.SyncRecord || mongoose.model('SyncRecord', SyncRecordSchema),
  BackupRecord: mongoose.models.BackupRecord || mongoose.model('BackupRecord', BackupRecordSchema),
};
