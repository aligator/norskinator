/** Layout and event helpers shared by the settings forms. */
import { css } from 'lit';

import type { Settings } from '../../../core/storage.ts';
import { announce } from '../shared/announce.ts';
import { store } from '../shared/store.ts';

export const preferenceStyles = css`
  :host {
    display: grid;
    gap: var(--sp-6);
  }

  .eyebrow {
    margin-bottom: var(--sp-3);
  }

  .switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-4);
  }

  .hint {
    margin-top: var(--sp-2);
    font-size: var(--fs-sm);
    color: var(--fg-muted);
  }
`;

export function stringDetail(event: Event): string | null {
  if (event instanceof CustomEvent && typeof event.detail === 'string') {
    return event.detail;
  }

  return null;
}

/** Saves at once and tells screen-reader users it happened. */
export function saveSettings(source: EventTarget, patch: Partial<Settings>): void {
  store.updateSettings(patch);
  announce(source, 'Lagret');
}
