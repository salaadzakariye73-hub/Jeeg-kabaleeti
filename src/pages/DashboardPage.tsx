import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  RotateCcw,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { formatUsd } from '../../shared/calculations';
import type {
  DashboardSummaryDTO,
  InventoryItemDTO,
  RentalDTO,
  ReturnRecordDTO,
} from '../../shared/types';
import type { NavSection } from '../components/Layout';
import { RentalStatusLabel } from '../components/StatusLabel';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

interface DashboardPageProps {
  onNavigate: (tab: NavSection) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, t, pendingCount } = useApp();
  const isManager = user?.role === 'MANAGER';

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summary, setSummary] = useState<DashboardSummaryDTO | null>(null);
  const [recentRentals, setRecentRentals] = useState<RentalDTO[]>([]);
  const [recentReturns, setRecentReturns] = useState<ReturnRecordDTO[]>([]);
  const [inventory, setInventory] = useState<InventoryItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, rentRes, retRes, invRes] = await Promise.all([
        api.getDashboard(startDate || undefined, endDate || undefined),
        api.listRentals(),
        api.listReturns(),
        api.listInventory(),
      ]);
      setSummary(dashRes.data);
      setRecentRentals(rentRes.data.slice(0, 5));
      setRecentReturns(retRes.data.slice(0, 5));
      setInventory(invRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const lowStockItems = inventory.filter(
    (item) => item.totalQuantity > 0 && item.availableQuantity / item.totalQuantity < 0.2
  );

  const maxDailyRevenue = Math.max(
    1,
    ...(summary?.dailyActivity.map((d) => d.revenueUsd) || [1])
  );
  const maxMonthlyVal = Math.max(
    1,
    ...(summary?.monthlyRevenue.flatMap((m) => [m.revenueUsd, m.paymentsUsd, m.expensesUsd]) || [1])
  );
  const totalInvTotal = Math.max(1, (summary?.totalKabaleeti || 0) + (summary?.totalJeeg || 0));
  const totalStatusCount = Math.max(
    1,
    Object.values(summary?.rentalStatusCounts || {}).reduce((a, b) => a + b, 0)
  );

  return (
    <div className="space-y-6">
      {/* Header Banner & Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#202B38]">{t.dashboard.title}</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isManager ? t.dashboard.managerBanner : t.dashboard.adminBanner}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {!isManager && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('rentals')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E58A24] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#cf7a1b] transition-colors min-h-[40px] whitespace-nowrap"
              >
                <ClipboardList className="w-4 h-4" />
                <span>{t.rentals.newRental}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('returns')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#245B91] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1c4975] transition-colors min-h-[40px] whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t.returns.registerReturn}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('payments')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#202B38] hover:bg-slate-50 transition-colors min-h-[40px] whitespace-nowrap"
              >
                <CreditCard className="w-4 h-4 text-[#238653]" />
                <span>{t.payments.recordPayment}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Date Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mr-2 self-center">
          <Calendar className="w-4 h-4 text-[#245B91]" />
          <span>{t.app.filterByDate}</span>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.app.fromDate}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-[#202B38] min-h-[38px]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.app.toDate}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-[#202B38] min-h-[38px]"
          />
        </div>
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 min-h-[38px]"
          >
            {t.app.clearFilter}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-[#D64545]/30 bg-[#D64545]/10 p-4 text-sm text-[#D64545]">
          {error}
        </div>
      )}

      {/* 13 Real KPI Cards */}
      {loading && !summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <>
          {/* Financial KPIs Row (4 Primary USD Metrics) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500">{t.dashboard.totalRevenue}</p>
              <p className="mt-1.5 text-2xl font-bold font-mono-tabular text-[#172B42]">
                {formatUsd(summary.totalRentalRevenueUsd)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500">{t.dashboard.totalPayments}</p>
              <p className="mt-1.5 text-2xl font-bold font-mono-tabular text-[#238653]">
                {formatUsd(summary.totalPaymentsReceivedUsd)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500">{t.dashboard.outstandingBalances}</p>
              <p className="mt-1.5 text-2xl font-bold font-mono-tabular text-[#E58A24]">
                {formatUsd(summary.outstandingCustomerBalancesUsd)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500">{t.dashboard.totalExpenses}</p>
              <p className="mt-1.5 text-2xl font-bold font-mono-tabular text-[#D64545]">
                {formatUsd(summary.totalCompanyExpensesUsd)}
              </p>
            </div>
          </div>

          {/* Equipment & Operations KPIs (Remaining 9 Metrics) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{t.dashboard.totalKabaleeti}</p>
              <p className="mt-1 text-xl font-bold font-mono-tabular text-[#245B91]">
                {summary.totalKabaleeti.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{t.dashboard.totalJeeg}</p>
              <p className="mt-1 text-xl font-bold font-mono-tabular text-[#E58A24]">
                {summary.totalJeeg.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{t.dashboard.availableInventory}</p>
              <p className="mt-1 text-xl font-bold font-mono-tabular text-[#238653]">
                {summary.availableInventory.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{t.dashboard.rentedEquipment}</p>
              <p className="mt-1 text-xl font-bold font-mono-tabular text-[#202B38]">
                {summary.rentedEquipment.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{t.dashboard.returnedEquipment}</p>
              <p className="mt-1 text-xl font-bold font-mono-tabular text-[#202B38]">
                {summary.returnedEquipment.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{t.dashboard.damagedEquipment}</p>
              <p className="mt-1 text-xl font-bold font-mono-tabular text-[#E5A12A]">
                {summary.damagedEquipment.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{t.dashboard.lostEquipment}</p>
              <p className="mt-1 text-xl font-bold font-mono-tabular text-[#D64545]">
                {summary.lostEquipment.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{t.dashboard.activeRentals}</p>
              <p className="mt-1 text-xl font-bold font-mono-tabular text-[#245B91]">
                {summary.activeRentalsCount.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2 sm:col-span-1 lg:col-span-2">
              <p className="text-xs text-slate-500">{t.dashboard.overdueRentals}</p>
              <p className="mt-1 text-xl font-bold font-mono-tabular text-[#D64545]">
                {summary.overdueRentalsCount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Alerts Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
            <h3 className="text-sm font-bold text-[#202B38] mb-3">{t.dashboard.alerts}</h3>
            {summary.overdueRentalsCount === 0 && lowStockItems.length === 0 && pendingCount === 0 ? (
              <div className="flex items-center gap-2 text-xs text-[#238653] font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t.dashboard.noAlerts}</span>
              </div>
            ) : (
              <div className="space-y-2">
                {summary.overdueRentalsCount > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-[#D64545]/10 px-3.5 py-2.5 text-xs text-[#D64545] font-medium">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        <strong className="font-mono-tabular">{summary.overdueRentalsCount}</strong>{' '}
                        {t.dashboard.overdueAlertText}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('rentals')}
                      className="inline-flex items-center gap-1 font-semibold underline whitespace-nowrap"
                    >
                      <span>{t.nav.rentals}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {lowStockItems.length > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-[#E5A12A]/10 px-3.5 py-2.5 text-xs text-[#9a6700] font-medium">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        <strong className="font-mono-tabular">{lowStockItems.length}</strong>{' '}
                        {t.dashboard.lowStockAlertText}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('inventory')}
                      className="inline-flex items-center gap-1 font-semibold underline whitespace-nowrap"
                    >
                      <span>{t.nav.inventory}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {pendingCount > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-[#E58A24]/10 px-3.5 py-2.5 text-xs text-[#b4640d] font-medium">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        <strong className="font-mono-tabular">{pendingCount}</strong>{' '}
                        {t.dashboard.syncPendingAlertText}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('syncCenter')}
                      className="inline-flex items-center gap-1 font-semibold underline whitespace-nowrap"
                    >
                      <span>{t.nav.syncCenter}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Rental Activity */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-[#202B38] mb-4">{t.dashboard.dailyActivity}</h3>
              {summary.dailyActivity.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">{t.app.noData}</p>
              ) : (
                <div className="space-y-2.5">
                  {summary.dailyActivity.map((d) => {
                    const pct = Math.max(4, Math.round((d.revenueUsd / maxDailyRevenue) * 100));
                    return (
                      <div key={d.date} className="grid grid-cols-12 items-center gap-2 text-xs">
                        <span className="col-span-3 font-mono-tabular text-slate-600 truncate">
                          {d.date}
                        </span>
                        <div className="col-span-6 h-5 bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-[#245B91] rounded"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="col-span-3 text-right font-mono-tabular font-semibold text-[#202B38]">
                          {formatUsd(d.revenueUsd)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Monthly Revenue vs Payments vs Expenses */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-bold text-[#202B38]">{t.dashboard.monthlyRevenue}</h3>
                <div className="flex items-center gap-3 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#245B91]" />
                    Revenue
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#238653]" />
                    Paid
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#D64545]" />
                    Exp
                  </span>
                </div>
              </div>
              {summary.monthlyRevenue.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">{t.app.noData}</p>
              ) : (
                <div className="space-y-3">
                  {summary.monthlyRevenue.map((m) => (
                    <div key={m.month} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono-tabular font-semibold text-[#202B38]">{m.month}</span>
                        <span className="font-mono-tabular text-slate-600">
                          {formatUsd(m.revenueUsd)} · {formatUsd(m.paymentsUsd)} · {formatUsd(m.expensesUsd)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-[#245B91]"
                            style={{ width: `${Math.round((m.revenueUsd / maxMonthlyVal) * 100)}%` }}
                          />
                        </div>
                        <div className="h-2 bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-[#238653]"
                            style={{ width: `${Math.round((m.paymentsUsd / maxMonthlyVal) * 100)}%` }}
                          />
                        </div>
                        <div className="h-2 bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-[#D64545]"
                            style={{ width: `${Math.round((m.expensesUsd / maxMonthlyVal) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inventory Distribution & Rental Status */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-[#202B38] mb-3">
                  {t.dashboard.inventoryDistribution}
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-[#245B91]">Kabaleeti</span>
                      <span className="font-mono-tabular font-semibold">
                        {summary.totalKabaleeti} ({Math.round((summary.totalKabaleeti / totalInvTotal) * 100)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-[#245B91]"
                        style={{ width: `${Math.round((summary.totalKabaleeti / totalInvTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-[#E58A24]">Jeeg</span>
                      <span className="font-mono-tabular font-semibold">
                        {summary.totalJeeg} ({Math.round((summary.totalJeeg / totalInvTotal) * 100)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-[#E58A24]"
                        style={{ width: `${Math.round((summary.totalJeeg / totalInvTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-[#202B38] mb-3">
                  {t.dashboard.rentalStatusChart}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {(
                    [
                      { key: 'ACTIVE', label: t.rentals.statusActive, color: '#245B91' },
                      { key: 'PARTIAL_RETURN', label: t.rentals.statusPartial, color: '#E5A12A' },
                      { key: 'COMPLETED', label: t.rentals.statusCompleted, color: '#238653' },
                      { key: 'OVERDUE', label: t.rentals.statusOverdue, color: '#D64545' },
                    ] as const
                  ).map((row) => {
                    const count = summary.rentalStatusCounts[row.key] || 0;
                    const pct = Math.round((count / totalStatusCount) * 100);
                    return (
                      <div key={row.key} className="p-2.5 rounded-lg bg-[#F3F5F8]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-700">{row.label}</span>
                          <span className="font-mono-tabular font-bold" style={{ color: row.color }}>
                            {count}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white rounded overflow-hidden">
                          <div className="h-full" style={{ width: `${pct}%`, backgroundColor: row.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-[#202B38] mb-4">{t.dashboard.expenseBreakdown}</h3>
              {summary.expenseByCategory.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">{t.app.noData}</p>
              ) : (
                <div className="space-y-3">
                  {summary.expenseByCategory.map((e) => {
                    const totalExp = Math.max(
                      1,
                      summary.expenseByCategory.reduce((s, x) => s + x.amountUsd, 0)
                    );
                    const pct = Math.round((e.amountUsd / totalExp) * 100);
                    return (
                      <div key={e.category} className="text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium text-[#202B38]">{e.category}</span>
                          <span className="font-mono-tabular font-semibold text-[#202B38]">
                            {formatUsd(e.amountUsd)} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded overflow-hidden">
                          <div className="h-full bg-[#E58A24]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions & Recent Returns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#202B38]">{t.dashboard.recentRentals}</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('rentals')}
                  className="text-xs font-semibold text-[#245B91] hover:underline"
                >
                  {t.nav.rentals}
                </button>
              </div>
              {recentRentals.length === 0 ? (
                <p className="p-6 text-xs text-slate-500 text-center">{t.app.noData}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentRentals.map((r) => (
                    <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#202B38] truncate">
                          {r.customerName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          <span className="font-mono-tabular">{r.rentalId}</span> · {r.productCategory} ({r.quantityRented}) · {r.startDate}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold font-mono-tabular text-[#202B38]">
                          {formatUsd(r.usdAmount)}
                        </p>
                        <RentalStatusLabel status={r.status} t={t} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#202B38]">{t.dashboard.recentReturns}</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('returns')}
                  className="text-xs font-semibold text-[#245B91] hover:underline"
                >
                  {t.nav.returns}
                </button>
              </div>
              {recentReturns.length === 0 ? (
                <p className="p-6 text-xs text-slate-500 text-center">{t.app.noData}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentReturns.map((ret) => (
                    <div key={ret.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#202B38] truncate">
                          {ret.customerName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          <span className="font-mono-tabular">{ret.returnId}</span> · {ret.rentalCode} · {ret.returnDate}
                        </p>
                      </div>
                      <div className="text-right shrink-0 text-xs font-mono-tabular">
                        <span className="font-bold text-[#238653]">+{ret.quantityReturnedGood}</span>
                        {ret.damagedQuantity > 0 && (
                          <span className="ml-2 text-[#E5A12A]">dmg:{ret.damagedQuantity}</span>
                        )}
                        {ret.lostQuantity > 0 && (
                          <span className="ml-2 text-[#D64545]">lost:{ret.lostQuantity}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
