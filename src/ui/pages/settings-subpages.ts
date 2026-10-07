/** The settings sub-pages: a way back to the menu, a title and one module each. */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { pageStyles } from './page-styles.ts';

import '../modules/settings/about-section.ts';
import '../modules/settings/display-preferences.ts';
import '../modules/settings/practice-preferences.ts';

const subpageStyles = [
  pageStyles,
  css`
    header {
      display: grid;
      gap: var(--sp-2);
    }

    .back {
      justify-self: start;
      display: inline-flex;
      align-items: center;
      min-height: var(--hit);
      margin-block: calc(var(--sp-3) * -1);
      color: var(--accent);
      font: 600 var(--fs-sm) var(--font-ui);
      text-decoration: none;
    }
  `,
];

function subpage(title: string, body: TemplateResult): TemplateResult {
  return html`
    <header>
      <a class="back" href="#innstillinger"><span aria-hidden="true">‹&nbsp;</span>Innstillinger</a>
      <h1>${title}</h1>
    </header>
    ${body}
  `;
}

export class SettingsPracticePage extends LitElement {
  static override styles = subpageStyles;

  protected override render(): TemplateResult {
    return subpage('Øving', html`<practice-preferences></practice-preferences>`);
  }
}

export class SettingsDisplayPage extends LitElement {
  static override styles = subpageStyles;

  protected override render(): TemplateResult {
    return subpage('Utseende og lyd', html`<display-preferences></display-preferences>`);
  }
}

export class SettingsAboutPage extends LitElement {
  static override styles = subpageStyles;

  protected override render(): TemplateResult {
    return subpage('Om appen', html`<about-section></about-section>`);
  }
}

customElements.define('settings-practice-page', SettingsPracticePage);
customElements.define('settings-display-page', SettingsDisplayPage);
customElements.define('settings-about-page', SettingsAboutPage);

declare global {
  interface HTMLElementTagNameMap {
    'settings-practice-page': SettingsPracticePage;
    'settings-display-page': SettingsDisplayPage;
    'settings-about-page': SettingsAboutPage;
  }
}
