/**
 * Service-worker updates. A new build is downloaded in the background but only
 * applied when the learner taps "Oppdater" — never in the middle of a session.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { registerSW } from 'virtual:pwa-register';

/** An installed PWA can stay open for days; look for a new build this often. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let updateReady = false;
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;
let started = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function checkPeriodically(registration: ServiceWorkerRegistration): void {
  setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      void registration.update();
    }
  }, CHECK_INTERVAL_MS);
}

/** Registers the service worker once. Safe to call repeatedly. */
export function startUpdateWatch(): void {
  if (started) {
    return;
  }

  started = true;

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      notify();
    },
    onRegisteredSW(_scriptUrl, registration) {
      if (registration !== undefined) {
        checkPeriodically(registration);
      }
    },
  });
}

/**
 * workbox-window reloads once the new worker takes control. A page opened
 * before any worker existed is never "controlled", so that signal never comes —
 * reload ourselves if nothing happened shortly after.
 */
const RELOAD_FALLBACK_MS = 3000;

export function installUpdate(): void {
  void applyUpdate?.(true);

  setTimeout(() => {
    globalThis.location.reload();
  }, RELOAD_FALLBACK_MS);
}

/** Re-renders its host when an update becomes available. */
export class UpdateController implements ReactiveController {
  readonly #host: ReactiveControllerHost;

  constructor(host: ReactiveControllerHost) {
    this.#host = host;
    host.addController(this);
  }

  get ready(): boolean {
    return updateReady;
  }

  hostConnected(): void {
    listeners.add(this.#onChange);
  }

  hostDisconnected(): void {
    listeners.delete(this.#onChange);
  }

  readonly #onChange = (): void => {
    this.#host.requestUpdate();
  };
}
