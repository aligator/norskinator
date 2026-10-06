/**
 * Version shown to the learner. Release builds get it from the git tag
 * (`VITE_APP_VERSION`, set by CI); local builds fall back to package.json.
 */
import { version as packageVersion } from '../../../../package.json';

export function appVersion(): string {
  const released = import.meta.env.VITE_APP_VERSION?.trim() ?? '';

  return released === '' ? `${packageVersion}-dev` : released;
}
