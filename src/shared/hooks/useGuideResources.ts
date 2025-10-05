import { useEffect, useState } from 'react';

import { parseGuidesFile, type GuideResource } from '@/core/models/guides';

export interface GuideResourcesState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  guides: GuideResource[];
  error?: string | null;
}

export function resolveGuidesAssetUrl(): string {
  const chromeApi = (globalThis as unknown as { chrome?: typeof chrome }).chrome;
  if (chromeApi?.runtime?.getURL) {
    return chromeApi.runtime.getURL('guides.json');
  }
  return '/guides.json';
}

export async function openGuideResource(url: string): Promise<void> {
  const chromeApi = (globalThis as unknown as { chrome?: typeof chrome }).chrome;

  if (chromeApi?.tabs?.create) {
    await new Promise<void>((resolve, reject) => {
      chromeApi.tabs.create({ url, active: true }, () => {
        const lastError = chromeApi.runtime?.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve();
      });
    });
    return;
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function useGuideResources(): GuideResourcesState {
  const [state, setState] = useState<GuideResourcesState>({ status: 'idle', guides: [] });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadGuides() {
      setState({ status: 'loading', guides: [] });
      try {
        const response = await fetch(resolveGuidesAssetUrl(), {
          signal: controller.signal,
          cache: 'no-cache'
        });

        if (!response.ok) {
          throw new Error(`Failed to load guides (${response.status})`);
        }

        const payload = await response.json();
        const parsed = parseGuidesFile(payload);

        if (cancelled) {
          return;
        }

        setState({ status: 'loaded', guides: parsed.guides });
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        setState({
          status: 'error',
          guides: [],
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    void loadGuides();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return state;
}
