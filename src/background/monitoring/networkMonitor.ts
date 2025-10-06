import type { NetworkMonitorIncident } from '@/shared/types/monitoring';

export interface NetworkMonitorOptions {
  allowedHosts?: Array<string | RegExp>;
  sensitivePatterns?: RegExp[];
  maxIncidents?: number;
  fetchImplementation?: typeof fetch;
  onIncident?: (incident: NetworkMonitorIncident) => void;
  logger?: Pick<Console, 'warn' | 'info'>;
}

export interface NetworkMonitor {
  install(): void;
  teardown(): void;
  getIncidents(): NetworkMonitorIncident[];
  clearIncidents(): void;
}

const DEFAULT_PATTERNS = [/"content"\s*:/i, /"prompt"\s*:/i, /"messages"\s*:/i];
const DEFAULT_MAX_INCIDENTS = 50;

function resolveFetch(fetchImplementation?: typeof fetch): typeof fetch | undefined {
  if (typeof fetchImplementation === 'function') {
    return fetchImplementation;
  }
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis);
  }
  return undefined;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch (_error) {
    return null;
  }
}

function isAllowedHost(hostname: string, allowedHosts: Array<string | RegExp>): boolean {
  for (const entry of allowedHosts) {
    if (typeof entry === 'string' && hostname === entry) {
      return true;
    }
    if (entry instanceof RegExp && entry.test(hostname)) {
      return true;
    }
  }
  return false;
}

function extractBodyText(body: unknown): string | null {
  if (!body) {
    return null;
  }
  if (typeof body === 'string') {
    return body;
  }
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return body.toString();
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const pairs: string[] = [];
    for (const [key, value] of body.entries()) {
      pairs.push(`${key}=${typeof value === 'string' ? value : '[object]'}`);
    }
    return pairs.join('&');
  }
  return null;
}

function truncateSnippet(value: string, maxLength = 200): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `incident-${Math.random().toString(36).slice(2, 10)}`;
}

export function createNetworkMonitor(options: NetworkMonitorOptions = {}): NetworkMonitor {
  const allowedHosts = options.allowedHosts ?? [];
  const sensitivePatterns = options.sensitivePatterns ?? DEFAULT_PATTERNS;
  const maxIncidents = options.maxIncidents ?? DEFAULT_MAX_INCIDENTS;
  const logger = options.logger ?? console;
  const incidents: NetworkMonitorIncident[] = [];
  const originalFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch : undefined;
  const baseFetch = resolveFetch(options.fetchImplementation);
  let installed = false;

  function recordIncident(incident: NetworkMonitorIncident) {
    incidents.push(incident);
    if (incidents.length > maxIncidents) {
      incidents.splice(0, incidents.length - maxIncidents);
    }
    logger.warn(
      `[ai-companion][network-monitor] incident ${incident.reason} ${incident.method} ${incident.url}`
    );
    if (incident.payloadSnippet) {
      logger.warn(`[ai-companion][network-monitor] payload`, incident.payloadSnippet);
    }
    try {
      options.onIncident?.(incident);
    } catch (error) {
      logger.warn('[ai-companion][network-monitor] incident listener failed', error);
    }
  }

  function inspectRequest(input: RequestInfo | URL, init?: RequestInit) {
    const urlValue = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const parsedUrl = parseUrl(urlValue);
    const hostname = parsedUrl?.hostname ?? '';
    const protocol = parsedUrl?.protocol ?? '';
    const bodyText = extractBodyText(init?.body);

    if (protocol && protocol !== 'https:' && protocol !== 'http:' && protocol !== 'chrome-extension:') {
      return;
    }

    if (hostname && allowedHosts.length > 0 && !isAllowedHost(hostname, allowedHosts) && protocol !== 'chrome-extension:') {
      recordIncident({
        id: generateId(),
        url: urlValue,
        method,
        reason: 'disallowed_host',
        timestamp: new Date().toISOString()
      });
    }

    if (typeof bodyText === 'string') {
      const normalized = bodyText.trim();
      if (normalized.length >= 32) {
        for (const pattern of sensitivePatterns) {
          if (pattern.test(normalized)) {
            recordIncident({
              id: generateId(),
              url: urlValue,
              method,
              reason: 'payload_match',
              matchedPattern: pattern.source,
              payloadSnippet: truncateSnippet(normalized.replace(/\s+/g, ' ')),
              timestamp: new Date().toISOString()
            });
            break;
          }
        }
      }
    }
  }

  const proxiedFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      inspectRequest(input, init);
    } catch (error) {
      logger.warn('[ai-companion][network-monitor] inspection failed', error);
    }
    if (!baseFetch) {
      throw new Error('Fetch API is not available in this environment.');
    }
    return baseFetch(input as RequestInfo, init as RequestInit);
  };

  return {
    install() {
      if (installed) {
        return;
      }
      if (!baseFetch || typeof proxiedFetch !== 'function') {
        logger.warn('[ai-companion][network-monitor] fetch not available; monitor disabled');
        return;
      }
      (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = proxiedFetch;
      installed = true;
    },
    teardown() {
      if (!installed) {
        return;
      }
      if (originalFetch) {
        (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
      }
      installed = false;
    },
    getIncidents() {
      return incidents.slice();
    },
    clearIncidents() {
      incidents.length = 0;
    }
  };
}
