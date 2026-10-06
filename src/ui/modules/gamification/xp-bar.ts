/** XP progress towards the next level. */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { levelInfo } from '../../../core/gamification.ts';
import { formatNumber } from '../shared/format.ts';
import '../../components/progress-bar.ts';

export class XpBar extends LitElement {
  static override properties = {
    xp: { type: Number },
    showLabel: { type: Boolean, attribute: 'show-label' },
  };

  static override styles = css`
    :host {
      display: grid;
      gap: var(--sp-1);
      min-width: 0;
    }

    .label {
      font-size: var(--fs-sm);
      font-variant-numeric: tabular-nums;
      color: var(--fg-muted);
    }
  `;

  declare xp: number;
  declare showLabel: boolean;

  constructor() {
    super();
    this.xp = 0;
    this.showLabel = false;
  }

  protected override render(): TemplateResult {
    const info = levelInfo(this.xp);
    const label = `${formatNumber(info.xpIntoLevel)} / ${formatNumber(info.xpForNextLevel)} XP til nivå ${info.level + 1}`;

    return html`
      <ui-progress-bar
        .value=${info.xpIntoLevel}
        .max=${info.xpForNextLevel}
        label="Erfaring mot neste nivå"
        value-text=${label}
      ></ui-progress-bar>
      ${this.showLabel ? html`<span class="label">${label}</span>` : nothing}
    `;
  }
}

customElements.define('xp-bar', XpBar);

declare global {
  interface HTMLElementTagNameMap {
    'xp-bar': XpBar;
  }
}
