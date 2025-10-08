import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/shared/i18n/useTranslation';

import { HistorySection } from './features/history/HistorySection';
import { MediaSection } from './features/media/MediaSection';
import { GuideResourcesCard } from './features/infoAndUpdates/GuideResourcesCard';
import { EncryptionSection } from './features/privacy/EncryptionSection';
import { PromptsSection } from './features/prompts/PromptsSection';
import { useHistoryStore } from './features/history/historyStore';
import { SidebarPreferences } from './features/sidebar/SidebarPreferences';
import type { JobSnapshot } from '@/core/models';
import { sendRuntimeMessage } from '@/shared/messaging/router';
import { useSettingsStore } from '@/shared/state/settingsStore';

const EXPORT_DELAY_MS = 5 * 60_000;
const JOB_REFRESH_INTERVAL_MS = 60_000;
const JOB_LIST_LIMIT = 10;

const STATUS_BADGE_CLASSES: Record<JobSnapshot['status'], string> = {
  pending: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  running: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  completed: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  failed: 'border-rose-400/40 bg-rose-400/10 text-rose-200'
};

type StatusFilterValue = JobSnapshot['status'] | 'all';

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
    items: ['Audio download', 'Advanced voice mode', 'Voice options', 'Cross-device sync', 'Passphrase lock']
  }
];

export function Options() {
  const { t } = useTranslation();
  const direction = useSettingsStore((state) => state.direction);
  const hydrated = useSettingsStore((state) => state.hydrated);
  const updateConversationConfig = useHistoryStore((state) => state.updateConversationConfig);
  const [isSchedulingExport, setIsSchedulingExport] = useState(false);
  const [optimisticExportAt, setOptimisticExportAt] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobSnapshot[]>([]);
  const [jobsFetchedAt, setJobsFetchedAt] = useState<string | null>(null);
  const [isFetchingJobs, setIsFetchingJobs] = useState(false);
  const [jobLoadError, setJobLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const historyFolder = params.get('historyFolder');
    if (historyFolder) {
      updateConversationConfig({ folderId: historyFolder });
    }
  }, [updateConversationConfig]);

  const loadJobs = useCallback(async () => {
    setIsFetchingJobs(true);
    setJobLoadError(null);
    try {
      const response = await sendRuntimeMessage('jobs/list', { limit: JOB_LIST_LIMIT });
      setJobs(response.jobs);
      setJobsFetchedAt(response.fetchedAt);
    } catch (error) {
      setJobLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsFetchingJobs(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadJobs();
    }, JOB_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadJobs]);

  const exportJobs = useMemo(() => jobs.filter((job) => job.type === 'export'), [jobs]);
  const pendingExportJob = useMemo(
    () => exportJobs.find((job) => job.status === 'pending'),
    [exportJobs]
  );
  const runningExportJob = useMemo(
    () => exportJobs.find((job) => job.status === 'running'),
    [exportJobs]
  );

  const jobTypeOptions = useMemo(() => {
    const uniqueTypes = Array.from(new Set(jobs.map((job) => job.type)));
    uniqueTypes.sort();
    return uniqueTypes;
  }, [jobs]);

  useEffect(() => {
    if (typeFilter !== 'all' && !jobTypeOptions.includes(typeFilter)) {
      setTypeFilter('all');
    }
  }, [jobTypeOptions, typeFilter]);

  useEffect(() => {
    if (pendingExportJob) {
      setOptimisticExportAt(null);
    }
  }, [pendingExportJob]);

  const formatJobType = useCallback(
    (type: JobSnapshot['type']) => {
      const translationKey = `options.exportJobsTypes.${type}`;
      const translated = t(translationKey, { defaultValue: '' });
      if (translated && translated !== translationKey) {
        return translated;
      }
      if (!type) {
        return t('options.exportJobsTypeFallback', { defaultValue: 'Job' });
      }
      return type.charAt(0).toUpperCase() + type.slice(1);
    },
    [t]
  );

  const typeFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('options.exportJobsFilterTypeAll', { defaultValue: 'All job types' }) },
      ...jobTypeOptions.map((type) => ({
        value: type,
        label: formatJobType(type)
      }))
    ],
    [formatJobType, jobTypeOptions, t]
  );

  const filteredJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          (statusFilter === 'all' || job.status === statusFilter) &&
          (typeFilter === 'all' || job.type === typeFilter)
      ),
    [jobs, statusFilter, typeFilter]
  );

  const formatDateTime = useCallback(
    (value: string | null | undefined) => {
      if (!value) {
        return t('options.exportJobsUnknownTime') ?? 'TBD';
      }
      return new Date(value).toLocaleString();
    },
    [t]
  );

  const statusLabels = useMemo<Record<JobSnapshot['status'], string>>(
    () => ({
      pending: t('options.exportJobsStatus.pending', { defaultValue: 'Pending' }),
      running: t('options.exportJobsStatus.running', { defaultValue: 'Running' }),
      completed: t('options.exportJobsStatus.completed', { defaultValue: 'Completed' }),
      failed: t('options.exportJobsStatus.failed', { defaultValue: 'Failed' })
    }),
    [t]
  );

  const statusFilterOptions = useMemo(
    () =>
      (['all', 'pending', 'running', 'completed', 'failed'] as StatusFilterValue[]).map((value) => ({
        value,
        label:
          value === 'all'
            ? t('options.exportJobsFilterStatusAll', { defaultValue: 'All statuses' })
            : statusLabels[value]
      })),
    [statusLabels, t]
  );

  const getStatusBadgeDetails = useCallback(
    (job: JobSnapshot) => {
      if (job.status === 'pending') {
        if (job.attempts > 0) {
          const nextAttempt = Math.min(job.attempts + 1, job.maxAttempts);
          return (
            t('options.exportJobsStatusDetails.pendingRetry', {
              defaultValue: 'Retry {{attempt}}/{{max}} at {{time}}',
              attempt: nextAttempt,
              max: job.maxAttempts,
              time: formatDateTime(job.runAt)
            }) ?? undefined
          );
        }
        return (
          t('options.exportJobsStatusDetails.pendingInitial', {
            defaultValue: 'First run at {{time}}',
            time: formatDateTime(job.runAt)
          }) ?? undefined
        );
      }
      if (job.status === 'running') {
        return (
          t('options.exportJobsStatusDetails.running', {
            defaultValue: 'Attempt {{attempt}}/{{max}} in progress',
            attempt: job.attempts,
            max: job.maxAttempts
          }) ?? undefined
        );
      }
      if (job.status === 'failed') {
        return (
          t('options.exportJobsStatusDetails.failed', {
            defaultValue: 'Failed after {{attempts}}/{{max}} attempts',
            attempts: job.attempts,
            max: job.maxAttempts
          }) ?? undefined
        );
      }
      if (job.status === 'completed' && job.attempts > 1) {
        return (
          t('options.exportJobsStatusDetails.completed', {
            defaultValue: 'Completed after {{attempts}} attempts',
            attempts: job.attempts
          }) ?? undefined
        );
      }
      return undefined;
    },
    [formatDateTime, t]
  );

  const exportStatusMessage = useMemo(() => {
    if (runningExportJob) {
      return (
        t('options.exportRunningLabel', {
          defaultValue: 'Latest export started at {{time}}',
          time: formatDateTime(runningExportJob.lastRunAt ?? runningExportJob.updatedAt)
        }) ?? undefined
      );
    }
    if (pendingExportJob) {
      return (
        t('options.exportScheduledLabel', {
          defaultValue: 'Next export scheduled for {{time}}',
          time: formatDateTime(pendingExportJob.runAt)
        }) ?? undefined
      );
    }
    if (optimisticExportAt) {
      return (
        t('options.exportScheduledLabel', {
          defaultValue: 'Next export scheduled for {{time}}',
          time: formatDateTime(optimisticExportAt)
        }) ?? undefined
      );
    }
    return null;
  }, [formatDateTime, optimisticExportAt, pendingExportJob, runningExportJob, t]);

  const scheduleExportJob = useCallback(async () => {
    setIsSchedulingExport(true);
    setExportError(null);
    try {
      const nextRunAt = new Date(Date.now() + EXPORT_DELAY_MS).toISOString();
      const response = await sendRuntimeMessage('jobs/schedule-export', {
        exportId: crypto.randomUUID(),
        runAt: nextRunAt,
        payload: { scope: 'conversations' },
        maxAttempts: 5
      });
      setOptimisticExportAt(response.scheduledFor ?? nextRunAt);
      await loadJobs();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSchedulingExport(false);
    }
  }, [loadJobs]);

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
              {isSchedulingExport ? t('options.exportScheduling') ?? 'Schedulingâ€¦' : t('options.exportScheduleCta') ?? 'Schedule export in 5 min'}
            </button>
          </header>
          {exportStatusMessage ? (
            <p className="text-xs text-slate-300">{exportStatusMessage}</p>
          ) : (
            <p className="text-xs text-slate-400">
              {t('options.exportEmptyState') ?? 'No export scheduled yet.'}
            </p>
          )}
          {exportError ? <p className="mt-2 text-xs text-rose-400">{exportError}</p> : null}

          <div className="mt-4 rounded-md border border-slate-800/70 bg-slate-950/40 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {t('options.exportJobsHeading') ?? 'Background job queue'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {t('options.exportJobsDescription') ?? 'Track export retries and background processing.'}
                </p>
              </div>
              <div className="text-[11px] text-slate-500">
                {isFetchingJobs ? (
                  <span>{t('options.exportJobsLoading') ?? 'Refreshingâ€¦'}</span>
                ) : jobsFetchedAt ? (
                  <span>
                    {t('options.exportJobsUpdatedLabel', {
                      defaultValue: 'Updated {{time}}',
                      time: formatDateTime(jobsFetchedAt)
                    })}
                  </span>
                ) : null}
              </div>
            </div>
            {jobLoadError ? <p className="mb-3 text-[11px] text-rose-400">{jobLoadError}</p> : null}
            {jobs.length > 0 ? (
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-400">
                  <span>{t('options.exportJobsFilterStatusLabel') ?? 'Status'}</span>
                  <select
                    className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilterValue)}
                  >
                    {statusFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-400">
                  <span>{t('options.exportJobsFilterTypeLabel') ?? 'Type'}</span>
                  <select
                    className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-[11px] text-slate-100 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                  >
                    {typeFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {jobs.length === 0 ? (
              <p className="text-xs text-slate-400">
                {t('options.exportJobsEmpty') ?? 'No export jobs scheduled yet.'}
              </p>
            ) : filteredJobs.length === 0 ? (
              <p className="text-xs text-slate-400">
                {t('options.exportJobsFilterNoResults') ?? 'No jobs match the selected filters.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed border-separate border-spacing-y-2 text-xs">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 text-left font-medium">
                        {t('options.exportJobsStatusHeading') ?? 'Status'}
                      </th>
                      <th className="px-3 text-left font-medium">
                        {t('options.exportJobsTypeHeading') ?? 'Type'}
                      </th>
                      <th className="px-3 text-left font-medium">
                        {t('options.exportJobsAttempts') ?? 'Attempts'}
                      </th>
                      <th className="px-3 text-left font-medium">
                        {t('options.exportJobsNextRun') ?? 'Next run'}
                      </th>
                      <th className="px-3 text-left font-medium">
                        {t('options.exportJobsLastRun') ?? 'Last run'}
                      </th>
                      <th className="px-3 text-left font-medium">
                        {t('options.exportJobsLastError') ?? 'Last error'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {filteredJobs.map((job) => {
                      const badgeDetails = getStatusBadgeDetails(job);
                      return (
                        <tr key={job.id} className="rounded-md bg-slate-900/80">
                          <td className="rounded-l-md px-3 py-2 align-top">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                STATUS_BADGE_CLASSES[job.status]
                              }`}
                            >
                              <span>{statusLabels[job.status]}</span>
                              {badgeDetails ? (
                                <span className="text-[10px] font-normal opacity-80">{badgeDetails}</span>
                              ) : null}
                            </span>
                            <div className="mt-1 text-[11px] text-slate-500">#{job.id.slice(0, 8)}</div>
                          </td>
                          <td className="px-3 py-2 align-top text-[11px] text-slate-300">
                            {formatJobType(job.type)}
                          </td>
                          <td className="px-3 py-2 align-top text-[11px] text-slate-300">
                            {job.attempts}/{job.maxAttempts}
                          </td>
                        <td className="px-3 py-2 align-top text-[11px] text-slate-300">
                          {job.status === 'pending'
                            ? formatDateTime(job.runAt)
                            : job.status === 'running'
                              ? t('options.exportJobsInProgress') ?? 'In progress'
                              : 'â€”'}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-slate-300">
                          {job.lastRunAt ? formatDateTime(job.lastRunAt) : 'â€”'}
                        </td>
                        <td className="rounded-r-md px-3 py-2 align-top text-[11px] text-slate-300">
                          {job.lastError
                            ? job.lastError
                            : job.status === 'completed' && job.completedAt
                              ? t('options.exportJobsCompletedAt', {
                                  defaultValue: 'Completed {{time}}',
                                  time: formatDateTime(job.completedAt)
                                })
                              : 'â€”'}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <SidebarPreferences />
        <GuideResourcesCard />
        <EncryptionSection />
        <HistorySection />
        <PromptsSection />
        <MediaSection />
      </main>
    </div>
  );
}

