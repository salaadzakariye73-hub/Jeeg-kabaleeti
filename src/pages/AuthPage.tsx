import { AlertCircle, Building2, Lock, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { JEEG_IMAGE_PATH, KABALEETI_IMAGE_PATH } from '../components/EquipmentVisual';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { useApp } from '../context/AppContext';

export const AuthPage: React.FC = () => {
  const { hasManager, lang, setLang, t, settings, login, setupFirstManager } = useApp();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSetup = hasManager === false;
  const systemName = settings?.systemName || t.app.defaultSystemName;
  const websiteName = settings?.websiteName || t.app.defaultWebsiteName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isSetup) {
        if (password.length < 8) {
          setError(t.auth.passwordTooShort);
          setSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setError(t.auth.passwordMismatch);
          setSubmitting(false);
          return;
        }
        await setupFirstManager(fullName.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F5F8] flex flex-col">
      {/* Minimal Header */}
      <header className="w-full bg-white border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {settings?.logoDataUrl ? (
            <img
              src={settings.logoDataUrl}
              alt={systemName}
              className="w-9 h-9 rounded-lg object-contain border border-slate-200 bg-white shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[#172B42] text-white flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          )}
          <span className="font-bold text-base sm:text-lg text-[#172B42] truncate">
            {systemName} · {websiteName}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton t={t} />
          <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setLang('so')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                lang === 'so' ? 'bg-white text-[#172B42] shadow-sm' : 'text-slate-600 hover:text-[#172B42]'
              }`}
            >
              Soomaali
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                lang === 'en' ? 'bg-white text-[#172B42] shadow-sm' : 'text-slate-600 hover:text-[#172B42]'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden items-stretch">
          {/* Left Showcase Panel */}
          <div className="lg:col-span-6 bg-[#172B42] text-white p-6 sm:p-10 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#E58A24]">
                {systemName}
              </p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {websiteName}
              </h1>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                {t.app.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 my-8">
              <div className="rounded-xl overflow-hidden border border-white/15 bg-white/5">
                <img
                  src={KABALEETI_IMAGE_PATH}
                  alt="Kabaleeti"
                  referrerPolicy="no-referrer"
                  className="w-full h-32 object-cover"
                />
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-white">Kabaleeti</p>
                  <p className="text-[11px] text-slate-300 truncate">{t.inventory.kabaleetiLabel}</p>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden border border-white/15 bg-white/5">
                <img
                  src={JEEG_IMAGE_PATH}
                  alt="Jeeg"
                  referrerPolicy="no-referrer"
                  className="w-full h-32 object-cover"
                />
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-white">Jeeg</p>
                  <p className="text-[11px] text-slate-300 truncate">{t.inventory.jeegLabel}</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-slate-300 border-t border-white/15 pt-4">
              <ShieldCheck className="w-4 h-4 text-[#E58A24] shrink-0 mt-0.5" />
              <span>{t.auth.setupLockedNotice}</span>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-center">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#245B91] mb-2">
                <Lock className="w-4 h-4" />
                <span>{isSetup ? 'Initial Setup' : 'Internal Access'}</span>
              </div>
              <h2 className="text-2xl font-bold text-[#202B38]">
                {isSetup ? t.auth.setupTitle : t.auth.loginTitle}
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                {isSetup ? t.auth.setupSubtitle : t.auth.loginSubtitle}
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#D64545]/30 bg-[#D64545]/10 px-4 py-3 text-sm text-[#D64545]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSetup && (
                <div>
                  <label className="block text-sm font-medium text-[#202B38] mb-1.5">
                    {t.auth.fullName}
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Cabdiraxmaan Maxamed"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#202B38] focus:border-[#245B91] focus:outline-none focus:ring-2 focus:ring-[#245B91]/20 min-h-[44px]"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#202B38] mb-1.5">
                  {t.auth.email}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@mshcompany.so"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#202B38] focus:border-[#245B91] focus:outline-none focus:ring-2 focus:ring-[#245B91]/20 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#202B38] mb-1.5">
                  {t.auth.password}
                </label>
                <input
                  type="password"
                  required
                  minLength={isSetup ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#202B38] focus:border-[#245B91] focus:outline-none focus:ring-2 focus:ring-[#245B91]/20 min-h-[44px]"
                />
              </div>

              {isSetup && (
                <div>
                  <label className="block text-sm font-medium text-[#202B38] mb-1.5">
                    {t.auth.confirmPassword}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#202B38] focus:border-[#245B91] focus:outline-none focus:ring-2 focus:ring-[#245B91]/20 min-h-[44px]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#245B91] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1c4975] disabled:opacity-60 transition-colors min-h-[46px]"
              >
                {submitting
                  ? t.app.loading
                  : isSetup
                  ? t.auth.createManagerBtn
                  : t.auth.loginBtn}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
