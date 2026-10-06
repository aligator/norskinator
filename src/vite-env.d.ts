/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Repository URL for the AGPL source link in Innstillinger → Om. */
  readonly VITE_SOURCE_URL?: string;
  /** Release version from the git tag, e.g. `v1.0.1` or `main-abc1234`. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
