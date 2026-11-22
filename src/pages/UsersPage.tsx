import { AlertCircle, CheckCircle2, ShieldCheck, UserCheck, UserPlus, UserX, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import type { UserDTO } from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export const UsersPage: React.FC = () => {
  const { t } = useApp();
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      await api.createAdmin({ fullName, email, password });
      setShowCreate(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setNotice('Admin account created successfully.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Admin account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (u: UserDTO) => {
    setError('');
    setNotice('');
    try {
      await api.toggleAdminStatus(u.id, !u.isActive);
      setNotice(`${u.fullName} — ${!u.isActive ? t.users.activeStatus : t.users.inactiveStatus}`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#202B38]">{t.users.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t.users.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#245B91] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1c4975] min-h-[44px] whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t.users.createAdmin}</span>
        </button>
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
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.noData}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#245B91]" />
                    <span className="font-bold text-sm text-[#202B38]">{u.fullName}</span>
                    <span className="text-xs font-mono-tabular text-slate-500">· {u.role}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {u.email} · {t.users.lastLogin}:{' '}
                    <span className="font-mono-tabular">
                      {u.lastLoginAt ? u.lastLoginAt.slice(0, 16).replace('T', ' ') : '-'}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      u.isActive ? 'text-[#238653]' : 'text-[#D64545]'
                    }`}
                  >
                    {u.isActive ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                    <span>{u.isActive ? t.users.activeStatus : t.users.inactiveStatus}</span>
                  </span>

                  {u.role === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(u)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold min-h-[38px] ${
                        u.isActive
                          ? 'border-[#D64545]/40 text-[#D64545] hover:bg-[#D64545]/10'
                          : 'border-[#238653]/40 text-[#238653] hover:bg-[#238653]/10'
                      }`}
                    >
                      {u.isActive ? t.users.deactivate : t.users.activate}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202B38]">{t.users.createAdmin}</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAdmin} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">{t.auth.fullName}</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">{t.auth.email}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">{t.auth.password}</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[44px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold min-h-[42px]"
                >
                  {t.app.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#245B91] px-5 py-2 text-xs font-semibold text-white min-h-[42px]"
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
