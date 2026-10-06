/**
 * AGPL §13 asks to offer the source to everyone using the app over a network.
 * Set `VITE_SOURCE_URL` at build time (Docker build arg `SOURCE_URL`).
 */
export function sourceUrl(): string | null {
  const configured = import.meta.env.VITE_SOURCE_URL?.trim() ?? '';

  return configured === '' ? null : configured;
}
