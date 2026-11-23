import type { AssetTelemetryStatus, OsmAsset } from '../../types/grid.ts';
import type { TelemetryListener, TelemetryProvider } from './TelemetryProvider.ts';

export class RealScadaProvider implements TelemetryProvider {
  readonly name = 'RealScadaProvider (DISCOM IEC 60870-5-104 / DNP3 Stub)';
  readonly sourceType = 'UTILITY' as const;

  constructor(private readonly scadaEndpointUrl?: string) {}

  getStatus(_assetId: string): AssetTelemetryStatus | null {
    throw new Error(
      `RealScadaProvider is not implemented. Connect a DISCOM SCADA gateway${
        this.scadaEndpointUrl ? ` at ${this.scadaEndpointUrl}` : ''
      } before enabling VITE_TELEMETRY_PROVIDER=scada.`
    );
  }

  getAllStatuses(): Record<string, AssetTelemetryStatus> {
    throw new Error('RealScadaProvider is not implemented.');
  }

  registerAssets(_assets: OsmAsset[]): void {
    throw new Error('RealScadaProvider is not implemented.');
  }

  subscribe(_listener: TelemetryListener): () => void {
    throw new Error('RealScadaProvider is not implemented.');
  }

  destroy(): void {
    // No-op stub
  }
}
