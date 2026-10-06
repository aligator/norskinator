/** Level, total XP and progress to the next level. */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { sharedStyles } from '../../components/styles/shared.ts';

import { levelInfo } from '../../../core/gamification.ts';
import { formatNumber } from '../shared/format.ts';
import { StoreController, store } from '../shared/store.ts';

import './level-badge.ts';
import './xp-bar.ts';

export class LevelSummary extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: var(--sp-2) var(--sp-4);
      }

      strong {
        display: block;
        font-size: var(--fs-xl);
      }

      xp-bar {
        grid-column: 1 / -1;
      }
    `,
  ];

  protected readonly storeController = new StoreController(this);

  protected override render(): TemplateResult {
    const xp = store.state.progress.xp;
    const info = levelInfo(xp);

    return html`
      <level-badge large decorative .level=${info.level}></level-badge>
      <div>
        <strong>Nivå ${info.level}</strong>
        <span class="num">${formatNumber(xp)} XP</span>
      </div>
      <xp-bar show-label .xp=${xp}></xp-bar>
    `;
  }
}

customElements.define('level-summary', LevelSummary);

declare global {
  interface HTMLElementTagNameMap {
    'level-summary': LevelSummary;
  }
}
