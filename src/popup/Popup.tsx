import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { initI18n, setLanguage } from '@/shared/i18n';
import { useSettingsStore } from '@/shared/state/settingsStore';

const languageOptions = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' }
];

export function Popup() {
  const { t, i18n } = useTranslation();
  const { language, direction, setLanguage: setStoreLanguage, toggleDirection } = useSettingsStore();

  useEffect(() => {
    initI18n();
  }, []);

  useEffect(() => {
    if (i18n.language !== language) {
      setLanguage(language);
    }
    document.documentElement.dir = direction;
  }, [language, direction, i18n]);

  return (
    <div className="w-96 space-y-4 p-4" dir={direction}>
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{t('app.title')}</h1>
        <p className="text-sm text-slate-300">{t('app.tagline')}</p>
      </header>

      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-200">Language</span>
          <select
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
            value={language}
            onChange={(event) => {
              const newLanguage = event.target.value;
              setStoreLanguage(newLanguage);
              setLanguage(newLanguage);
            }}
          >
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-200">Text direction</span>
          <button
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
            onClick={() => toggleDirection()}
          >
            {direction.toUpperCase()}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('popup.bookmarks')}</h2>
        <p className="mt-2 text-sm text-slate-300">Structured conversation bookmarks arrive soon.</p>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('popup.pinnedChats')}</h2>
        <p className="mt-2 text-sm text-slate-300">Pin priority threads for quick access.</p>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('popup.recentActivity')}</h2>
            <p className="mt-1 text-xs text-slate-400">Recent chats, exports, and downloads will appear here.</p>
          </div>
          <button className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 shadow-sm">
            {t('popup.openDashboard')}
          </button>
        </div>
      </section>
    </div>
  );
}
