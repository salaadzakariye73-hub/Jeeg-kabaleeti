import { AlertCircle, CheckCircle2, Plus, Printer, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { convertToUsd, formatCurrencyValue, formatUsd } from '../../shared/calculations';
import type {
  CurrencyCode,
  CustomerDTO,
  ExpenseDTO,
  PaymentDTO,
  PaymentMethod,
  RentalDTO,
} from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { exportPaymentReceiptPdf } from '../services/pdfGenerator';

export const PaymentsPage: React.FC = () => {
  const { user, t, currentRate, settings } = useApp();
  const isAdmin = user?.role === 'ADMIN';

  const [payments, setPayments] = useState<PaymentDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [rentals, setRentals] = useState<RentalDTO[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [rentalId, setRentalId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [payRes, cusRes, rentRes, expRes] = await Promise.all([
        api.listPayments(),
        api.listCustomers(),
        api.listRentals(),
        api.listExpenses(),
      ]);
      setPayments(payRes.data);
      setCustomers(cusRes.data);
      setRentals(rentRes.data);
      setExpenses(expRes.data);
      if (cusRes.data.length > 0 && !customerId) {
        setCustomerId(cusRes.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const customerRentals = useMemo(
    () => rentals.filter((r) => r.customerId === customerId),
    [rentals, customerId]
  );

  const selectedCustomerBalance = useMemo(() => {
    if (!customerId) return 0;
    const rentalIds = new Set(customerRentals.map((r) => r.id));
    const rentalCharges = customerRentals.reduce((s, r) => s + r.usdAmount, 0);
    const custExpenses = expenses
      .filter((e) => e.payerType === 'CUSTOMER_CHARGED' && (e.customerId === customerId || (e.rentalId && rentalIds.has(e.rentalId))))
      .reduce((s, e) => s + e.usdAmount, 0);
    const paid = payments.filter((p) => p.customerId === customerId).reduce((s, p) => s + p.usdAmount, 0);
    return Math.max(0, rentalCharges + custExpenses - paid);
  }, [customerId, customerRentals, expenses, payments]);

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
      const res = await api.createPayment({
        customerId,
        rentalId: rentalId || null,
        amount: Number(amount),
        currency,
        exchangeRateSnapshot: currentRate,
        paymentDate,
        paymentMethod,
        referenceNumber,
        notes,
      });
      setShowForm(false);
      setAmount('');
      setReferenceNumber('');
      setNotes('');
      setNotice(
        res.queuedOffline
          ? `${res.record.paymentId} — ${t.app.pendingSync}`
          : `${res.record.paymentId} — ${t.app.synchronized}`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const totalReceivedUsd = payments.reduce((s, p) => s + p.usdAmount, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#202B38]">{t.payments.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.dashboard.totalPayments}:{' '}
            <strong className="font-mono-tabular text-[#238653]">{formatUsd(totalReceivedUsd)}</strong>
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            disabled={customers.length === 0}
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#238653] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1c6d43] disabled:opacity-50 min-h-[44px] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t.payments.recordPayment}</span>
          </button>
        )}
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
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.noData}</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">{t.payments.paymentId}</th>
                    <th className="py-3 px-4">{t.payments.customer}</th>
                    <th className="py-3 px-4">{t.rentals.rentalId}</th>
                    <th className="py-3 px-4">{t.payments.method}</th>
                    <th className="py-3 px-4">{t.payments.paymentDate}</th>
                    <th className="py-3 px-4 text-right">{t.payments.amount}</th>
                    <th className="py-3 px-4 text-right">{t.payments.usdEquivalent}</th>
                    <th className="py-3 px-4 text-right">{t.app.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-[#172B42]">
                        <div>{p.paymentId}</div>
                        {p.pendingSync && (
                          <span className="text-[11px] font-sans text-[#E58A24]">
                            {t.app.pendingSync}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#202B38]">{p.customerName}</td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600">
                        {p.rentalCode || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {p.paymentMethod} {p.referenceNumber ? `· ${p.referenceNumber}` : ''}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-500">
                        {p.paymentDate}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-xs">
                        {formatCurrencyValue(p.amount, p.currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#238653]">
                        {formatUsd(p.usdAmount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => exportPaymentReceiptPdf(p, settings, t.payments.receiptTitle)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-[#202B38] hover:bg-slate-50"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {payments.map((p) => (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono-tabular font-semibold text-[#172B42]">{p.paymentId}</span>
                    <span className="font-mono-tabular text-slate-500">{p.paymentDate}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-[#202B38]">{p.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {p.paymentMethod} {p.rentalCode ? `· ${p.rentalCode}` : ''}
                      </p>
                    </div>
                    <div className="text-right font-mono-tabular">
                      <p className="font-bold text-[#238653]">{formatUsd(p.usdAmount)}</p>
                      {p.currency === 'SOS' && (
                        <p className="text-xs text-slate-500">{formatCurrencyValue(p.amount, 'SOS')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => exportPaymentReceiptPdf(p, settings, t.payments.receiptTitle)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold min-h-[38px]"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{t.app.exportPdf}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Record Payment Modal */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl my-6">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202B38]">{t.payments.recordPayment}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">{t.payments.customer}</label>
                <select
                  required
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    setRentalId('');
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customerId} — {c.fullName} ({c.phone})
                    </option>
                  ))}
                </select>
                {customerId && (
                  <p className="mt-1.5 text-xs text-slate-600">
                    {t.customers.outstandingDebt}:{' '}
                    <strong className="font-mono-tabular text-[#D64545]">
                      {formatUsd(selectedCustomerBalance)}
                    </strong>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">{t.payments.relatedRental}</label>
                <select
                  value={rentalId}
                  onChange={(e) => setRentalId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                >
                  <option value="">-- {t.app.all} --</option>
                  {customerRentals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.rentalId} — {r.productCategory} ({formatUsd(r.usdAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.payments.amount}</label>
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
                <strong className="font-mono-tabular text-sm text-[#238653]">
                  {formatUsd(usdPreview)}
                </strong>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.payments.paymentDate}</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.payments.method}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="CASH">{t.payments.methodCash}</option>
                    <option value="EVC_PLUS">{t.payments.methodEvc}</option>
                    <option value="SAHAL">{t.payments.methodSahal}</option>
                    <option value="BANK_TRANSFER">{t.payments.methodBank}</option>
                    <option value="OTHER">{t.payments.methodOther}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">{t.payments.referenceNumber}</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
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
                  className="rounded-lg bg-[#238653] px-5 py-2 text-xs font-semibold text-white min-h-[44px]"
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
