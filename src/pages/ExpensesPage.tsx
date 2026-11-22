import { AlertCircle, CheckCircle2, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { convertToUsd, formatCurrencyValue, formatUsd } from '../../shared/calculations';
import type {
  CurrencyCode,
  ExpenseCategory,
  ExpenseDTO,
  ExpensePayerType,
  RentalDTO,
} from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export const ExpensesPage: React.FC = () => {
  const { user, t, currentRate } = useApp();
  const isAdmin = user?.role === 'ADMIN';

  const [expenses, setExpenses] = useState<ExpenseDTO[]>([]);
  const [rentals, setRentals] = useState<RentalDTO[]>([]);
  const [filterPayer, setFilterPayer] = useState<'ALL' | ExpensePayerType>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [rentalId, setRentalId] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('LOADING');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidByPerson, setPaidByPerson] = useState('');
  const [payerType, setPayerType] = useState<ExpensePayerType>('COMPANY');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [expRes, rentRes] = await Promise.all([api.listExpenses(), api.listRentals()]);
      setExpenses(expRes.data);
      setRentals(rentRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const usdPreview = useMemo(() => {
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return convertToUsd(num, currency, currentRate);
  }, [amount, currency, currentRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const res = await api.createExpense({
        rentalId: rentalId || null,
        category,
        description,
        amount: Number(amount),
        currency,
        exchangeRateSnapshot: currentRate,
        expenseDate,
        paidByPerson,
        payerType,
        notes,
      });
      setShowForm(false);
      setDescription('');
      setAmount('');
      setPaidByPerson('');
      setNotes('');
      setNotice(
        res.queuedOffline
          ? `${res.record.expenseId} — ${t.app.pendingSync}`
          : `${res.record.expenseId} — ${t.app.synchronized}`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStr = todayStr.slice(0, 7);

  const companyExpensesUsd = expenses
    .filter((e) => e.payerType === 'COMPANY')
    .reduce((s, e) => s + e.usdAmount, 0);
  const customerChargedUsd = expenses
    .filter((e) => e.payerType === 'CUSTOMER_CHARGED')
    .reduce((s, e) => s + e.usdAmount, 0);
  const todayCompanyUsd = expenses
    .filter((e) => e.payerType === 'COMPANY' && e.expenseDate.slice(0, 10) === todayStr)
    .reduce((s, e) => s + e.usdAmount, 0);
  const monthCompanyUsd = expenses
    .filter((e) => e.payerType === 'COMPANY' && e.expenseDate.slice(0, 7) === monthStr)
    .reduce((s, e) => s + e.usdAmount, 0);

  const visible =
    filterPayer === 'ALL' ? expenses : expenses.filter((e) => e.payerType === filterPayer);

  const catLabel = (c: ExpenseCategory) => {
    switch (c) {
      case 'LOADING':
        return t.expenses.catLoading;
      case 'UNLOADING':
        return t.expenses.catUnloading;
      case 'TRANSPORTATION':
        return t.expenses.catTransport;
      case 'FUEL':
        return t.expenses.catFuel;
      case 'MAINTENANCE':
        return t.expenses.catMaintenance;
      default:
        return t.expenses.catOther;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#202B38]">{t.expenses.title}</h2>
          <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['ALL', 'COMPANY', 'CUSTOMER_CHARGED'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFilterPayer(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                  filterPayer === p ? 'bg-white text-[#172B42] shadow-sm' : 'text-slate-600'
                }`}
              >
                {p === 'ALL'
                  ? t.app.all
                  : p === 'COMPANY'
                  ? t.expenses.payerCompany
                  : t.expenses.payerCustomer}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E58A24] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#cf7a1b] min-h-[44px] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t.expenses.recordExpense}</span>
          </button>
        )}
      </div>

      {/* Expense Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{t.expenses.totalCompanyExpenses}</p>
          <p className="mt-1 text-xl font-bold font-mono-tabular text-[#D64545]">
            {formatUsd(companyExpensesUsd)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{t.expenses.totalCustomerCharged}</p>
          <p className="mt-1 text-xl font-bold font-mono-tabular text-[#245B91]">
            {formatUsd(customerChargedUsd)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Today (Company)</p>
          <p className="mt-1 text-xl font-bold font-mono-tabular text-[#202B38]">
            {formatUsd(todayCompanyUsd)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">This Month (Company)</p>
          <p className="mt-1 text-xl font-bold font-mono-tabular text-[#202B38]">
            {formatUsd(monthCompanyUsd)}
          </p>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#238653]/30 bg-[#238653]/10 p-4 text-sm text-[#238653] font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-[#D64545]/30 bg-[#D64545]/10 p-4 text-sm text-[#D64545]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.loading}</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.noData}</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">{t.expenses.expenseId}</th>
                    <th className="py-3 px-4">{t.expenses.category}</th>
                    <th className="py-3 px-4">{t.expenses.description}</th>
                    <th className="py-3 px-4">{t.rentals.rentalId}</th>
                    <th className="py-3 px-4">{t.expenses.payerType}</th>
                    <th className="py-3 px-4">{t.expenses.paidByPerson}</th>
                    <th className="py-3 px-4">{t.expenses.expenseDate}</th>
                    <th className="py-3 px-4 text-right">{t.payments.usdEquivalent}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {visible.map((ex) => (
                    <tr key={ex.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-[#172B42]">
                        <div>{ex.expenseId}</div>
                        {ex.pendingSync && (
                          <span className="text-[11px] font-sans text-[#E58A24]">
                            {t.app.pendingSync}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-[#202B38]">
                        {catLabel(ex.category)}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{ex.description}</td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-500">
                        {ex.rentalCode || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span
                          className={
                            ex.payerType === 'COMPANY'
                              ? 'text-[#D64545] font-semibold'
                              : 'text-[#245B91] font-semibold'
                          }
                        >
                          {ex.payerType === 'COMPANY'
                            ? t.expenses.payerCompany
                            : t.expenses.payerCustomer}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{ex.paidByPerson}</td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-500">
                        {ex.expenseDate}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        <div className="font-bold text-[#202B38]">{formatUsd(ex.usdAmount)}</div>
                        {ex.currency === 'SOS' && (
                          <div className="text-xs text-slate-400">
                            {formatCurrencyValue(ex.amount, 'SOS')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {visible.map((ex) => (
                <div key={ex.id} className="p-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono-tabular font-semibold">{ex.expenseId}</span>
                    <span className="font-mono-tabular text-slate-500">{ex.expenseDate}</span>
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-bold text-sm text-[#202B38]">{catLabel(ex.category)}</p>
                      <p className="text-xs text-slate-600">{ex.description}</p>
                      <p className="text-xs text-slate-500">
                        {ex.paidByPerson} · {ex.payerType === 'COMPANY' ? t.expenses.payerCompany : t.expenses.payerCustomer}
                      </p>
                    </div>
                    <strong className="font-mono-tabular text-sm text-[#202B38]">
                      {formatUsd(ex.usdAmount)}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Record Expense Modal */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl my-6">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202B38]">{t.expenses.recordExpense}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.expenses.category}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="LOADING">{t.expenses.catLoading}</option>
                    <option value="UNLOADING">{t.expenses.catUnloading}</option>
                    <option value="TRANSPORTATION">{t.expenses.catTransport}</option>
                    <option value="FUEL">{t.expenses.catFuel}</option>
                    <option value="MAINTENANCE">{t.expenses.catMaintenance}</option>
                    <option value="OTHER">{t.expenses.catOther}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.expenses.payerType}</label>
                  <select
                    value={payerType}
                    onChange={(e) => setPayerType(e.target.value as ExpensePayerType)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="COMPANY">{t.expenses.payerCompany}</option>
                    <option value="CUSTOMER_CHARGED">{t.expenses.payerCustomer}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">{t.expenses.relatedRental}</label>
                <select
                  value={rentalId}
                  onChange={(e) => setRentalId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                >
                  <option value="">-- None --</option>
                  {rentals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.rentalId} — {r.customerName} ({r.productCategory})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">{t.expenses.description}</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Rarista iyo dejinta 150 Jeeg"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.expenses.amount}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.payments.currency}</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="USD">USD</option>
                    <option value="SOS">SOS</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg bg-[#F3F5F8] p-3 flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  {t.payments.usdEquivalent} (1 USD = {currentRate} SOS)
                </span>
                <strong className="font-mono-tabular text-sm text-[#202B38]">
                  {formatUsd(usdPreview)}
                </strong>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.expenses.expenseDate}</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.expenses.paidByPerson}</label>
                  <input
                    type="text"
                    required
                    value={paidByPerson}
                    onChange={(e) => setPaidByPerson(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">{t.rentals.notes}</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold min-h-[44px]"
                >
                  {t.app.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#E58A24] px-5 py-2 text-xs font-semibold text-white min-h-[44px]"
                >
                  {submitting ? t.app.loading : t.app.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
