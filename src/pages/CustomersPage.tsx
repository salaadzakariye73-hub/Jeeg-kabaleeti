import { AlertCircle, Eye, Plus, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { formatUsd } from '../../shared/calculations';
import type {
  CustomerDTO,
  ExpenseDTO,
  PaymentDTO,
  RentalDTO,
  ReturnRecordDTO,
} from '../../shared/types';
import { RentalStatusLabel } from '../components/StatusLabel';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

interface CustomerProfileData {
  customer: CustomerDTO;
  rentals: RentalDTO[];
  returns: ReturnRecordDTO[];
  payments: PaymentDTO[];
  expenses: ExpenseDTO[];
  summary: {
    totalEquipmentRented: number;
    totalEquipmentReturned: number;
    remainingEquipment: number;
    totalRentalChargesUsd: number;
    customerChargedExpensesUsd: number;
    totalAmountDueUsd: number;
    paymentsReceivedUsd: number;
    outstandingBalanceUsd: number;
  };
}

export const CustomersPage: React.FC = () => {
  const { user, t } = useApp();
  const isAdmin = user?.role === 'ADMIN';

  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDTO | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<CustomerProfileData | null>(null);

  const loadCustomers = useCallback(async (q?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.listCustomers(q);
      setCustomers(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(search);
    }, 180);
    return () => clearTimeout(timer);
  }, [search, loadCustomers]);

  const openProfile = async (id: string) => {
    setError('');
    try {
      const data = await api.getCustomerProfile(id);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer profile');
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, { fullName, phone, siteLocation, notes });
      } else {
        await api.createCustomer({ fullName, phone, siteLocation, notes });
      }
      setShowAdd(false);
      setEditingCustomer(null);
      setFullName('');
      setPhone('');
      setSiteLocation('');
      setNotes('');
      await loadCustomers(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.app.search}
            className="w-full rounded-lg border border-slate-300 pl-10 pr-3.5 py-2 text-sm min-h-[44px]"
          />
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setEditingCustomer(null);
              setFullName('');
              setPhone('');
              setSiteLocation('');
              setNotes('');
              setShowAdd(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E58A24] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#cf7a1b] min-h-[44px] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t.customers.addCustomer}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-[#D64545]/30 bg-[#D64545]/10 p-4 text-sm text-[#D64545]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.loading}</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.noData}</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">{t.customers.customerId}</th>
                    <th className="py-3 px-4">{t.customers.fullName}</th>
                    <th className="py-3 px-4">{t.customers.phone}</th>
                    <th className="py-3 px-4">{t.customers.siteLocation}</th>
                    <th className="py-3 px-4">{t.customers.registrationDate}</th>
                    <th className="py-3 px-4 text-right">{t.app.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-[#172B42]">
                        {c.customerId}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#202B38]">{c.fullName}</td>
                      <td className="py-3 px-4 font-mono-tabular text-slate-700">{c.phone}</td>
                      <td className="py-3 px-4 text-slate-600">{c.siteLocation}</td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-500">
                        {c.registrationDate}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => openProfile(c.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#245B91] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1c4975]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{t.customers.viewProfile}</span>
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCustomer(c);
                              setFullName(c.fullName);
                              setPhone(c.phone);
                              setSiteLocation(c.siteLocation);
                              setNotes(c.notes || '');
                              setShowAdd(true);
                            }}
                            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#202B38] hover:bg-slate-50"
                          >
                            {t.app.edit}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {customers.map((c) => (
                <div key={c.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono-tabular text-slate-500">{c.customerId}</p>
                      <p className="font-bold text-[#202B38]">{c.fullName}</p>
                      <p className="text-xs text-slate-600">
                        {c.phone} · {c.siteLocation}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openProfile(c.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#245B91] py-2 text-xs font-semibold text-white min-h-[44px]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t.customers.viewProfile}</span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomer(c);
                          setFullName(c.fullName);
                          setPhone(c.phone);
                          setSiteLocation(c.siteLocation);
                          setNotes(c.notes || '');
                          setShowAdd(true);
                        }}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-[#202B38] min-h-[44px]"
                      >
                        {t.app.edit}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {showAdd && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202B38]">
                {editingCustomer ? t.app.edit : t.customers.addCustomer}
              </h3>
              <button type="button" onClick={() => setShowAdd(false)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">{t.customers.fullName}</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">{t.customers.phone}</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">{t.customers.siteLocation}</label>
                <input
                  type="text"
                  required
                  value={siteLocation}
                  onChange={(e) => setSiteLocation(e.target.value)}
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
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold min-h-[42px]"
                >
                  {t.app.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#245B91] px-5 py-2 text-xs font-semibold text-white min-h-[42px]"
                >
                  {saving ? t.app.loading : t.app.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer 360 Profile Modal */}
      {profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl bg-white border border-slate-200 shadow-xl my-8 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-mono-tabular text-slate-500">{profile.customer.customerId}</p>
                <h3 className="text-lg font-bold text-[#202B38]">{profile.customer.fullName}</h3>
                <p className="text-xs text-slate-600">
                  {profile.customer.phone} · {profile.customer.siteLocation}
                </p>
              </div>
              <button type="button" onClick={() => setProfile(null)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Customer Financial & Equipment Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-[#F3F5F8]">
                  <p className="text-xs text-slate-500">{t.customers.totalRented}</p>
                  <p className="font-mono-tabular font-bold text-lg text-[#202B38]">
                    {profile.summary.totalEquipmentRented}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F3F5F8]">
                  <p className="text-xs text-slate-500">{t.customers.totalReturned}</p>
                  <p className="font-mono-tabular font-bold text-lg text-[#238653]">
                    {profile.summary.totalEquipmentReturned}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F3F5F8]">
                  <p className="text-xs text-slate-500">{t.customers.remainingEquip}</p>
                  <p className="font-mono-tabular font-bold text-lg text-[#E58A24]">
                    {profile.summary.remainingEquipment}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F3F5F8]">
                  <p className="text-xs text-slate-500">{t.customers.totalCharges}</p>
                  <p className="font-mono-tabular font-bold text-lg text-[#172B42]">
                    {formatUsd(profile.summary.totalAmountDueUsd)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F3F5F8]">
                  <p className="text-xs text-slate-500">{t.customers.paymentsReceived}</p>
                  <p className="font-mono-tabular font-bold text-lg text-[#238653]">
                    {formatUsd(profile.summary.paymentsReceivedUsd)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#F3F5F8]">
                  <p className="text-xs text-slate-500">{t.customers.outstandingDebt}</p>
                  <p className="font-mono-tabular font-bold text-lg text-[#D64545]">
                    {formatUsd(profile.summary.outstandingBalanceUsd)}
                  </p>
                </div>
              </div>

              {/* Rentals History */}
              <div>
                <h4 className="text-sm font-bold text-[#202B38] mb-2">{t.customers.rentalHistory}</h4>
                {profile.rentals.length === 0 ? (
                  <p className="text-xs text-slate-500">{t.app.noData}</p>
                ) : (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {profile.rentals.map((r) => (
                      <div key={r.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-semibold text-[#202B38]">
                            <span className="font-mono-tabular">{r.rentalId}</span> · {r.productCategory} ({r.quantityRented} pcs)
                          </p>
                          <p className="text-slate-500">
                            {r.startDate} · {t.rentals.remaining}: {r.quantityRemaining}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono-tabular font-bold text-[#202B38]">
                            {formatUsd(r.usdAmount)}
                          </p>
                          <RentalStatusLabel status={r.status} t={t} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payments & Related Expenses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-[#202B38] mb-2">{t.customers.paymentHistory}</h4>
                  {profile.payments.length === 0 ? (
                    <p className="text-xs text-slate-500">{t.app.noData}</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {profile.payments.map((p) => (
                        <div key={p.id} className="p-2.5 flex justify-between text-xs">
                          <span>
                            <strong className="font-mono-tabular">{p.paymentId}</strong> · {p.paymentDate}
                          </span>
                          <span className="font-mono-tabular font-bold text-[#238653]">
                            {formatUsd(p.usdAmount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-[#202B38] mb-2">{t.customers.relatedExpenses}</h4>
                  {profile.expenses.length === 0 ? (
                    <p className="text-xs text-slate-500">{t.app.noData}</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {profile.expenses.map((ex) => (
                        <div key={ex.id} className="p-2.5 flex justify-between text-xs">
                          <span>
                            {ex.category} ({ex.payerType})
                          </span>
                          <span className="font-mono-tabular font-bold text-[#E58A24]">
                            {formatUsd(ex.usdAmount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
