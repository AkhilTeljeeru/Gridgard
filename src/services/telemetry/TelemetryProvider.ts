import type { AssetTelemetryStatus, OsmAsset } from '../../types/grid.ts';

export type TelemetryListener = (updates: AssetTelemetryStatus[]) => void;

export interface TelemetryProvider {
  readonly name: string;
  readonly sourceType: 'SIMULATED' | 'UTILITY';
  getStatus(assetId: string): AssetTelemetryStatus | null;
  getAllStatuses(): Record<string, AssetTelemetryStatus>;
  registerAssets(assets: OsmAsset[]): void;
  subscribe(listener: TelemetryListener): () => void;
  destroy(): void;
}
