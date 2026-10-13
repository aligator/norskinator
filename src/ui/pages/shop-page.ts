import { LitElement, css, html, type TemplateResult } from 'lit';

import { GARDEN_HREF } from '../modules/shared/links.ts';
import { pageStyles } from './page-styles.ts';

import '../modules/garden/plant-shop.ts';

export class ShopPage extends LitElement {
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

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('wide', '');
  }

  protected override render(): TemplateResult {
    return html`
      <a class="back" href=${GARDEN_HREF}>‹ Hagen</a>
      <h1>Frøbutikken</h1>
      <plant-shop></plant-shop>
    `;
  }
}

customElements.define('shop-page', ShopPage);

declare global {
  interface HTMLElementTagNameMap {
    'shop-page': ShopPage;
  }
}
