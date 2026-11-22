export type UserRole = 'MANAGER' | 'ADMIN';
export type EquipmentCategory = 'KABALEETI' | 'JEEG';
export type CurrencyCode = 'USD' | 'SOS';
export type PricingMethod = 'CONTRACT' | 'DAILY_TOTAL' | 'PER_PIECE_DAILY';
export type RentalStatus = 'ACTIVE' | 'PARTIAL_RETURN' | 'COMPLETED' | 'OVERDUE';
export type ReturnCondition = 'GOOD' | 'PARTIAL_DAMAGE' | 'DAMAGED' | 'LOST_REPORTED';
export type ExpenseCategory =
  | 'LOADING'
  | 'UNLOADING'
  | 'TRANSPORTATION'
  | 'FUEL'
  | 'MAINTENANCE'
  | 'OTHER';
export type ExpensePayerType = 'COMPANY' | 'CUSTOMER_CHARGED';
export type PaymentMethod = 'CASH' | 'EVC_PLUS' | 'SAHAL' | 'BANK_TRANSFER' | 'OTHER';
export type LanguageCode = 'so' | 'en';

export interface UserDTO {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface InventoryItemDTO {
  id: string;
  productId: string;
  name: string;
  category: EquipmentCategory;
  totalQuantity: number;
  availableQuantity: number;
  rentedQuantity: number;
  returnedQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  purchasePricePerPiece: number;
  purchaseCurrency: CurrencyCode;
  purchasePriceUsd: number;
  purchaseDate: string;
  description?: string;
  photoUrl?: string;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDTO {
  id: string;
  customerId: string;
  fullName: string;
  phone: string;
  siteLocation: string;
  registrationDate: string;
  notes?: string;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RentalDTO {
  id: string;
  rentalId: string;
  clientTransactionId?: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  customerPhone: string;
  siteLocation: string;
  vehicleType: string;
  vehiclePlate?: string;
  productCategory: EquipmentCategory;
  inventoryId: string;
  inventoryProductId: string;
  inventoryName: string;
  quantityRented: number;
  quantityReturned: number;
  quantityDamaged: number;
  quantityLost: number;
  quantityRemaining: number;
  startDate: string;
  expectedReturnDate?: string | null;
  actualReturnDate?: string | null;
  pricingMethod: PricingMethod;
  unitOrContractPrice: number;
  rentalDays: number;
  currency: CurrencyCode;
  exchangeRateSnapshot: number;
  originalAmount: number;
  usdAmount: number;
  status: RentalStatus;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  pendingSync?: boolean;
}

export interface RentalItemDTO {
  id: string;
  rentalId: string;
  inventoryId: string;
  productId: string;
  productCategory: EquipmentCategory;
  quantity: number;
  pricingMethod: PricingMethod;
  unitPrice: number;
  currency: CurrencyCode;
  originalSubtotal: number;
  usdSubtotal: number;
  createdAt: string;
}

export interface ReturnRecordDTO {
  id: string;
  returnId: string;
  clientTransactionId?: string;
  rentalId: string;
  rentalCode: string;
  customerId: string;
  customerName: string;
  productCategory: EquipmentCategory;
  inventoryId: string;
  originalQuantity: number;
  quantityReturnedGood: number;
  damagedQuantity: number;
  lostQuantity: number;
  remainingAfterReturn: number;
  returnDate: string;
  condition: ReturnCondition;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  pendingSync?: boolean;
}

export interface PaymentDTO {
  id: string;
  paymentId: string;
  clientTransactionId?: string;
  customerId: string;
  customerName: string;
  rentalId?: string | null;
  rentalCode?: string | null;
  amount: number;
  currency: CurrencyCode;
  exchangeRateSnapshot: number;
  usdAmount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  pendingSync?: boolean;
}

export interface ExpenseDTO {
  id: string;
  expenseId: string;
  clientTransactionId?: string;
  rentalId?: string | null;
  rentalCode?: string | null;
  customerId?: string | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRateSnapshot: number;
  usdAmount: number;
  expenseDate: string;
  paidByPerson: string;
  payerType: ExpensePayerType;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  pendingSync?: boolean;
}

export interface ExchangeRateDTO {
  id: string;
  rate: number;
  effectiveFrom: string;
  changedBy: string;
  changedByName: string;
  notes?: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface CompanySettingsDTO {
  id: string;
  systemName: string;
  websiteName: string;
  companyName: string;
  logoDataUrl?: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  defaultLanguage: LanguageCode;
  primaryCurrency: 'USD';
  updatedAt: string;
}

export interface AuditLogDTO {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  createdAt: string;
}

export interface SyncRecordDTO {
  id: string;
  clientTransactionId: string;
  entityType: 'RENTAL' | 'RETURN' | 'PAYMENT' | 'EXPENSE';
  userId: string;
  status: 'SYNCED' | 'FAILED';
  serverEntityId?: string;
  clientCreatedAt: string;
  syncedAt: string;
  errorMessage?: string;
}

export interface BackupRecordDTO {
  id: string;
  backupId: string;
  triggerType: 'AUTOMATIC_SCHEDULED' | 'SYSTEM_CHECKPOINT' | 'MANUAL_TRIGGER';
  storageLocation: string;
  recordCounts: Record<string, number>;
  checksum: string;
  status: 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export interface DashboardSummaryDTO {
  totalKabaleeti: number;
  totalJeeg: number;
  availableInventory: number;
  rentedEquipment: number;
  returnedEquipment: number;
  damagedEquipment: number;
  lostEquipment: number;
  activeRentalsCount: number;
  overdueRentalsCount: number;
  totalRentalRevenueUsd: number;
  totalPaymentsReceivedUsd: number;
  outstandingCustomerBalancesUsd: number;
  totalCompanyExpensesUsd: number;
  totalCustomerChargedExpensesUsd: number;
  netProfitUsd: number;
  dailyActivity: Array<{ date: string; rentalsCount: number; revenueUsd: number }>;
  monthlyRevenue: Array<{ month: string; revenueUsd: number; paymentsUsd: number; expensesUsd: number }>;
  expenseByCategory: Array<{ category: ExpenseCategory; amountUsd: number }>;
  rentalStatusCounts: Record<RentalStatus, number>;
}
