import type { JobHandler } from './scheduler';

interface EventJobPayload {
  event?: unknown;
  surface?: unknown;
  guideId?: unknown;
  metadata?: unknown;
  openedAt?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function createEventLoggerJobHandler(): JobHandler {
  return async (job) => {
    const payload = job.payload as EventJobPayload | undefined;
    const eventName = typeof payload?.event === 'string' ? payload.event : 'unknown';
    const surface = typeof payload?.surface === 'string' ? payload.surface : undefined;
    const guideId = typeof payload?.guideId === 'string' ? payload.guideId : undefined;
    const openedAt = typeof payload?.openedAt === 'string' ? payload.openedAt : new Date().toISOString();
    const metadata = toRecord(payload?.metadata);

    const logPayload: Record<string, unknown> = {
      jobId: job.id,
      event: eventName,
      openedAt,
    };

    if (surface) {
      logPayload.surface = surface;
    }
    if (guideId) {
      logPayload.guideId = guideId;
    }
    if (metadata) {
      logPayload.metadata = metadata;
    }

    console.info('[ai-companion] telemetry event', logPayload);
  };
}
