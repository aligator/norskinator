/** Styles shared by the exercise card and the feedback sheet. */
import { css } from 'lit';

export const translationStyles = css`
  .translation {
    font-style: italic;
    color: var(--fg-muted);
  }

  .lang-tag {
    margin-right: var(--sp-2);
    font: 600 var(--fs-xs) var(--font-ui);
    font-style: normal;
    letter-spacing: var(--tracking-label);
  }
`;
