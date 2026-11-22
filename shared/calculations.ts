import type { CurrencyCode, PricingMethod } from './types';

export const DEFAULT_EXCHANGE_RATE = 28; // 1 USD = 28 SOS

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function convertToUsd(
  amount: number,
  currency: CurrencyCode,
  exchangeRate: number = DEFAULT_EXCHANGE_RATE
): number {
  const safeAmount = Number(amount);
  const safeRate = Number(exchangeRate);
  if (!Number.isFinite(safeAmount) || safeAmount < 0) return 0;
  if (currency === 'USD') return round2(safeAmount);
  if (!Number.isFinite(safeRate) || safeRate <= 0) {
    throw new Error('Invalid exchange rate');
  }
  return round2(safeAmount / safeRate);
}

export function calculateRentalDays(startDate: string, expectedReturnDate?: string | null): number {
  if (!startDate || !expectedReturnDate) return 1;
  const start = new Date(startDate);
  const end = new Date(expectedReturnDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diffMs = end.getTime() - start.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

export function calculateRentalAmounts(params: {
  pricingMethod: PricingMethod;
  unitOrContractPrice: number;
  quantityRented: number;
  rentalDays: number;
  currency: CurrencyCode;
  exchangeRate: number;
}): { originalAmount: number; usdAmount: number } {
  const price = Number(params.unitOrContractPrice);
  const qty = Number(params.quantityRented);
  const days = Math.max(1, Math.floor(Number(params.rentalDays) || 1));

  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Price must be a non-negative number');
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  let originalAmount = 0;
  switch (params.pricingMethod) {
    case 'CONTRACT':
      // Method A: Fixed total price for entire rental contract
      originalAmount = round2(price);
      break;
    case 'DAILY_TOTAL':
      // Method B: Total daily price for all rented equipment combined * days
      originalAmount = round2(price * days);
      break;
    case 'PER_PIECE_DAILY':
      // Method C: Quantity * price per piece per day * days
      originalAmount = round2(qty * price * days);
      break;
    default:
      throw new Error('Unsupported pricing method');
  }

  const usdAmount = convertToUsd(originalAmount, params.currency, params.exchangeRate);
  return { originalAmount, usdAmount };
}

export function formatUsd(amount: number): string {
  return `$${round2(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatSos(amount: number): string {
  return `${round2(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} SOS`;
}

export function formatCurrencyValue(amount: number, currency: CurrencyCode): string {
  return currency === 'USD' ? formatUsd(amount) : formatSos(amount);
}
