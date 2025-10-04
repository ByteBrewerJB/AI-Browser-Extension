import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { HistorySection } from './features/history/HistorySection';
import { MediaSection } from './features/media/MediaSection';
import { PromptsSection } from './features/prompts/PromptsSection';
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

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <HistorySection />
        <PromptsSection />
        <MediaSection />
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6" aria-labelledby="feature-grid-heading">
          <h2 id="feature-grid-heading" className="text-lg font-semibold text-emerald-300">
            {t('options.featureGridHeading') ?? 'Component-driven roadmap'}
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            {t('options.featureGridDescription') ??
              'Shared layouts and overlays allow us to reuse UI patterns across popup, options, and content surfaces.'}
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {featureColumns.map((column) => (
              <div key={column.title} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <h3 className="text-base font-semibold text-emerald-200">{column.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {column.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
