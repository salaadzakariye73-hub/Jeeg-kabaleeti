import { AlertCircle, CheckCircle2, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import type { RentalDTO, ReturnCondition, ReturnRecordDTO } from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export const ReturnsPage: React.FC = () => {
  const { user, t } = useApp();
  const isAdmin = user?.role === 'ADMIN';

  const [returns, setReturns] = useState<ReturnRecordDTO[]>([]);
  const [rentals, setRentals] = useState<RentalDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [rentalId, setRentalId] = useState('');
  const [quantityReturnedGood, setQuantityReturnedGood] = useState('0');
  const [damagedQuantity, setDamagedQuantity] = useState('0');
  const [lostQuantity, setLostQuantity] = useState('0');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState<ReturnCondition>('GOOD');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [retRes, rentRes] = await Promise.all([api.listReturns(), api.listRentals()]);
      setReturns(retRes.data);
      const openRentals = rentRes.data.filter((r) => r.quantityRemaining > 0);
      setRentals(openRentals);
      if (openRentals.length > 0 && !rentalId) {
        setRentalId(openRentals[0].id);
        setQuantityReturnedGood(String(openRentals[0].quantityRemaining));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [rentalId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const selectedRental = rentals.find((r) => r.id === rentalId);
  const goodNum = Math.max(0, Math.floor(Number(quantityReturnedGood) || 0));
  const dmgNum = Math.max(0, Math.floor(Number(damagedQuantity) || 0));
  const lostNum = Math.max(0, Math.floor(Number(lostQuantity) || 0));
  const totalProcessed = goodNum + dmgNum + lostNum;
  const remainingAfter = selectedRental
    ? Math.max(0, selectedRental.quantityRemaining - totalProcessed)
    : 0;

  const handleSelectRental = (id: string) => {
    setRentalId(id);
    const found = rentals.find((r) => r.id === id);
    if (found) {
      setQuantityReturnedGood(String(found.quantityRemaining));
      setDamagedQuantity('0');
      setLostQuantity('0');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const res = await api.createReturn({
        rentalId,
        quantityReturnedGood: goodNum,
        damagedQuantity: dmgNum,
        lostQuantity: lostNum,
        returnDate,
        condition,
        notes,
      });
      setShowForm(false);
      setNotes('');
      setNotice(
        res.queuedOffline
          ? `${res.record.returnId} — ${t.app.pendingSync}`
          : `${res.record.returnId} — ${t.app.synchronized}`
      );
      setRentalId('');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#202B38]">{t.returns.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {rentals.length} {t.dashboard.activeRentals}
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            disabled={rentals.length === 0}
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#245B91] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1c4975] disabled:opacity-50 min-h-[44px] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t.returns.registerReturn}</span>
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
        ) : returns.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.noData}</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">{t.returns.returnId}</th>
                    <th className="py-3 px-4">{t.rentals.rentalId}</th>
                    <th className="py-3 px-4">{t.customers.fullName}</th>
                    <th className="py-3 px-4">{t.inventory.category}</th>
                    <th className="py-3 px-4 text-right">{t.returns.quantityReturnedGood}</th>
                    <th className="py-3 px-4 text-right">{t.returns.damagedQuantity}</th>
                    <th className="py-3 px-4 text-right">{t.returns.lostQuantity}</th>
                    <th className="py-3 px-4 text-right">{t.returns.remainingAfter}</th>
                    <th className="py-3 px-4">{t.returns.returnDate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {returns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-[#172B42]">
                        <div>{ret.returnId}</div>
                        {ret.pendingSync && (
                          <span className="text-[11px] font-sans text-[#E58A24]">
                            {t.app.pendingSync}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs">{ret.rentalCode}</td>
                      <td className="py-3 px-4 font-semibold text-[#202B38]">{ret.customerName}</td>
                      <td className="py-3 px-4 text-xs font-semibold">{ret.productCategory}</td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#238653]">
                        {ret.quantityReturnedGood}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-[#E5A12A]">
                        {ret.damagedQuantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-[#D64545]">
                        {ret.lostQuantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold">
                        {ret.remainingAfterReturn}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-500">
                        {ret.returnDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {returns.map((ret) => (
                <div key={ret.id} className="p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono-tabular font-semibold text-[#172B42]">
                      {ret.returnId} · {ret.rentalCode}
                    </span>
                    <span className="font-mono-tabular text-slate-500">{ret.returnDate}</span>
                  </div>
                  <p className="font-bold text-sm text-[#202B38]">
                    {ret.customerName} · {ret.productCategory}
                  </p>
                  <div className="grid grid-cols-4 gap-2 text-xs bg-[#F3F5F8] p-2.5 rounded-lg font-mono-tabular">
                    <div>
                      <span className="text-slate-500 block font-sans">Good</span>
                      <strong className="text-[#238653]">{ret.quantityReturnedGood}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-sans">Dmg</span>
                      <strong className="text-[#E5A12A]">{ret.damagedQuantity}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-sans">Lost</span>
                      <strong className="text-[#D64545]">{ret.lostQuantity}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-sans">Left</span>
                      <strong>{ret.remainingAfterReturn}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Register Return Modal */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl my-6">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202B38]">{t.returns.registerReturn}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">{t.returns.selectRental}</label>
                <select
                  required
                  value={rentalId}
                  onChange={(e) => handleSelectRental(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                >
                  {rentals.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.rentalId} — {r.customerName} ({r.productCategory}: {r.quantityRemaining} left of{' '}
                      {r.quantityRented})
                    </option>
                  ))}
                </select>
              </div>

              {selectedRental && (
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-[#F3F5F8] p-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">{t.returns.originalRented}</span>
                    <strong className="font-mono-tabular text-sm">{selectedRental.quantityRented}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{t.returns.currentlyRemaining}</span>
                    <strong className="font-mono-tabular text-sm text-[#E58A24]">
                      {selectedRental.quantityRemaining}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{t.returns.remainingAfter}</span>
                    <strong className="font-mono-tabular text-sm text-[#245B91]">
                      {remainingAfter}
                    </strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {t.returns.quantityReturnedGood}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={selectedRental?.quantityRemaining}
                    value={quantityReturnedGood}
                    onChange={(e) => setQuantityReturnedGood(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {t.returns.damagedQuantity}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={selectedRental?.quantityRemaining}
                    value={damagedQuantity}
                    onChange={(e) => setDamagedQuantity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.returns.lostQuantity}</label>
                  <input
                    type="number"
                    min={0}
                    max={selectedRental?.quantityRemaining}
                    value={lostQuantity}
                    onChange={(e) => setLostQuantity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.returns.returnDate}</label>
                  <input
                    type="date"
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.returns.condition}</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as ReturnCondition)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="GOOD">{t.returns.condGood}</option>
                    <option value="PARTIAL_DAMAGE">{t.returns.condPartialDamage}</option>
                    <option value="DAMAGED">{t.returns.condDamaged}</option>
                    <option value="LOST_REPORTED">{t.returns.condLost}</option>
                  </select>
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

              <div className="text-xs font-semibold text-[#245B91]">
                {remainingAfter === 0 && totalProcessed > 0
                  ? t.returns.fullReturnBadge
                  : t.returns.partialReturnBadge}
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
                  disabled={submitting || totalProcessed <= 0 || (selectedRental ? totalProcessed > selectedRental.quantityRemaining : true)}
                  className="rounded-lg bg-[#245B91] px-5 py-2 text-xs font-semibold text-white disabled:opacity-50 min-h-[44px]"
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
