/** Base layout every page shares: centred column, vertical rhythm, page title. */
import { css } from 'lit';

import { sharedStyles } from '../components/styles/shared.ts';

export const pageStyles = [
  sharedStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sp-6);
      max-width: var(--w-practice);
      margin: 0 auto;
      padding-block: var(--sp-6) var(--sp-8);
    }

    :host([wide]) {
      max-width: var(--w-wide);
    }

    h1 {
      font-size: var(--fs-xl);
      font-weight: 700;
      line-height: var(--lh-tight);
    }
  `,
];
