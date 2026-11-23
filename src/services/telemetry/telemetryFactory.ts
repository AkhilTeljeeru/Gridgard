import { RealScadaProvider } from './RealScadaProvider.ts';
import { SimulatedTelemetryProvider } from './SimulatedTelemetryProvider.ts';
import type { TelemetryProvider } from './TelemetryProvider.ts';

export type TelemetryProviderMode = 'simulated' | 'scada';

export function createTelemetryProvider(): TelemetryProvider {
  const configuredMode = (
    (import.meta.env.VITE_TELEMETRY_PROVIDER as string | undefined) ?? 'simulated'
  )
    .trim()
    .toLowerCase();

  if (configuredMode === 'scada') {
    const scadaUrl = import.meta.env.VITE_SCADA_FEED_URL as string | undefined;
    return new RealScadaProvider(scadaUrl);
  }

  return new SimulatedTelemetryProvider();
}
