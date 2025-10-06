export type NetworkIncidentReason = 'disallowed_host' | 'payload_match';

export interface NetworkMonitorIncident {
  id: string;
  url: string;
  method: string;
  reason: NetworkIncidentReason;
  matchedPattern?: string;
  payloadSnippet?: string;
  timestamp: string;
}
