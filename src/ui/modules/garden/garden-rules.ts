/** How the garden works, on a page of its own so the garden itself stays uncluttered. */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { MAX_YOUNG_PLANTS, PLANT_STAGE_LABELS, STAGE_START_DAYS, YOUNG_INTERVAL_DAYS } from '../../../core/garden.ts';
import { sharedStyles } from '../../components/styles/shared.ts';

import './plant-sprite.ts';

const STAGES = ['sprout', 'plant', 'bush', 'tree', 'blossom'] as const;

export class GardenRules extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: var(--sp-5);
      }

      .stages {
        display: grid;
        gap: var(--sp-2);
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .stages li {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
      }

      .stages span {
        color: var(--fg-muted);
      }

      ul.rules {
        display: grid;
        gap: var(--sp-3);
        margin: 0;
        padding-left: var(--sp-5);
      }
    `,
  ];

  protected override render(): TemplateResult {
    return html`
      <ul class="stages" aria-label="Stadiene">
        ${STAGES.map(
          (stage) => html`<li>
            <plant-sprite .plant=${{ stage, wilted: false, growth: 1 }} .size=${44}></plant-sprite>
            <strong>${PLANT_STAGE_LABELS[stage]}</strong>
            <span>fra ${STAGE_START_DAYS[stage]} ${STAGE_START_DAYS[stage] === 1 ? 'dag' : 'dager'}</span>
          </li>`,
        )}
      </ul>
      <ul class="rules">
        <li>Hver oppgave er et frø. Første gang du løser den riktig, spirer den.</li>
        <li>Dagene er tiden til neste repetisjon. Den vokser bare når du husker svaret, og planten vokser med den.</li>
        <li>Et feil svar får planten til å visne. Den starter som spire igjen.</li>
        <li>💧 En tørst plante er klar for repetisjon. Vann den ved å øve.</li>
        <li>
          Nye frø kommer bare når færre enn ${MAX_YOUNG_PLANTS} unge planter (under ${YOUNG_INTERVAL_DAYS} dager)
          trenger stell. Slik lærer du ikke mer enn du klarer å huske.
        </li>
      </ul>
    `;
  }
}

customElements.define('garden-rules', GardenRules);

declare global {
  interface HTMLElementTagNameMap {
    'garden-rules': GardenRules;
  }
}
