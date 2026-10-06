/** Re-renders its host when the browser's voice list arrives, which happens asynchronously. */
import type { ReactiveController, ReactiveControllerHost } from 'lit';

import { findNorwegianVoice, onVoicesReady, speechSupported } from './speech.ts';

export class VoiceController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  #unsubscribe: (() => void) | null = null;

  constructor(host: ReactiveControllerHost) {
    this.#host = host;
    host.addController(this);
  }

  /** True when a Norwegian voice can read sentences aloud right now. */
  get available(): boolean {
    return speechSupported() && findNorwegianVoice() !== null;
  }

  hostConnected(): void {
    this.#unsubscribe = onVoicesReady(() => {
      this.#host.requestUpdate();
    });
  }

  hostDisconnected(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }
}
