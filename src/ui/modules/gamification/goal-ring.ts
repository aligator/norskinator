/** Daily-goal ring: answers today against the goal. */
import { LitElement, css, html, type TemplateResult } from 'lit';

import { checkIcon } from '../../components/icons.ts';
import '../../components/progress-ring.ts';

/**
 * Last ratio drawn in this page session, so the ring animates from where the
 * learner last saw it instead of from zero on every mount.
 */
let lastSeenRatio: number | null = null;

export class GoalRing extends LitElement {
  static override properties = {
    value: { type: Number },
    goal: { type: Number },
    compact: { type: Boolean, reflect: true },
  };

  static override styles = css`
    :host {
      display: inline-block;
    }

    ui-progress-ring {
      width: 112px;
      height: 112px;
    }

    :host([compact]) ui-progress-ring {
      width: 48px;
      height: 48px;
    }

    .value {
      font: 700 var(--fs-hero) / 1 var(--font-num);
    }

    .caption {
      font-size: var(--fs-sm);
      color: var(--fg-muted);
    }

    .done {
      color: var(--correct);
    }

    :host([compact]) .content {
      display: none;
    }
  `;

  declare value: number;
  declare goal: number;
  declare compact: boolean;

  constructor() {
    super();
    this.value = 0;
    this.goal = 1;
    this.compact = false;
  }

  protected override updated(): void {
    if (!this.compact) {
      lastSeenRatio = Math.min(1, this.value / Math.max(this.goal, 1));
    }
  }

  protected override render(): TemplateResult {
    const ratio = Math.min(1, this.value / Math.max(this.goal, 1));
    const reached = this.value >= this.goal;
    const from = this.compact ? 0 : (lastSeenRatio ?? ratio);

    return html`
      <ui-progress-ring
        .value=${ratio}
        .from=${from}
        tone=${reached ? 'success' : 'accent'}
        label=${reached ? `Dagsmål nådd: ${this.value} av ${this.goal} oppgaver i dag` : `${this.value} av ${this.goal} oppgaver i dag`}
      >
        <span class="content">
          ${reached
            ? html`<span class="done">${checkIcon(44)}</span>`
            : html`<span class="value">${this.value}</span><br /><span class="caption">/ ${this.goal} i dag</span>`}
        </span>
      </ui-progress-ring>
    `;
  }
}

customElements.define('goal-ring', GoalRing);

declare global {
  interface HTMLElementTagNameMap {
    'goal-ring': GoalRing;
  }
}
