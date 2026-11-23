import type { AssetTelemetryStatus, OsmAsset } from '../../types/grid.ts';
import type { TelemetryListener, TelemetryProvider } from './TelemetryProvider.ts';

export class SimulatedTelemetryProvider implements TelemetryProvider {
  readonly name = 'SimulatedTelemetryProvider (SSE 5s Stream)';
  readonly sourceType = 'SIMULATED' as const;

  private statusMap = new Map<string, AssetTelemetryStatus>();
  private listeners = new Set<TelemetryListener>();
  private eventSource: EventSource | null = null;

  getStatus(assetId: string): AssetTelemetryStatus | null {
    return this.statusMap.get(assetId) ?? null;
  }

  getAllStatuses(): Record<string, AssetTelemetryStatus> {
    const record: Record<string, AssetTelemetryStatus> = {};
    for (const [id, status] of this.statusMap.entries()) {
      record[id] = status;
    }
    return record;
  }

  registerAssets(assets: OsmAsset[]): void {
    const payloadAssets = assets.slice(0, 300).map((a) => ({
      id: a.id,
      type: a.type,
      name: a.name,
      voltage: a.voltage,
      lat: a.lat,
      lon: a.lon
    }));

    if (payloadAssets.length === 0) return;

    fetch('/api/telemetry/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets: payloadAssets })
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.updates)) {
          this.ingestUpdates(data.updates as AssetTelemetryStatus[]);
        }
      })
      .catch(() => {
        // SSE stream will synchronize on next tick
      });
  }

  subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    this.ensureConnected();

    if (this.statusMap.size > 0) {
      listener(Array.from(this.statusMap.values()));
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  destroy(): void {
    this.listeners.clear();
    this.disconnect();
  }

  private ensureConnected(): void {
    if (this.eventSource || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    const es = new EventSource('/api/telemetry/stream');
    es.addEventListener('telemetry', (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as { updates?: AssetTelemetryStatus[] };
        if (Array.isArray(parsed.updates) && parsed.updates.length > 0) {
          this.ingestUpdates(parsed.updates);
        }
      } catch {
        // Ignore malformed SSE payload
      }
    });

    es.onerror = () => {
      // Browser EventSource automatically reconnects
    };

    this.eventSource = es;
  }

  private disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private ingestUpdates(updates: AssetTelemetryStatus[]): void {
    for (const upd of updates) {
      this.statusMap.set(upd.assetId, upd);
    }
    for (const listener of this.listeners) {
      listener(updates);
    }
  }
}
