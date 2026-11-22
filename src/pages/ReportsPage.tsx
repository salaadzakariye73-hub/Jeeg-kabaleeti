import { FileDown, Printer } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUsd, round2 } from '../../shared/calculations';
import type {
  CurrencyCode,
  CustomerDTO,
  EquipmentCategory,
  ExpenseDTO,
  InventoryItemDTO,
  PaymentDTO,
  RentalDTO,
  ReturnRecordDTO,
} from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { exportTableReportPdf } from '../services/pdfGenerator';

type ReportKind =
  | 'DAILY_RENTAL'
  | 'WEEKLY_RENTAL'
  | 'MONTHLY_RENTAL'
  | 'YEARLY_RENTAL'
  | 'INVENTORY'
  | 'RETURNS'
  | 'OUTSTANDING_EQUIP'
  | 'CUSTOMER_DEBT'
  | 'EXPENSES'
  | 'REVENUE'
  | 'PAYMENTS'
  | 'DAMAGED'
  | 'LOST';

export const ReportsPage: React.FC = () => {
  const { t, settings } = useApp();

  const [reportType, setReportType] = useState<ReportKind>('MONTHLY_RENTAL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState<'ALL' | EquipmentCategory>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | CurrencyCode>('ALL');

  const [inventory, setInventory] = useState<InventoryItemDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [rentals, setRentals] = useState<RentalDTO[]>([]);
  const [returns, setReturns] = useState<ReturnRecordDTO[]>([]);
  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, cus, ren, ret, pay, exp] = await Promise.all([
        api.listInventory(),
        api.listCustomers(),
        api.listRentals(),
        api.listReturns(),
        api.listPayments(),
        api.listExpenses(),
      ]);
      setInventory(inv.data);
      setCustomers(cus.data);
      setRentals(ren.data);
      setReturns(ret.data);
      setPayments(pay.data);
      setExpenses(exp.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const inDateRange = useCallback(
    (d: string) => {
      const day = d.slice(0, 10);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      return true;
    },
    [fromDate, toDate]
  );

  const filteredRentals = useMemo(() => {
    const today = new Date();
    return rentals.filter((r) => {
      if (!inDateRange(r.startDate)) return false;
      if (customerFilter !== 'ALL' && r.customerId !== customerFilter) return false;
      if (productFilter !== 'ALL' && r.productCategory !== productFilter) return false;
      if (currencyFilter !== 'ALL' && r.currency !== currencyFilter) return false;

      if (reportType === 'DAILY_RENTAL') {
        return r.startDate.slice(0, 10) === today.toISOString().slice(0, 10);
      }
      if (reportType === 'WEEKLY_RENTAL') {
        const d = new Date(r.startDate);
        const diff = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 7 && diff >= -1;
      }
      if (reportType === 'MONTHLY_RENTAL') {
        return r.startDate.slice(0, 7) === today.toISOString().slice(0, 7);
      }
      if (reportType === 'YEARLY_RENTAL') {
        return r.startDate.slice(0, 4) === today.toISOString().slice(0, 4);
      }
      return true;
    });
  }, [rentals, inDateRange, customerFilter, productFilter, currencyFilter, reportType]);

  const reportData = useMemo((): { title: string; columns: string[]; rows: (string | number)[][]; totalUsd?: number } => {
    switch (reportType) {
      case 'DAILY_RENTAL':
      case 'WEEKLY_RENTAL':
      case 'MONTHLY_RENTAL':
      case 'YEARLY_RENTAL': {
        const titleMap: Record<string, string> = {
          DAILY_RENTAL: t.reports.dailyRentals,
          WEEKLY_RENTAL: t.reports.weeklyRentals,
          MONTHLY_RENTAL: t.reports.monthlyRentals,
          YEARLY_RENTAL: t.reports.yearlyRentals,
        };
        const totalUsd = round2(filteredRentals.reduce((s, r) => s + r.usdAmount, 0));
        return {
          title: titleMap[reportType],
          columns: ['Rental ID', 'Customer', 'Category', 'Qty', 'Start Date', 'Currency', 'USD Total', 'Status'],
          rows: filteredRentals.map((r) => [
            r.rentalId,
            r.customerName,
            r.productCategory,
            r.quantityRented,
            r.startDate,
            r.currency,
            formatUsd(r.usdAmount),
            r.status,
          ]),
          totalUsd,
        };
      }

      case 'INVENTORY': {
        const list = productFilter === 'ALL' ? inventory : inventory.filter((i) => i.category === productFilter);
        return {
          title: t.reports.inventoryReport,
          columns: ['Product ID', 'Name', 'Category', 'Total', 'Available', 'Rented', 'Returned', 'Damaged', 'Lost'],
          rows: list.map((i) => [
            i.productId,
            i.name,
            i.category,
            i.totalQuantity,
            i.availableQuantity,
            i.rentedQuantity,
            i.returnedQuantity,
            i.damagedQuantity,
            i.lostQuantity,
          ]),
        };
      }

      case 'RETURNS': {
        const list = returns.filter((ret) => {
          if (!inDateRange(ret.returnDate)) return false;
          if (customerFilter !== 'ALL' && ret.customerId !== customerFilter) return false;
          if (productFilter !== 'ALL' && ret.productCategory !== productFilter) return false;
          return true;
        });
        return {
          title: t.reports.returnReport,
          columns: ['Return ID', 'Rental ID', 'Customer', 'Category', 'Good', 'Damaged', 'Lost', 'Remaining', 'Date'],
          rows: list.map((ret) => [
            ret.returnId,
            ret.rentalCode,
            ret.customerName,
            ret.productCategory,
            ret.quantityReturnedGood,
            ret.damagedQuantity,
            ret.lostQuantity,
            ret.remainingAfterReturn,
            ret.returnDate,
          ]),
        };
      }

      case 'OUTSTANDING_EQUIP': {
        const open = rentals.filter((r) => {
          if (r.quantityRemaining <= 0) return false;
          if (customerFilter !== 'ALL' && r.customerId !== customerFilter) return false;
          if (productFilter !== 'ALL' && r.productCategory !== productFilter) return false;
          return true;
        });
        return {
          title: t.reports.outstandingEquipReport,
          columns: ['Rental ID', 'Customer', 'Phone', 'Site', 'Category', 'Rented', 'Remaining', 'Expected Return'],
          rows: open.map((r) => [
            r.rentalId,
            r.customerName,
            r.customerPhone,
            r.siteLocation,
            r.productCategory,
            r.quantityRented,
            r.quantityRemaining,
            r.expectedReturnDate || '-',
          ]),
        };
      }

      case 'CUSTOMER_DEBT': {
        const rows: (string | number)[][] = [];
        let totalDebt = 0;
        for (const c of customers) {
          if (customerFilter !== 'ALL' && c.id !== customerFilter) continue;
          const cRentals = rentals.filter((r) => r.customerId === c.id);
          const rIds = new Set(cRentals.map((r) => r.id));
          const charges = cRentals.reduce((s, r) => s + r.usdAmount, 0);
          const custExp = expenses
            .filter((e) => e.payerType === 'CUSTOMER_CHARGED' && (e.customerId === c.id || (e.rentalId && rIds.has(e.rentalId))))
            .reduce((s, e) => s + e.usdAmount, 0);
          const paid = payments.filter((p) => p.customerId === c.id).reduce((s, p) => s + p.usdAmount, 0);
          const due = round2(charges + custExp);
          const bal = round2(Math.max(0, due - paid));
          totalDebt = round2(totalDebt + bal);
          rows.push([c.customerId, c.fullName, c.phone, formatUsd(due), formatUsd(paid), formatUsd(bal)]);
        }
        return {
          title: t.reports.customerDebtReport,
          columns: ['Customer ID', 'Customer Name', 'Phone', 'Total Due (USD)', 'Paid (USD)', 'Outstanding Debt (USD)'],
          rows,
          totalUsd: totalDebt,
        };
      }

      case 'EXPENSES': {
        const list = expenses.filter((e) => {
          if (!inDateRange(e.expenseDate)) return false;
          if (currencyFilter !== 'ALL' && e.currency !== currencyFilter) return false;
          return true;
        });
        const totalUsd = round2(list.reduce((s, e) => s + e.usdAmount, 0));
        return {
          title: t.reports.expenseReport,
          columns: ['Expense ID', 'Category', 'Description', 'Payer Type', 'Paid By', 'Date', 'USD Amount'],
          rows: list.map((e) => [
            e.expenseId,
            e.category,
            e.description,
            e.payerType,
            e.paidByPerson,
            e.expenseDate,
            formatUsd(e.usdAmount),
          ]),
          totalUsd,
        };
      }

      case 'REVENUE': {
        const list = rentals.filter((r) => {
          if (!inDateRange(r.startDate)) return false;
          if (customerFilter !== 'ALL' && r.customerId !== customerFilter) return false;
          if (productFilter !== 'ALL' && r.productCategory !== productFilter) return false;
          if (currencyFilter !== 'ALL' && r.currency !== currencyFilter) return false;
          return true;
        });
        const totalUsd = round2(list.reduce((s, r) => s + r.usdAmount, 0));
        return {
          title: t.reports.revenueReport,
          columns: ['Rental ID', 'Customer', 'Pricing Method', 'Orig Currency', 'Orig Amount', 'Rate', 'USD Revenue'],
          rows: list.map((r) => [
            r.rentalId,
            r.customerName,
            r.pricingMethod,
            r.currency,
            r.originalAmount,
            r.exchangeRateSnapshot,
            formatUsd(r.usdAmount),
          ]),
          totalUsd,
        };
      }

      case 'PAYMENTS': {
        const list = payments.filter((p) => {
          if (!inDateRange(p.paymentDate)) return false;
          if (customerFilter !== 'ALL' && p.customerId !== customerFilter) return false;
          if (currencyFilter !== 'ALL' && p.currency !== currencyFilter) return false;
          return true;
        });
        const totalUsd = round2(list.reduce((s, p) => s + p.usdAmount, 0));
        return {
          title: t.reports.paymentReport,
          columns: ['Payment ID', 'Customer', 'Rental', 'Method', 'Currency', 'Date', 'USD Amount'],
          rows: list.map((p) => [
            p.paymentId,
            p.customerName,
            p.rentalCode || '-',
            p.paymentMethod,
            p.currency,
            p.paymentDate,
            formatUsd(p.usdAmount),
          ]),
          totalUsd,
        };
      }

      case 'DAMAGED': {
        const list = returns.filter((r) => r.damagedQuantity > 0 && inDateRange(r.returnDate));
        return {
          title: t.reports.damagedReport,
          columns: ['Return ID', 'Rental ID', 'Customer', 'Category', 'Damaged Qty', 'Return Date', 'Notes'],
          rows: list.map((r) => [
            r.returnId,
            r.rentalCode,
            r.customerName,
            r.productCategory,
            r.damagedQuantity,
            r.returnDate,
            r.notes || '-',
          ]),
        };
      }

      case 'LOST': {
        const list = returns.filter((r) => r.lostQuantity > 0 && inDateRange(r.returnDate));
        return {
          title: t.reports.lostReport,
          columns: ['Return ID', 'Rental ID', 'Customer', 'Category', 'Lost Qty', 'Return Date', 'Notes'],
          rows: list.map((r) => [
            r.returnId,
            r.rentalCode,
            r.customerName,
            r.productCategory,
            r.lostQuantity,
            r.returnDate,
            r.notes || '-',
          ]),
        };
      }
    }
  }, [
    reportType,
    filteredRentals,
    inventory,
    returns,
    rentals,
    customers,
    payments,
    expenses,
    inDateRange,
    customerFilter,
    productFilter,
    currencyFilter,
    t,
  ]);

  const handleExportPdf = () => {
    exportTableReportPdf({
      title: reportData.title,
      subtitle: `Primary Accounting Currency: USD  ·  Generated: ${new Date().toISOString().slice(0, 10)}`,
      columns: reportData.columns,
      rows: reportData.rows,
      settings,
      filename: `${reportType.toLowerCase()}_report.pdf`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="no-print bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-bold text-[#202B38]">{t.reports.title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 rounded-lg bg-[#245B91] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1c4975] min-h-[40px]"
            >
              <FileDown className="w-4 h-4" />
              <span>{t.app.exportPdf}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#202B38] hover:bg-slate-50 min-h-[40px]"
            >
              <Printer className="w-4 h-4" />
              <span>{t.app.print}</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {t.reports.selectReport}
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportKind)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium min-h-[40px]"
            >
              <option value="DAILY_RENTAL">{t.reports.dailyRentals}</option>
              <option value="WEEKLY_RENTAL">{t.reports.weeklyRentals}</option>
              <option value="MONTHLY_RENTAL">{t.reports.monthlyRentals}</option>
              <option value="YEARLY_RENTAL">{t.reports.yearlyRentals}</option>
              <option value="INVENTORY">{t.reports.inventoryReport}</option>
              <option value="RETURNS">{t.reports.returnReport}</option>
              <option value="OUTSTANDING_EQUIP">{t.reports.outstandingEquipReport}</option>
              <option value="CUSTOMER_DEBT">{t.reports.customerDebtReport}</option>
              <option value="EXPENSES">{t.reports.expenseReport}</option>
              <option value="REVENUE">{t.reports.revenueReport}</option>
              <option value="PAYMENTS">{t.reports.paymentReport}</option>
              <option value="DAMAGED">{t.reports.damagedReport}</option>
              <option value="LOST">{t.reports.lostReport}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {t.app.fromDate}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs min-h-[40px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {t.app.toDate}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs min-h-[40px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {t.payments.customer}
            </label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs min-h-[40px]"
            >
              <option value="ALL">{t.reports.filterCustomer}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {t.inventory.category}
              </label>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value as 'ALL' | EquipmentCategory)}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs min-h-[40px]"
              >
                <option value="ALL">{t.app.all}</option>
                <option value="KABALEETI">KABALEETI</option>
                <option value="JEEG">JEEG</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {t.payments.currency}
              </label>
              <select
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value as 'ALL' | CurrencyCode)}
                className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs min-h-[40px]"
              >
                <option value="ALL">{t.app.all}</option>
                <option value="USD">USD</option>
                <option value="SOS">SOS</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Report Table Output */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#202B38]">{reportData.title}</h3>
            <p className="text-xs text-slate-500">
              {reportData.rows.length} rows · Primary Currency: USD
            </p>
          </div>
          {reportData.totalUsd !== undefined && (
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total (USD)</span>
              <strong className="font-mono-tabular text-lg text-[#172B42]">
                {formatUsd(reportData.totalUsd)}
              </strong>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.loading}</div>
        ) : reportData.rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.noData}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  {reportData.columns.map((col) => (
                    <th key={col} className="py-3 px-4 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {reportData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-3 px-4 font-mono-tabular whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
