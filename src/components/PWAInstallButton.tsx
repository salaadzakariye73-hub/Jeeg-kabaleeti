import { Download, Smartphone } from 'lucide-react';
import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { TranslationDict } from '../i18n/translations';

interface PWAInstallButtonProps {
  t: TranslationDict;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ t }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-lg bg-[#E58A24] px-3 py-2 text-xs font-semibold text-white hover:bg-[#cf7a1b] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="w-4 h-4" />
        <span>{t.app.installApp}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-[#202B38] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Smartphone className="w-4 h-4 text-[#245B91]" />
          <span>{t.app.installOnIos}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl border border-slate-200">
              <h3 className="text-lg font-semibold text-[#202B38]">{t.app.installOnIos}</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                {t.app.iosStep1}
                <br />
                {t.app.iosStep2}
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#172B42] py-2.5 text-sm font-medium text-white hover:bg-[#245B91] transition-colors"
              >
                {t.app.close}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
