import type { JobHandler } from './scheduler';
import { exportToJSON, exportToTXT } from '@/core/services/exportService';
import { db } from '@/core/storage/db';

function resolveChrome() {
  return (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome;
}

type ExportFormat = 'json' | 'txt';

interface ExportJobPayload {
  exportId?: string;
  scope?: 'conversations';
  conversationIds?: string[];
  format?: ExportFormat;
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-z0-9\-]/gi, '-');
}

async function resolveConversationIds(payload: ExportJobPayload): Promise<string[]> {
  if (Array.isArray(payload.conversationIds) && payload.conversationIds.length > 0) {
    return payload.conversationIds;
  }

  if (payload.scope && payload.scope !== 'conversations') {
    return [];
  }

  const ids = await db.conversations.orderBy('updatedAt').reverse().primaryKeys();
  return ids.map((value) => String(value));
}

function resolveMimeType(format: ExportFormat) {
  return format === 'txt' ? 'text/plain;charset=utf-8' : 'application/json;charset=utf-8';
}

async function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const chromeApi = resolveChrome();
    const downloadsApi = chromeApi?.downloads;
    if (!downloadsApi?.download) {
      throw new Error('Downloads API unavailable');
    }

    await new Promise<number>((resolve, reject) => {
      downloadsApi.download(
        { url, filename, saveAs: false },
        (downloadId) => {
          const lastError = chromeApi?.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          if (typeof downloadId !== 'number') {
            reject(new Error('Download ID missing from downloads.download response'));
            return;
          }
          resolve(downloadId);
        }
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function createExportJobHandler(): JobHandler {
  return async (job) => {
    const payload: ExportJobPayload = {
      scope: 'conversations',
      ...job.payload
    };

    const conversationIds = await resolveConversationIds(payload);
    if (conversationIds.length === 0) {
      throw new Error('No conversations available for export');
    }

    const format: ExportFormat = payload.format === 'txt' ? 'txt' : 'json';
    const content =
      format === 'txt'
        ? await exportToTXT(conversationIds)
        : await exportToJSON(conversationIds);

    const blob = new Blob([content], { type: resolveMimeType(format) });

    const timestamp = sanitizeSegment(new Date().toISOString().replace(/[:.]/g, '-'));
    const exportId = sanitizeSegment(payload.exportId ?? job.id);
    const filename = `ai-companion-${exportId}-${timestamp}.${format}`;

    await triggerDownload(blob, filename);
  };
}
