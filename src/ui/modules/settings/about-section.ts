/** Version, licences, attribution and the source link the AGPL asks for. */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { sharedStyles } from '../../components/styles/shared.ts';
import { requestTour } from '../onboarding/tour-state.ts';
import { appVersion } from '../shared/app-version.ts';
import { sourceUrl } from '../shared/source-url.ts';

import '../legal/legal-link.ts';

export class AboutSection extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: var(--sp-2);
        font-size: var(--fs-sm);
        color: var(--fg-muted);
      }
    `,
  ];

  protected override render(): TemplateResult {
    const source = sourceUrl();

    return html`
      <legal-link></legal-link>
      <p class="version">Versjon <strong class="tabular">${appVersion()}</strong></p>
      <p>
        Setninger fra <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a>, lisens
        <a href="https://creativecommons.org/licenses/by/2.0/fr/" target="_blank" rel="noopener">CC BY 2.0 FR</a>.
        Forfatteren av hver setning står bak ©-knappen på oppgaven. Skrifter: Literata og Atkinson Hyperlegible (SIL OFL 1.1). Lit (BSD-3-Clause).
      </p>
      <p>
        Fri programvare under
        <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener">AGPL-3.0-or-later</a>.
        ${source === null ? nothing : html`<a href=${source} target="_blank" rel="noopener">Kildekode</a>`}
      </p>
      <p>Oppgaver og forklaringer er delvis laget med KI og kan inneholde feil.</p>
      <button class="button secondary block" @click=${() => requestTour(this)}>Vis introduksjonen igjen</button>
    `;
  }
}

customElements.define('about-section', AboutSection);

declare global {
  interface HTMLElementTagNameMap {
    'about-section': AboutSection;
  }
}
