/**
 * Menu row to the Impressum page, the way apps with a tab bar place it under
 * settings: clearly labelled and two taps away (tab, then this row).
 * Renders nothing while no Impressum is configured.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { sharedStyles } from '../../components/styles/shared.ts';
import { LegalController } from './legal-contact.ts';

export class LegalLink extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      :host([hidden]) {
        display: none;
      }

      a {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-3);
        min-height: var(--hit);
        padding: var(--sp-3) var(--sp-4);
        border: 1.5px solid var(--border);
        border-radius: var(--r-lg);
        background: var(--surface);
        color: var(--fg);
        font-weight: 600;
        text-decoration: none;
      }

      @media (hover: hover) {
        a:hover {
          border-color: var(--accent);
        }
      }

      .chevron {
        color: var(--fg-muted);
        font-size: var(--fs-lg);
      }
    `,
  ];

  readonly #legal = new LegalController(this);

  protected override updated(): void {
    this.toggleAttribute('hidden', this.#legal.contact === null);
  }

  protected override render(): TemplateResult | typeof nothing {
    if (this.#legal.contact === null) {
      return nothing;
    }

    return html`<a href="#impressum">Impressum og personvern <span class="chevron" aria-hidden="true">›</span></a>`;
  }
}

customElements.define('legal-link', LegalLink);

declare global {
  interface HTMLElementTagNameMap {
    'legal-link': LegalLink;
  }
}
