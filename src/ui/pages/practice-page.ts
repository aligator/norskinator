import { LitElement, css, html, type TemplateResult } from 'lit';

import { navigate } from './router.ts';

import '../modules/practice/practice-session.ts';

/** Immersive: no page padding or title, the session owns the whole screen. */
export class PracticePage extends LitElement {
  static override styles = css`
    :host {
      display: block;
      max-width: var(--w-practice);
      margin: 0 auto;
    }

    /* With a mouse there is no thumb zone; keep question and answers close together. */
    @media (min-width: 900px) and (pointer: fine) {
      :host {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-height: 100dvh;
      }

      practice-session {
        min-height: min(100dvh, 44rem);
      }
    }
  `;

  protected override render(): TemplateResult {
    return html`<practice-session @exit=${() => navigate('hjem')}></practice-session>`;
  }
}

customElements.define('practice-page', PracticePage);

declare global {
  interface HTMLElementTagNameMap {
    'practice-page': PracticePage;
  }
}
