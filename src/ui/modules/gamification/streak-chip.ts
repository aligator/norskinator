/** Flame chip with the current day streak; muted once the streak is broken. */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { flameIcon } from '../../components/icons.ts';
import { pluralDays } from '../shared/format.ts';

export class StreakChip extends LitElement {
  static override properties = {
    days: { type: Number },
    broken: { type: Boolean, reflect: true },
  };

  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-1);
      height: 36px;
      padding: 0 var(--sp-3);
      border-radius: var(--r-pill);
      background: var(--flame-bg);
      color: var(--flame);
      font: 700 var(--fs-md) / 1 var(--font-num);
    }

    :host([broken]) {
      background: var(--surface-2);
      color: var(--fg-muted);
    }
  `;

  declare days: number;
  declare broken: boolean;

  constructor() {
    super();
    this.days = 0;
    this.broken = false;
  }

  protected override updated(): void {
    const label = this.broken
      ? 'Rekka ble brutt – fullfør en økt for å starte på nytt'
      : `${pluralDays(this.days)} på rad`;

    this.setAttribute('role', 'img');
    this.setAttribute('aria-label', label);
    this.title = label;
  }

  protected override render(): TemplateResult {
    return html`${flameIcon()}<span aria-hidden="true">${this.days}</span>`;
  }
}

customElements.define('streak-chip', StreakChip);

declare global {
  interface HTMLElementTagNameMap {
    'streak-chip': StreakChip;
  }
}
