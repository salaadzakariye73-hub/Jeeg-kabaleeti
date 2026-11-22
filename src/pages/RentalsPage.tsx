import { AlertCircle, CheckCircle2, FileText, Plus, Printer, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateRentalAmounts,
  calculateRentalDays,
  formatCurrencyValue,
  formatUsd,
} from '../../shared/calculations';
import type {
  CurrencyCode,
  CustomerDTO,
  InventoryItemDTO,
  PricingMethod,
  RentalDTO,
} from '../../shared/types';
import { RentalStatusLabel } from '../components/StatusLabel';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { exportRentalReceiptPdf } from '../services/pdfGenerator';

export const RentalsPage: React.FC = () => {
  const { user, t, currentRate, settings } = useApp();
  const isAdmin = user?.role === 'ADMIN';

  const [rentals, setRentals] = useState<RentalDTO[]>([]);
  const [inventory, setInventory] = useState<InventoryItemDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Rental Form Modal
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState<string>('NEW');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [inventoryId, setInventoryId] = useState('');
  const [quantityRented, setQuantityRented] = useState('50');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>('PER_PIECE_DAILY');
  const [unitOrContractPrice, setUnitOrContractPrice] = useState('0.20');
  const [manualDays, setManualDays] = useState('30');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rentRes, invRes, cusRes] = await Promise.all([
        api.listRentals(),
        api.listInventory(),
        api.listCustomers(),
      ]);
      setRentals(rentRes.data);
      setInventory(invRes.data);
      setCustomers(cusRes.data);
      if (invRes.data.length > 0 && !inventoryId) {
        const firstAvailable = invRes.data.find((i) => i.availableQuantity > 0) || invRes.data[0];
        setInventoryId(firstAvailable.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rentals');
    } finally {
      setLoading(false);
    }
  }, [inventoryId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSelectCustomer = (selectedId: string) => {
    setCustomerId(selectedId);
    if (selectedId === 'NEW') {
      setCustomerName('');
      setCustomerPhone('');
      setSiteLocation('');
    } else {
      const found = customers.find((c) => c.id === selectedId);
      if (found) {
        setCustomerName(found.fullName);
        setCustomerPhone(found.phone);
        setSiteLocation(found.siteLocation);
      }
    }
  };

  const effectiveDays = useMemo(() => {
    if (expectedReturnDate) {
      return calculateRentalDays(startDate, expectedReturnDate);
    }
    return Math.max(1, Math.floor(Number(manualDays) || 1));
  }, [startDate, expectedReturnDate, manualDays]);

  const pricingPreview = useMemo(() => {
    try {
      return calculateRentalAmounts({
        pricingMethod,
        unitOrContractPrice: Number(unitOrContractPrice) || 0,
        quantityRented: Math.max(1, Math.floor(Number(quantityRented) || 1)),
        rentalDays: effectiveDays,
        currency,
        exchangeRate: currentRate,
      });
    } catch {
      return { originalAmount: 0, usdAmount: 0 };
    }
  }, [pricingMethod, unitOrContractPrice, quantityRented, effectiveDays, currency, currentRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const res = await api.createRental({
        customerId,
        customerName,
        customerPhone,
        siteLocation,
        vehicleType,
        vehiclePlate,
        inventoryId,
        quantityRented: Number(quantityRented),
        startDate,
        expectedReturnDate: expectedReturnDate || null,
        pricingMethod,
        unitOrContractPrice: Number(unitOrContractPrice),
        rentalDays: effectiveDays,
        currency,
        exchangeRateSnapshot: currentRate,
        notes,
      });
      setShowForm(false);
      setVehicleType('');
      setVehiclePlate('');
      setNotes('');
      setNotice(
        res.queuedOffline
          ? `${res.record.rentalId} — ${t.app.pendingSync}`
          : `${res.record.rentalId} — ${t.app.synchronized}`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rental');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRentals = rentals.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        r.rentalId.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.customerPhone.toLowerCase().includes(q) ||
        r.siteLocation.toLowerCase().includes(q) ||
        r.productCategory.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedInv = inventory.find((i) => i.id === inventoryId);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.app.search}
              className="w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm min-h-[44px]"
            />
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 overflow-x-auto">
            {(['ALL', 'ACTIVE', 'PARTIAL_RETURN', 'OVERDUE', 'COMPLETED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
                  statusFilter === st ? 'bg-white text-[#172B42] shadow-sm' : 'text-slate-600'
                }`}
              >
                {st === 'ALL'
                  ? t.app.all
                  : st === 'ACTIVE'
                  ? t.rentals.statusActive
                  : st === 'PARTIAL_RETURN'
                  ? t.rentals.statusPartial
                  : st === 'OVERDUE'
                  ? t.rentals.statusOverdue
                  : t.rentals.statusCompleted}
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
            <span>{t.rentals.newRental}</span>
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

      {/* Rentals List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.loading}</div>
        ) : filteredRentals.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.noData}</div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">{t.rentals.rentalId}</th>
                    <th className="py-3 px-4">{t.customers.fullName}</th>
                    <th className="py-3 px-4">{t.inventory.category}</th>
                    <th className="py-3 px-4 text-right">{t.rentals.quantityRented}</th>
                    <th className="py-3 px-4 text-right">{t.rentals.remaining}</th>
                    <th className="py-3 px-4">{t.rentals.startDate}</th>
                    <th className="py-3 px-4 text-right">{t.rentals.calculatedUsd}</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">{t.app.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredRentals.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-[#172B42]">
                        <div>{r.rentalId}</div>
                        {r.pendingSync && (
                          <span className="text-[11px] font-sans text-[#E58A24]">
                            {t.app.pendingSync}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#202B38]">{r.customerName}</p>
                        <p className="text-xs text-slate-500">
                          {r.customerPhone} · {r.siteLocation}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p className="font-semibold text-[#202B38]">{r.productCategory}</p>
                        <p className="text-slate-500">{r.vehicleType}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold">
                        {r.quantityRented}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#E58A24]">
                        {r.quantityRemaining}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600">
                        <div>{r.startDate}</div>
                        {r.expectedReturnDate && (
                          <div className="text-slate-400">→ {r.expectedReturnDate}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        <div className="font-bold text-[#172B42]">{formatUsd(r.usdAmount)}</div>
                        {r.currency === 'SOS' && (
                          <div className="text-xs text-slate-500">
                            {formatCurrencyValue(r.originalAmount, 'SOS')} (@{r.exchangeRateSnapshot})
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <RentalStatusLabel status={r.status} t={t} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => exportRentalReceiptPdf(r, settings, t.rentals.receiptTitle)}
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

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredRentals.map((r) => (
                <div key={r.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono-tabular text-slate-500">
                        {r.rentalId} · {r.startDate}
                      </p>
                      <p className="font-bold text-[#202B38]">{r.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {r.productCategory} · {r.siteLocation}
                      </p>
                    </div>
                    <RentalStatusLabel status={r.status} t={t} />
                  </div>
                  <div className="flex items-center justify-between text-xs bg-[#F3F5F8] p-2.5 rounded-lg">
                    <div>
                      <span className="text-slate-500">{t.rentals.quantityRented}: </span>
                      <strong className="font-mono-tabular">{r.quantityRented}</strong>
                      <span className="mx-2 text-slate-300">|</span>
                      <span className="text-slate-500">{t.rentals.remaining}: </span>
                      <strong className="font-mono-tabular text-[#E58A24]">{r.quantityRemaining}</strong>
                    </div>
                    <strong className="font-mono-tabular text-sm text-[#172B42]">
                      {formatUsd(r.usdAmount)}
                    </strong>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => exportRentalReceiptPdf(r, settings, t.rentals.receiptTitle)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold min-h-[40px]"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{t.app.exportPdf}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Register Rental Modal (Admin Only) */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white border border-slate-200 shadow-xl my-6 max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202B38]">{t.rentals.newRental}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5">
              {/* Customer & Vehicle */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#245B91]">
                  {t.rentals.customerSection}
                </h4>
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.rentals.selectCustomer}</label>
                  <select
                    value={customerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="NEW">{t.rentals.newCustomerOption}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customerId} — {c.fullName} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t.rentals.customerName}</label>
                    <input
                      type="text"
                      required
                      disabled={customerId !== 'NEW'}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px] disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t.rentals.customerPhone}</label>
                    <input
                      type="text"
                      required
                      disabled={customerId !== 'NEW'}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px] disabled:bg-slate-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">{t.rentals.siteLocation}</label>
                  <input
                    type="text"
                    required
                    value={siteLocation}
                    onChange={(e) => setSiteLocation(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t.rentals.vehicleType}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dyna / Pickup / TM"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t.rentals.vehiclePlate}</label>
                    <input
                      type="text"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                    />
                  </div>
                </div>
              </div>

              {/* Equipment & Dates */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#245B91]">
                  {t.rentals.rentalSection}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t.rentals.selectEquipment}</label>
                    <select
                      required
                      value={inventoryId}
                      onChange={(e) => setInventoryId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                    >
                      {inventory.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          [{inv.category}] {inv.name} ({t.inventory.availableQty}: {inv.availableQuantity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t.rentals.quantityRented}</label>
                    <input
                      type="number"
                      min={1}
                      max={selectedInv ? selectedInv.availableQuantity : undefined}
                      required
                      value={quantityRented}
                      onChange={(e) => setQuantityRented(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t.rentals.startDate}</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {t.rentals.expectedReturnDate}
                    </label>
                    <input
                      type="date"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Pricing Method & Currency */}
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.rentals.pricingMethod}</label>
                  <select
                    value={pricingMethod}
                    onChange={(e) => setPricingMethod(e.target.value as PricingMethod)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="CONTRACT">{t.rentals.methodContract}</option>
                    <option value="DAILY_TOTAL">{t.rentals.methodDailyTotal}</option>
                    <option value="PER_PIECE_DAILY">{t.rentals.methodPerPiece}</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {t.rentals.unitOrContractPrice}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      required
                      value={unitOrContractPrice}
                      onChange={(e) => setUnitOrContractPrice(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">{t.rentals.currency}</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                    >
                      <option value="USD">USD</option>
                      <option value="SOS">SOS</option>
                    </select>
                  </div>
                  {pricingMethod !== 'CONTRACT' && !expectedReturnDate && (
                    <div>
                      <label className="block text-xs font-semibold mb-1">{t.rentals.rentalDays}</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={manualDays}
                        onChange={(e) => setManualDays(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular min-h-[44px]"
                      />
                    </div>
                  )}
                </div>

                {/* Live Calculation Preview Box */}
                <div className="rounded-xl bg-[#F3F5F8] border border-slate-200 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>{t.rentals.formulaPreview}</span>
                    <span className="font-mono-tabular font-semibold">
                      1 USD = {currentRate} SOS
                    </span>
                  </div>
                  <div className="text-slate-700 font-mono-tabular">
                    {pricingMethod === 'CONTRACT' && (
                      <span>
                        Contract Fixed = {formatCurrencyValue(Number(unitOrContractPrice) || 0, currency)}
                      </span>
                    )}
                    {pricingMethod === 'DAILY_TOTAL' && (
                      <span>
                        {unitOrContractPrice || 0} × {effectiveDays} days ={' '}
                        {formatCurrencyValue(pricingPreview.originalAmount, currency)}
                      </span>
                    )}
                    {pricingMethod === 'PER_PIECE_DAILY' && (
                      <span>
                        {quantityRented || 0} pcs × {unitOrContractPrice || 0} × {effectiveDays} days ={' '}
                        {formatCurrencyValue(pricingPreview.originalAmount, currency)}
                      </span>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-bold text-[#172B42]">
                    <span>{t.rentals.calculatedUsd}:</span>
                    <span className="font-mono-tabular text-base text-[#238653]">
                      {formatUsd(pricingPreview.usdAmount)}
                    </span>
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
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold min-h-[44px]"
                >
                  {t.app.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !inventoryId}
                  className="rounded-lg bg-[#E58A24] px-5 py-2 text-xs font-semibold text-white hover:bg-[#cf7a1b] disabled:opacity-60 min-h-[44px]"
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
