import { LitElement, html, type TemplateResult } from 'lit';

import { pageStyles } from './page-styles.ts';

import '../modules/settings/about-section.ts';
import '../modules/settings/preferences-form.ts';
import '../modules/settings/reset-progress.ts';

export class SettingsPage extends LitElement {
  static override styles = pageStyles;

  protected override render(): TemplateResult {
    return html`
      <h1>Innstillinger</h1>
      <preferences-form></preferences-form>
      <about-section></about-section>
      <reset-progress></reset-progress>
    `;
  }
}

customElements.define('settings-page', SettingsPage);

declare global {
  interface HTMLElementTagNameMap {
    'settings-page': SettingsPage;
  }
}
