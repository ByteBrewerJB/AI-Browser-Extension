import type { JobSnapshot, JobStatus } from '@/core/models';

export interface MessageSchema {
  request: unknown;
  response: unknown;
}

export type MessageMapDefinition = Record<string, MessageSchema>;

export type MessageRequest<M extends MessageMapDefinition, T extends keyof M> = M[T]['request'];
export type MessageResponse<M extends MessageMapDefinition, T extends keyof M> = M[T]['response'];

export interface MessageEnvelope<M extends MessageMapDefinition, T extends keyof M = keyof M> {
  type: T;
  payload: MessageRequest<M, T>;
}

export type Surface = 'background' | 'content' | 'popup' | 'options';

export interface RuntimeMessageMap extends MessageMapDefinition {
  'runtime/ping': {
    request: { surface: Surface };
    response: { type: 'pong'; receivedAt: string };
  };
  'auth/status': {
    request: { includeToken?: boolean };
    response: { authenticated: boolean; premium: boolean; token?: string | null; expiresAt?: string | null };
  };
  'content/bookmark': {
    request: { conversationId?: string | null; messageId?: string | null };
    response: { status: 'queued' };
  };
  'content/audio-download': {
    request: { conversationId?: string | null; messageId?: string | null };
    response: { status: 'pending' };
  };
  'content/run-chain': {
    request: { chainId: string };
    response:
      | { status: 'completed'; chainId: string; executedAt: string; steps: number }
      | { status: 'cancelled'; chainId: string; steps: number }
      | { status: 'busy' }
      | { status: 'not_found' }
      | { status: 'empty' }
      | { status: 'error'; message: string };
  };
  'jobs/schedule-export': {
    request: {
      exportId: string;
      runAt: string;
      payload?: Record<string, unknown>;
      jobType?: string;
      maxAttempts?: number;
    };
    response: { jobId: string; scheduledFor: string };
  };
  'jobs/log-event': {
    request: {
      event: string;
      guideId?: string;
      metadata?: Record<string, unknown>;
      runAt?: string;
      surface?: Surface;
    };
    response: { jobId: string };
  };
  'jobs/list': {
    request: { limit?: number; statuses?: JobStatus[] };
    response: { jobs: JobSnapshot[]; fetchedAt: string };
  };
}

export type RuntimeMessageType = keyof RuntimeMessageMap;

export type RuntimeMessageRequest<T extends RuntimeMessageType> = MessageRequest<RuntimeMessageMap, T>;
export type RuntimeMessageResponse<T extends RuntimeMessageType> = MessageResponse<RuntimeMessageMap, T>;

export type RuntimeMessageEnvelope<T extends RuntimeMessageType = RuntimeMessageType> = MessageEnvelope<RuntimeMessageMap, T>;
