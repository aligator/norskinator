import { LitElement, html, type TemplateResult } from 'lit';

import { pageStyles } from './page-styles.ts';

import '../modules/legal/legal-notice.ts';

export class LegalPage extends LitElement {
  static override styles = pageStyles;

  protected override render(): TemplateResult {
    return html`
      <h1>Impressum og personvern</h1>
      <legal-notice></legal-notice>
    `;
  }
}

customElements.define('legal-page', LegalPage);

declare global {
  interface HTMLElementTagNameMap {
    'legal-page': LegalPage;
  }
}
