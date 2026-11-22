import {
  AlertCircle,
  CheckCircle2,
  Database,
  DollarSign,
  HardDrive,
  Lock,
  Palette,
  RefreshCw,
  Upload,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import type { BackupRecordDTO, ExchangeRateDTO } from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

type SettingsTab = 'branding' | 'exchange' | 'security' | 'backups';

export const SettingsPage: React.FC = () => {
  const { user, t, settings, currentRate, refreshSettings, refreshExchangeRate } = useApp();
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';

  const [tab, setTab] = useState<SettingsTab>('branding');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Branding state
  const [systemName, setSystemName] = useState(settings?.systemName || 'MSh Company');
  const [websiteName, setWebsiteName] = useState(settings?.websiteName || 'Jeeg iyo Kabaleeti');
  const [companyName, setCompanyName] = useState(settings?.companyName || 'MSh Company');
  const [phone, setPhone] = useState(settings?.phone || '');
  const [email, setEmail] = useState(settings?.email || '');
  const [address, setAddress] = useState(settings?.address || '');
  const [description, setDescription] = useState(settings?.description || '');
  const [logoDataUrl, setLogoDataUrl] = useState(settings?.logoDataUrl || '');
  const [savingBrand, setSavingBrand] = useState(false);

  // Exchange rate state
  const [rateHistory, setRateHistory] = useState<ExchangeRateDTO[]>([]);
  const [newRate, setNewRate] = useState(String(currentRate));
  const [rateNotes, setRateNotes] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  // Security password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Backups & DB health
  const [dbEngine, setDbEngine] = useState('');
  const [backups, setBackups] = useState<BackupRecordDTO[]>([]);
  const [runningBackup, setRunningBackup] = useState(false);

  useEffect(() => {
    if (settings) {
      setSystemName(settings.systemName);
      setWebsiteName(settings.websiteName);
      setCompanyName(settings.companyName);
      setPhone(settings.phone);
      setEmail(settings.email);
      setAddress(settings.address);
      setDescription(settings.description);
      setLogoDataUrl(settings.logoDataUrl || '');
    }
  }, [settings]);

  useEffect(() => {
    setNewRate(String(currentRate));
  }, [currentRate]);

  const loadMeta = useCallback(async () => {
    try {
      const [rateRes, bkpRes] = await Promise.all([api.getExchangeRates(), api.listBackups()]);
      setRateHistory(rateRes.data.history);
      setDbEngine(bkpRes.databaseEngine);
      setBackups(bkpRes.backups);
    } catch {
      // ignore if offline
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_400_000) {
      setError('Logo file must be under 1.4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSavingBrand(true);
    try {
      await api.updateSettings({
        systemName,
        websiteName,
        companyName,
        phone,
        email,
        address,
        description,
        logoDataUrl,
      });
      await refreshSettings();
      setNotice('Branding & company settings updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSavingBrand(false);
    }
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSavingRate(true);
    try {
      await api.updateExchangeRate({ rate: Number(newRate), notes: rateNotes });
      setRateNotes('');
      await refreshExchangeRate();
      await loadMeta();
      setNotice(`Exchange rate updated to 1 USD = ${newRate} SOS.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update exchange rate');
    } finally {
      setSavingRate(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSavingPassword(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setNotice('Password updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleTriggerBackup = async () => {
    setError('');
    setNotice('');
    setRunningBackup(true);
    try {
      const bkp = await api.runBackupNow();
      await loadMeta();
      setNotice(`Verified checkpoint ${bkp.backupId} completed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run backup');
    } finally {
      setRunningBackup(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <h2 className="text-lg font-bold text-[#202B38] mb-3">{t.settings.title}</h2>
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { id: 'branding', label: t.settings.brandingTab, icon: Palette },
              { id: 'exchange', label: t.settings.exchangeTab, icon: DollarSign },
              { id: 'security', label: t.settings.securityTab, icon: Lock },
              { id: 'backups', label: t.settings.backupTab, icon: Database },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setError('');
                  setNotice('');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                  tab === item.id ? 'bg-white text-[#172B42] shadow-sm' : 'text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
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

      {/* Tab 1: Branding & Logo Upload */}
      {tab === 'branding' && (
        <form onSubmit={handleSaveBranding} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-5 border-b border-slate-100">
            <div className="w-24 h-24 rounded-xl border border-slate-200 bg-[#F3F5F8] flex items-center justify-center overflow-hidden shrink-0">
              {logoDataUrl ? (
                <img src={logoDataUrl} alt="Company Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <Upload className="w-7 h-7 text-slate-400" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold text-[#202B38]">{t.settings.logoUpload}</p>
              <p className="text-xs text-slate-500">{t.settings.logoHint}</p>
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFile}
                    className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#245B91] file:text-white"
                  />
                  {logoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoDataUrl('')}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#D64545]"
                    >
                      {t.settings.removeLogo}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">{t.settings.systemName}</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px] disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">{t.settings.websiteName}</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={websiteName}
                onChange={(e) => setWebsiteName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px] disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">{t.settings.companyName}</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px] disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">{t.settings.phone}</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px] disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">{t.settings.email}</label>
              <input
                type="email"
                disabled={!isAdmin}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px] disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">{t.settings.address}</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px] disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">{t.settings.description}</label>
            <textarea
              rows={2}
              disabled={!isAdmin}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingBrand}
                className="rounded-lg bg-[#245B91] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1c4975] min-h-[44px]"
              >
                {savingBrand ? t.app.loading : t.app.save}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Tab 2: Exchange Rate */}
      {tab === 'exchange' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500">{t.settings.currentRate}</p>
                <p className="text-2xl font-bold font-mono-tabular text-[#172B42]">
                  1 USD = {currentRate} SOS
                </p>
              </div>
              <p className="text-xs text-slate-500 max-w-md">{t.settings.rateNote}</p>
            </div>

            {isAdmin && (
              <form onSubmit={handleSaveRate} className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.settings.newRate}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">{t.rentals.notes}</label>
                  <input
                    type="text"
                    value={rateNotes}
                    onChange={(e) => setRateNotes(e.target.value)}
                    placeholder="Reason for rate update"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingRate}
                  className="rounded-lg bg-[#E58A24] px-4 py-2.5 text-xs font-semibold text-white min-h-[44px]"
                >
                  {savingRate ? t.app.loading : t.settings.updateRateBtn}
                </button>
              </form>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#202B38]">{t.settings.rateHistory}</h3>
            </div>
            <div className="divide-y divide-slate-100 text-xs sm:text-sm">
              {rateHistory.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-mono-tabular font-bold text-[#172B42]">
                      1 USD = {r.rate} SOS {r.isCurrent ? '(Current)' : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {r.changedByName} · {r.notes || '-'}
                    </p>
                  </div>
                  <span className="font-mono-tabular text-xs text-slate-400">
                    {r.effectiveFrom.slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Account Security */}
      {tab === 'security' && (
        <form onSubmit={handleChangePassword} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 max-w-lg space-y-4">
          <h3 className="text-base font-bold text-[#202B38]">{t.settings.changePasswordTitle}</h3>
          <div>
            <label className="block text-xs font-semibold mb-1">{t.settings.currentPassword}</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">{t.settings.newPassword}</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="rounded-lg bg-[#245B91] px-5 py-2.5 text-xs font-semibold text-white min-h-[44px]"
          >
            {savingPassword ? t.app.loading : t.settings.updatePasswordBtn}
          </button>
        </form>
      )}

      {/* Tab 4: Automatic Backups & DB Health */}
      {tab === 'backups' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-[#202B38]">
                <HardDrive className="w-4 h-4 text-[#245B91]" />
                <span>{t.settings.dbEngineLabel}: </span>
                <span className="font-mono-tabular text-[#238653]">
                  {dbEngine === 'mongodb_atlas' ? 'MongoDB Atlas' : 'Local Persistent Store'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {t.settings.backupScheduleLabel}: {t.settings.every6Hours}
              </p>
            </div>

            {isManager && (
              <button
                type="button"
                disabled={runningBackup}
                onClick={handleTriggerBackup}
                className="inline-flex items-center gap-2 rounded-lg bg-[#172B42] px-4 py-2.5 text-xs font-semibold text-white min-h-[44px]"
              >
                <RefreshCw className={`w-4 h-4 ${runningBackup ? 'animate-spin' : ''}`} />
                <span>{t.settings.runBackupNow}</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {backups.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 text-center">{t.app.noData}</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {backups.map((b) => (
                  <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-mono-tabular font-bold text-[#172B42]">
                        {b.backupId} · {b.triggerType}
                      </p>
                      <p className="text-slate-500 font-mono-tabular truncate max-w-md">
                        SHA-256: {b.checksum.slice(0, 24)}...
                      </p>
                    </div>
                    <div className="text-right font-mono-tabular">
                      <span className="font-semibold text-[#238653]">{b.status}</span>
                      <span className="block text-slate-400">{b.createdAt.slice(0, 19).replace('T', ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
