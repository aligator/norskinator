/** Full-width link row with a chevron, for menus that lead to a sub-page. */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { sharedStyles } from './styles/shared.ts';

export class NavRow extends LitElement {
  static override properties = {
    href: { type: String },
    label: { type: String },
    hint: { type: String },
  };

  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      a {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        min-height: var(--hit);
        padding: var(--sp-3) var(--sp-4);
        border: 1.5px solid var(--border);
        border-radius: var(--r-lg);
        background: var(--surface);
        color: var(--fg);
        text-decoration: none;
      }

      @media (hover: hover) {
        a:hover {
          border-color: var(--accent);
        }
      }

      .text {
        display: grid;
        flex: 1;
        gap: var(--sp-1);
      }

      .label {
        font-weight: 600;
      }

      .hint {
        font-size: var(--fs-sm);
        color: var(--fg-muted);
      }

      .chevron {
        color: var(--fg-muted);
        font-size: var(--fs-lg);
      }
    `,
  ];

  declare href: string;
  declare label: string;
  declare hint: string;

  constructor() {
    super();
    this.href = '';
    this.label = '';
    this.hint = '';
  }

  protected override render(): TemplateResult {
    return html`
      <a href=${this.href}>
        <span class="text">
          <span class="label">${this.label}</span>
          ${this.hint === '' ? nothing : html`<span class="hint">${this.hint}</span>`}
        </span>
        <span class="chevron" aria-hidden="true">›</span>
      </a>
    `;
  }
}

customElements.define('ui-nav-row', NavRow);

declare global {
  interface HTMLElementTagNameMap {
    'ui-nav-row': NavRow;
  }
}
