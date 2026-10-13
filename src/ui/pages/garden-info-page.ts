import { LitElement, css, html, type TemplateResult } from 'lit';

import { GARDEN_HREF } from '../modules/shared/links.ts';
import { pageStyles } from './page-styles.ts';

import '../modules/garden/garden-rules.ts';

export class GardenInfoPage extends LitElement {
  static override styles = [
    pageStyles,
    css`
      .back {
        display: inline-flex;
        align-items: center;
        min-height: var(--hit);
        font-weight: 600;
        text-decoration: none;
      }
    `,
  ];

  protected override render(): TemplateResult {
    return html`
      <a class="back" href=${GARDEN_HREF}>‹ Hagen</a>
      <h1>Slik vokser hagen</h1>
      <garden-rules></garden-rules>
    `;
  }
}

customElements.define('garden-info-page', GardenInfoPage);

declare global {
  interface HTMLElementTagNameMap {
    'garden-info-page': GardenInfoPage;
  }
}
