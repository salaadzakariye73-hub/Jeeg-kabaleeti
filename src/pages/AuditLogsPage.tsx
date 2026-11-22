import { Activity } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { AuditLogDTO } from '../../shared/types';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

export const AuditLogsPage: React.FC = () => {
  const { t } = useApp();
  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listAuditLogs()
      .then(setLogs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex items-center gap-3">
        <Activity className="w-5 h-5 text-[#245B91]" />
        <div>
          <h2 className="text-lg font-bold text-[#202B38]">{t.nav.auditLogs}</h2>
          <p className="text-xs text-slate-500">Permanent immutable activity trail (Read-Only)</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#D64545]/30 bg-[#D64545]/10 p-4 text-sm text-[#D64545]">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.loading}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t.app.noData}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Record</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono-tabular text-slate-500 whitespace-nowrap">
                      {log.createdAt.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#202B38]">{log.userName}</td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-600">{log.userRole}</td>
                    <td className="py-3 px-4 font-mono-tabular font-semibold text-[#245B91]">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular">
                      {log.entityType} · {log.entityId}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-600 max-w-xs truncate">
                      {log.newValues ? JSON.stringify(log.newValues) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
