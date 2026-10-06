/** Accuracy, answer count, best combo and longest streak. */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { accuracy } from '../../../core/gamification.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { formatNumber, formatPercent, pluralDays } from '../shared/format.ts';
import { StoreController, store } from '../shared/store.ts';

export class KeyFigures extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      dl {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        margin: 0;
        border-top: 1px solid var(--border);
      }

      div {
        padding: var(--sp-4) var(--sp-3);
        border-bottom: 1px solid var(--border);
      }

      div:nth-child(odd) {
        border-right: 1px solid var(--border);
      }

      dd {
        margin: 0;
        font: 700 var(--fs-xl) var(--font-num);
      }

      @media (min-width: 600px) {
        dl {
          grid-template-columns: repeat(4, 1fr);
        }

        div:nth-child(odd) {
          border-right: 0;
        }

        div:not(:last-child) {
          border-right: 1px solid var(--border);
        }
      }
    `,
  ];

  protected readonly storeController = new StoreController(this);

  protected override render(): TemplateResult {
    const progress = store.state.progress;
    const hitRate = progress.totalAnswers === 0 ? '–' : formatPercent(accuracy(progress));

    return html`
      <dl>
        <div><dt class="eyebrow">Treffsikkerhet</dt><dd>${hitRate}</dd></div>
        <div><dt class="eyebrow">Svar totalt</dt><dd>${formatNumber(progress.totalAnswers)}</dd></div>
        <div><dt class="eyebrow">Beste kombo</dt><dd>${formatNumber(progress.bestCombo)}</dd></div>
        <div><dt class="eyebrow">Lengste rekke</dt><dd>${pluralDays(progress.bestStreakDays)}</dd></div>
      </dl>
    `;
  }
}

customElements.define('key-figures', KeyFigures);

declare global {
  interface HTMLElementTagNameMap {
    'key-figures': KeyFigures;
  }
}
