import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { HistorySection } from './features/history/HistorySection';
import { MediaSection } from './features/media/MediaSection';
import { PromptsSection } from './features/prompts/PromptsSection';
import { initI18n } from '@/shared/i18n';
import { sendRuntimeMessage } from '@/shared/messaging/router';
import { useSettingsStore } from '@/shared/state/settingsStore';

const EXPORT_DELAY_MS = 5 * 60_000;

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
  const [isSchedulingExport, setIsSchedulingExport] = useState(false);
  const [exportScheduledAt, setExportScheduledAt] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    void initI18n();
  }, []);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  const scheduleExportJob = useCallback(async () => {
    setIsSchedulingExport(true);
    setExportError(null);
    try {
      const response = await sendRuntimeMessage('jobs/schedule-export', {
        exportId: crypto.randomUUID(),
        runAt: new Date(Date.now() + EXPORT_DELAY_MS).toISOString(),
        payload: { scope: 'conversations' },
        maxAttempts: 5
      });
      setExportScheduledAt(response.scheduledFor);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSchedulingExport(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir={direction}>
      <header className="border-b border-slate-800 bg-slate-900/60">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">AI Companion</p>
            <h1 className="text-3xl font-semibold">{t('options.heading')}</h1>
            <p className="max-w-2xl text-sm text-slate-300">{t('options.description')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureColumns.map((column) => (
              <div key={column.title} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">{column.title}</h2>
                <ul className="mt-3 space-y-2 text-xs text-slate-300">
                  {column.items.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <header className="mb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {t('options.exportHeading') ?? 'Scheduled exports'}
              </h2>
              <p className="text-xs text-slate-400">
                {t('options.exportDescription') ?? 'Plan conversation backups via the background job queue.'}
              </p>
            </div>
            <button
              className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 shadow-sm disabled:opacity-60"
              onClick={() => void scheduleExportJob()}
              disabled={isSchedulingExport}
              type="button"
            >
              {isSchedulingExport ? t('options.exportScheduling') ?? 'Scheduling…' : t('options.exportScheduleCta') ?? 'Schedule export in 5 min'}
            </button>
          </header>
          {exportScheduledAt ? (
            <p className="text-xs text-slate-300">
              {t('options.exportScheduledLabel', {
                defaultValue: 'Next export scheduled for {{time}}',
                time: new Date(exportScheduledAt).toLocaleString()
              })}
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              {t('options.exportEmptyState') ?? 'No export scheduled yet.'}
            </p>
          )}
          {exportError ? <p className="mt-2 text-xs text-rose-400">{exportError}</p> : null}
        </section>

        <HistorySection />
        <PromptsSection />
        <MediaSection />
      </main>
    </div>
  );
}
