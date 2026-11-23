/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
  readonly VITE_TELEMETRY_PROVIDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
