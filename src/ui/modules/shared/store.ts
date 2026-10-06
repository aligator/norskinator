/**
 * The one store instance for the whole app, and a controller that re-renders
 * a Lit component on every store change.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { Store } from '../../../core/store.ts';
import { DECKS } from '../../../decks/registry.ts';

export const store = new Store({ decks: DECKS });

export class StoreController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  #unsubscribe: (() => void) | null = null;

  constructor(host: ReactiveControllerHost) {
    this.#host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.#unsubscribe = store.subscribe(() => {
      this.#host.requestUpdate();
    });
  }

  hostDisconnected(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }
}
