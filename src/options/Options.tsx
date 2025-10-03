import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { initI18n } from '@/shared/i18n';
import { useSettingsStore } from '@/shared/state/settingsStore';

const featureColumns = [
  {
    title: 'Conversations',
    items: ['Bookmarks', 'Pinned', 'Bulk archive', 'Bulk export', 'Word counter']
  },
  {
    title: 'Prompts & GPTs',
    items: ['Prompt chains', 'Folders & subfolders', 'GPT folders', 'Bulk actions']
  },
  {
    title: 'Audio & Sync',
    items: ['Audio download', 'Advanced voice mode', 'Voice options', 'Cross-device sync']
  }
];

export function Options() {
  const { t } = useTranslation();
  const { direction } = useSettingsStore();

  useEffect(() => {
    initI18n();
  }, []);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir={direction}>
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">AI Companion</p>
          <h1 className="text-3xl font-semibold">{t('options.heading')}</h1>
          <p className="max-w-2xl text-sm text-slate-300">{t('options.description')}</p>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <section className="grid gap-4 md:grid-cols-3">
          {featureColumns.map((column) => (
            <article
              key={column.title}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"
            >
              <h2 className="text-lg font-medium text-emerald-300">{column.title}</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {column.items.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6">
          <p className="text-sm text-slate-300">{t('options.comingSoon')}</p>
        </section>
      </main>
    </div>
  );
}
