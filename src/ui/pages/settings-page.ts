import { LitElement, css, html, type TemplateResult } from 'lit';

import { pageStyles } from './page-styles.ts';

import '../components/nav-row.ts';
import '../modules/settings/reset-progress.ts';

/** Settings menu: one row per sub-page, the danger zone kept apart at the bottom. */
export class SettingsPage extends LitElement {
  static override styles = [
    pageStyles,
    css`
      nav {
        display: grid;
        gap: var(--sp-3);
      }
    `,
  ];

  protected override render(): TemplateResult {
    return html`
      <h1>Innstillinger</h1>
      <nav aria-label="Innstillinger">
        <ui-nav-row
          href="#innstillinger/ovelse"
          label="Øving"
          hint="Oppgavetyper, oversettelse, økt og dagsmål"
        ></ui-nav-row>
        <ui-nav-row href="#innstillinger/visning" label="Utseende og lyd" hint="Tema, lydeffekter og opplesing"></ui-nav-row>
        <ui-nav-row href="#innstillinger/om" label="Om appen" hint="Versjon, lisenser og personvern"></ui-nav-row>
      </nav>
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
