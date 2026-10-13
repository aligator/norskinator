import { LitElement, html, type TemplateResult } from 'lit';

import { pageStyles } from './page-styles.ts';
import { currentPlantId } from './router.ts';

import '../modules/garden/plant-detail.ts';

/** `#plante/<id>`; one plant of the garden. */
export class PlantPage extends LitElement {
  static override styles = pageStyles;

  override connectedCallback(): void {
    super.connectedCallback();
    globalThis.addEventListener('hashchange', this.#onHashChange);
  }

  override disconnectedCallback(): void {
    globalThis.removeEventListener('hashchange', this.#onHashChange);
    super.disconnectedCallback();
  }

  protected override render(): TemplateResult {
    return html`<plant-detail .itemId=${currentPlantId()}></plant-detail>`;
  }

  /** The route stays `plante` from one plant to the next, so the shell would not re-render. */
  #onHashChange = (): void => {
    this.requestUpdate();
  };
}

customElements.define('plant-page', PlantPage);

declare global {
  interface HTMLElementTagNameMap {
    'plant-page': PlantPage;
  }
}
