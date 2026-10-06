/** On/off switch with a 48px hit target. */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { sharedStyles } from './styles/shared.ts';

export class ToggleSwitch extends LitElement {
  static override properties = {
    checked: { type: Boolean },
    label: { type: String },
  };

  static override styles = [
    sharedStyles,
    css`
      label {
        display: grid;
        place-items: center;
        width: var(--hit);
        height: var(--hit);
        cursor: pointer;
      }

      input {
        appearance: none;
        position: relative;
        width: 40px;
        height: 24px;
        margin: 0;
        border-radius: var(--r-pill);
        background: var(--border-strong);
        cursor: pointer;
        transition: background-color var(--dur-fast) var(--ease-out);
      }

      input::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--surface);
        transition: transform var(--dur-fast) var(--ease-out);
      }

      input:checked {
        background: var(--accent);
      }

      input:checked::after {
        transform: translateX(16px);
      }

      input:focus-visible {
        outline: 3px solid var(--focus);
        outline-offset: 2px;
      }

      @media (prefers-reduced-motion: reduce) {
        input,
        input::after {
          transition: none;
        }
      }

    `,
  ];

  declare checked: boolean;
  declare label: string;

  constructor() {
    super();
    this.checked = false;
    this.label = '';
  }

  protected override render(): TemplateResult {
    return html`
      <label>
        <span class="sr-only">${this.label}</span>
        <input type="checkbox" role="switch" .checked=${this.checked} @change=${this.#toggle} />
      </label>
    `;
  }

  #toggle = (event: Event): void => {
    if (!(event.currentTarget instanceof HTMLInputElement)) {
      return;
    }

    this.checked = event.currentTarget.checked;
    this.dispatchEvent(new CustomEvent<boolean>('change', { detail: this.checked, bubbles: true, composed: true }));
  };
}

customElements.define('ui-switch', ToggleSwitch);

declare global {
  interface HTMLElementTagNameMap {
    'ui-switch': ToggleSwitch;
  }
}
