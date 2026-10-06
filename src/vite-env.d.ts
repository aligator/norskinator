/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Repository URL for the AGPL source link in Innstillinger → Om. */
  readonly VITE_SOURCE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
