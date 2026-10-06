import { LitElement, css, html, type TemplateResult } from 'lit';

import { pageStyles } from './page-styles.ts';

import '../modules/gamification/badge-grid.ts';
import '../modules/gamification/level-summary.ts';
import '../modules/stats/key-figures.ts';
import '../modules/stats/mastery-list.ts';

export class StatsPage extends LitElement {
  static override styles = [
    pageStyles,
    css`
      :host {
        gap: var(--sp-8);
      }

      .columns {
        display: grid;
        gap: var(--sp-8);
      }

      @media (min-width: 1280px) {
        .columns {
          grid-template-columns: 1fr 1fr;
          align-items: start;
        }
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('wide', '');
  }

  protected override render(): TemplateResult {
    return html`
      <h1>Statistikk</h1>
      <level-summary role="region" aria-label="Nivå"></level-summary>
      <key-figures role="region" aria-label="Nøkkeltall"></key-figures>
      <div class="columns">
        <mastery-list></mastery-list>
        <badge-grid></badge-grid>
      </div>
    `;
  }
}

customElements.define('stats-page', StatsPage);

declare global {
  interface HTMLElementTagNameMap {
    'stats-page': StatsPage;
  }
}
