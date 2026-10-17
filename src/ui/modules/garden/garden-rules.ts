/** How the garden works, on a page of its own so the garden itself stays uncluttered. */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { PLANT_STAGE_LABELS, STAGE_START_DAYS } from '../../../core/garden.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { StoreController, store } from '../shared/store.ts';

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

  protected readonly storeController = new StoreController(this);

  protected override render(): TemplateResult {
    const { newPerDay, reviewsPerDay } = store.state.settings;

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
        <li>Dagene viser hvor lenge du husker svaret med 90 % sikkerhet. De vokser bare når du husker svaret, og planten vokser med dem.</li>
        <li>Et feil svar får planten til å visne. Svarer du riktig neste gang, vokser den tilbake, men ikke like høyt som før.</li>
        <li>💧 En tørst plante er klar for repetisjon. Vann den ved å øve.</li>
        <li>
          Hver dag kommer opptil ${newPerDay} nye frø og ${reviewsPerDay} repetisjoner. Slik lærer du ikke mer enn du
          klarer å huske. Begge tallene kan du endre under Innstillinger → Øving.
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
