import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import React from 'react';
import type { RentalStatus } from '../../shared/types';
import type { TranslationDict } from '../i18n/translations';

interface StatusLabelProps {
  status: RentalStatus;
  t: TranslationDict;
}

export const RentalStatusLabel: React.FC<StatusLabelProps> = ({ status, t }) => {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#238653] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{t.rentals.statusCompleted}</span>
        </span>
      );
    case 'OVERDUE':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D64545] whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{t.rentals.statusOverdue}</span>
        </span>
      );
    case 'PARTIAL_RETURN':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E5A12A] whitespace-nowrap">
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          <span>{t.rentals.statusPartial}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#245B91] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{t.rentals.statusActive}</span>
        </span>
      );
  }
};
