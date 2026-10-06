/** Round badge showing the learner's level. */
import { LitElement, css, html, type TemplateResult } from 'lit';

export class LevelBadge extends LitElement {
  static override properties = {
    level: { type: Number },
    large: { type: Boolean, reflect: true },
    decorative: { type: Boolean },
  };

  static override styles = css`
    :host {
      display: inline-grid;
      place-items: center;
      width: 40px;
      height: 40px;
      flex: none;
      border: 2px solid var(--gold);
      border-radius: 50%;
      background: var(--gold-bg);
      color: var(--gold);
      font: 700 var(--fs-md) / 1 var(--font-num);
    }

    :host([large]) {
      width: 56px;
      height: 56px;
      font-size: var(--fs-xl);
    }
  `;

  declare level: number;
  declare large: boolean;
  /** Set when the level is already written out next to the badge. */
  declare decorative: boolean;

  constructor() {
    super();
    this.level = 1;
    this.large = false;
    this.decorative = false;
  }

  protected override updated(): void {
    if (this.decorative) {
      this.removeAttribute('role');
      this.removeAttribute('aria-label');
      this.setAttribute('aria-hidden', 'true');

      return;
    }

    this.removeAttribute('aria-hidden');
    this.setAttribute('role', 'img');
    this.setAttribute('aria-label', `Nivå ${this.level}`);
  }

  protected override render(): TemplateResult {
    return html`<span aria-hidden="true">${this.level}</span>`;
  }
}

customElements.define('level-badge', LevelBadge);

declare global {
  interface HTMLElementTagNameMap {
    'level-badge': LevelBadge;
  }
}
