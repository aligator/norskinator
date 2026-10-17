/** One compact row: how many plants of a bed reached each stage. */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { PLANT_STAGES, PLANT_STAGE_LABELS, PlantStage, type StageCounts } from '../../../core/garden.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { formatNumber } from '../shared/format.ts';

import './plant-sprite.ts';

/** Six narrow columns; two labels get a shorter form there. */
const SHORT_LABELS: Readonly<Record<PlantStage, string>> = {
  ...PLANT_STAGE_LABELS,
  [PlantStage.Seed]: 'Frø',
  [PlantStage.Blossom]: 'I blomst',
};

export class GardenStrip extends LitElement {
  static override properties = {
    counts: { attribute: false },
  };

  static override styles = [
    sharedStyles,
    css`
      ul {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      li {
        display: grid;
        justify-items: center;
        text-align: center;
      }

      strong {
        white-space: nowrap;
        font: 700 var(--fs-sm) / 1.2 var(--font-num);
      }

      span {
        font-size: var(--fs-xs);
        color: var(--fg-muted);
      }
    `,
  ];

  declare counts: StageCounts;

  protected override render(): TemplateResult {
    return html`<ul aria-label="Planter per stadium">
      ${PLANT_STAGES.map(
        (stage) => html`<li>
          <plant-sprite .plant=${{ stage, wilted: false, growth: 1 }} .size=${30}></plant-sprite>
          <strong>${formatNumber(this.counts[stage])}</strong>
          <span>${SHORT_LABELS[stage]}</span>
        </li>`,
      )}
    </ul>`;
  }
}

customElements.define('garden-strip', GardenStrip);

declare global {
  interface HTMLElementTagNameMap {
    'garden-strip': GardenStrip;
  }
}
