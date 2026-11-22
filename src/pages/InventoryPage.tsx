import { AlertCircle, Plus, SlidersHorizontal, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { formatCurrencyValue, formatUsd } from '../../shared/calculations';
import type { CurrencyCode, EquipmentCategory, InventoryItemDTO } from '../../shared/types';
import { EquipmentVisual } from '../components/EquipmentVisual';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export const InventoryPage: React.FC = () => {
  const { user, t } = useApp();
  const isAdmin = user?.role === 'ADMIN';

  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [filterCat, setFilterCat] = useState<'ALL' | EquipmentCategory>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<EquipmentCategory>('KABALEETI');
  const [totalQuantity, setTotalQuantity] = useState('100');
  const [purchasePricePerPiece, setPurchasePricePerPiece] = useState('12');
  const [purchaseCurrency, setPurchaseCurrency] = useState<CurrencyCode>('USD');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Adjust modal
  const [adjustItem, setAdjustItem] = useState<InventoryItemDTO | null>(null);
  const [addDelta, setAddDelta] = useState('0');
  const [adjustName, setAdjustName] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.listInventory();
      setItems(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_200_000) {
      setError('Image must be under 1.2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPhotoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.createInventory({
        name,
        category,
        totalQuantity: Number(totalQuantity),
        purchasePricePerPiece: Number(purchasePricePerPiece),
        purchaseCurrency,
        purchaseDate,
        description,
        photoUrl,
      });
      setShowAdd(false);
      setName('');
      setDescription('');
      setPhotoUrl('');
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add equipment');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    setError('');
    setSaving(true);
    try {
      await api.adjustInventory(adjustItem.id, {
        name: adjustName,
        description: adjustDesc,
        addQuantity: Number(addDelta),
      });
      setAdjustItem(null);
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  const visible = filterCat === 'ALL' ? items : items.filter((i) => i.category === filterCat);

  const kabTotals = items
    .filter((i) => i.category === 'KABALEETI')
    .reduce(
      (acc, i) => ({
        total: acc.total + i.totalQuantity,
        available: acc.available + i.availableQuantity,
        rented: acc.rented + i.rentedQuantity,
        damaged: acc.damaged + i.damagedQuantity,
        lost: acc.lost + i.lostQuantity,
      }),
      { total: 0, available: 0, rented: 0, damaged: 0, lost: 0 }
    );

  const jeegTotals = items
    .filter((i) => i.category === 'JEEG')
    .reduce(
      (acc, i) => ({
        total: acc.total + i.totalQuantity,
        available: acc.available + i.availableQuantity,
        rented: acc.rented + i.rentedQuantity,
        damaged: acc.damaged + i.damagedQuantity,
        lost: acc.lost + i.lostQuantity,
      }),
      { total: 0, available: 0, rented: 0, damaged: 0, lost: 0 }
    );

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#202B38]">{t.inventory.title}</h2>
          <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['ALL', 'KABALEETI', 'JEEG'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  filterCat === cat ? 'bg-white text-[#172B42] shadow-sm' : 'text-slate-600'
                }`}
              >
                {cat === 'ALL' ? t.app.all : cat}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E58A24] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#cf7a1b] transition-colors min-h-[44px] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t.inventory.addEquipment}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-[#D64545]/30 bg-[#D64545]/10 p-4 text-sm text-[#D64545]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Two Main Category Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-stretch">
          <EquipmentVisual category="KABALEETI" alt="Kabaleeti" className="w-full sm:w-40 h-36 shrink-0" />
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#245B91]">KABALEETI</p>
              <h3 className="text-base font-bold text-[#202B38]">{t.inventory.kabaleetiLabel}</h3>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div>
                <p className="text-slate-500">{t.inventory.totalQty}</p>
                <p className="font-mono-tabular font-bold text-base text-[#202B38]">{kabTotals.total}</p>
              </div>
              <div>
                <p className="text-slate-500">{t.inventory.availableQty}</p>
                <p className="font-mono-tabular font-bold text-base text-[#238653]">{kabTotals.available}</p>
              </div>
              <div>
                <p className="text-slate-500">{t.inventory.rentedQty}</p>
                <p className="font-mono-tabular font-bold text-base text-[#245B91]">{kabTotals.rented}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-stretch">
          <EquipmentVisual category="JEEG" alt="Jeeg" className="w-full sm:w-40 h-36 shrink-0" />
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#E58A24]">JEEG</p>
              <h3 className="text-base font-bold text-[#202B38]">{t.inventory.jeegLabel}</h3>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div>
                <p className="text-slate-500">{t.inventory.totalQty}</p>
                <p className="font-mono-tabular font-bold text-base text-[#202B38]">{jeegTotals.total}</p>
              </div>
              <div>
                <p className="text-slate-500">{t.inventory.availableQty}</p>
                <p className="font-mono-tabular font-bold text-base text-[#238653]">{jeegTotals.available}</p>
              </div>
              <div>
                <p className="text-slate-500">{t.inventory.rentedQty}</p>
                <p className="font-mono-tabular font-bold text-base text-[#E58A24]">{jeegTotals.rented}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Table (Desktop) & Cards (Mobile) */}
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
                    <th className="py-3 px-4">{t.inventory.productId}</th>
                    <th className="py-3 px-4">{t.inventory.productName}</th>
                    <th className="py-3 px-4">{t.inventory.category}</th>
                    <th className="py-3 px-4 text-right">{t.inventory.totalQty}</th>
                    <th className="py-3 px-4 text-right">{t.inventory.availableQty}</th>
                    <th className="py-3 px-4 text-right">{t.inventory.rentedQty}</th>
                    <th className="py-3 px-4 text-right">{t.inventory.returnedQty}</th>
                    <th className="py-3 px-4 text-right">{t.inventory.damagedQty}</th>
                    <th className="py-3 px-4 text-right">{t.inventory.lostQty}</th>
                    <th className="py-3 px-4 text-right">{t.inventory.purchasePrice}</th>
                    {isAdmin && <th className="py-3 px-4 text-right">{t.app.actions}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {visible.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-[#172B42]">
                        {item.productId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <EquipmentVisual
                            category={item.category}
                            photoUrl={item.photoUrl}
                            alt={item.name}
                            className="w-10 h-10 shrink-0"
                          />
                          <div>
                            <p className="font-semibold text-[#202B38]">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                        {item.category}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold">
                        {item.totalQuantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#238653]">
                        {item.availableQuantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-[#245B91] font-semibold">
                        {item.rentedQuantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">
                        {item.returnedQuantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-[#E5A12A] font-semibold">
                        {item.damagedQuantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-[#D64545] font-semibold">
                        {item.lostQuantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-xs">
                        <div>{formatCurrencyValue(item.purchasePricePerPiece, item.purchaseCurrency)}</div>
                        {item.purchaseCurrency === 'SOS' && (
                          <div className="text-slate-400">{formatUsd(item.purchasePriceUsd)}</div>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustItem(item);
                              setAdjustName(item.name);
                              setAdjustDesc(item.description || '');
                              setAddDelta('0');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-[#202B38] hover:bg-slate-50"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>{t.app.edit}</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {visible.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <EquipmentVisual
                      category={item.category}
                      photoUrl={item.photoUrl}
                      alt={item.name}
                      className="w-16 h-16 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono-tabular text-slate-500">
                        {item.productId} · {item.category}
                      </p>
                      <p className="font-bold text-[#202B38] truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatCurrencyValue(item.purchasePricePerPiece, item.purchaseCurrency)} · {item.purchaseDate}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs bg-[#F3F5F8] p-2.5 rounded-lg">
                    <div>
                      <span className="text-slate-500">{t.inventory.availableQty}: </span>
                      <strong className="font-mono-tabular text-[#238653]">{item.availableQuantity}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">{t.inventory.rentedQty}: </span>
                      <strong className="font-mono-tabular text-[#245B91]">{item.rentedQuantity}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">{t.inventory.totalQty}: </span>
                      <strong className="font-mono-tabular">{item.totalQuantity}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">{t.inventory.returnedQty}: </span>
                      <strong className="font-mono-tabular">{item.returnedQuantity}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">{t.inventory.damagedQty}: </span>
                      <strong className="font-mono-tabular text-[#E5A12A]">{item.damagedQuantity}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">{t.inventory.lostQty}: </span>
                      <strong className="font-mono-tabular text-[#D64545]">{item.lostQuantity}</strong>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdjustItem(item);
                        setAdjustName(item.name);
                        setAdjustDesc(item.description || '');
                        setAddDelta('0');
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2 text-xs font-semibold text-[#202B38] min-h-[44px]"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>{t.inventory.adjustStock}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Inventory Modal (Admin Only) */}
      {showAdd && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl my-8">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202B38]">{t.inventory.addEquipment}</h3>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#202B38] mb-1">
                    {t.inventory.category}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="KABALEETI">KABALEETI</option>
                    <option value="JEEG">JEEG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#202B38] mb-1">
                    {t.inventory.totalQty}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={totalQuantity}
                    onChange={(e) => setTotalQuantity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#202B38] mb-1">
                  {t.inventory.productName}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={category === 'KABALEETI' ? 'Kabaleeti 3.5m Heavy Duty' : 'Jeeg H-Frame 1.8m'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#202B38] mb-1">
                    {t.inventory.purchasePrice}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={purchasePricePerPiece}
                    onChange={(e) => setPurchasePricePerPiece(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#202B38] mb-1">
                    {t.inventory.purchaseCurrency}
                  </label>
                  <select
                    value={purchaseCurrency}
                    onChange={(e) => setPurchaseCurrency(e.target.value as CurrencyCode)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  >
                    <option value="USD">USD</option>
                    <option value="SOS">SOS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#202B38] mb-1">
                    {t.inventory.purchaseDate}
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#202B38] mb-1">
                  {t.inventory.description}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#202B38] mb-1">
                  {t.inventory.photoUrl}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-[#172B42]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 min-h-[42px]"
                >
                  {t.app.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#245B91] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1c4975] disabled:opacity-60 min-h-[42px]"
                >
                  {saving ? t.app.loading : t.app.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal (Admin Only) */}
      {adjustItem && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202B38]">
                {t.inventory.adjustStock} ({adjustItem.productId})
              </h3>
              <button
                type="button"
                onClick={() => setAdjustItem(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdjust} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#202B38] mb-1">
                  {t.inventory.productName}
                </label>
                <input
                  type="text"
                  required
                  value={adjustName}
                  onChange={(e) => setAdjustName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#202B38] mb-1">
                  {t.inventory.addDeltaLabel}
                </label>
                <input
                  type="number"
                  value={addDelta}
                  onChange={(e) => setAddDelta(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular min-h-[44px]"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {t.inventory.availableQty}: {adjustItem.availableQuantity}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#202B38] mb-1">
                  {t.inventory.description}
                </label>
                <textarea
                  rows={2}
                  value={adjustDesc}
                  onChange={(e) => setAdjustDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustItem(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 min-h-[42px]"
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
    </div>
  );
};
