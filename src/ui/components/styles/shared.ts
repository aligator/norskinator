/** Styles shared by several shadow roots: buttons, typography helpers, focus ring. */
import { css } from 'lit';

export const sharedStyles = css`
  :host {
    font-family: var(--font-ui);
    color: var(--fg);
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  :focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }

  [tabindex='-1']:focus {
    outline: none;
  }

  .tabular {
    font-variant-numeric: tabular-nums;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  a {
    color: var(--accent);
    text-underline-offset: 0.15em;
  }

  .eyebrow {
    font-size: var(--fs-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--fg-muted);
  }

  .section-title {
    margin-bottom: var(--sp-3);
    font-size: var(--fs-lg);
    font-weight: 700;
  }

  .num {
    font-family: var(--font-num);
    font-variant-numeric: tabular-nums;
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    min-height: 56px;
    padding: 0 var(--sp-6);
    border: 1.5px solid transparent;
    border-radius: var(--r-lg);
    font: 700 var(--fs-lg) / var(--lh-tight) var(--font-ui);
    cursor: pointer;
    transition:
      background-color var(--dur-fast) var(--ease-out),
      transform var(--dur-instant) var(--ease-out);
  }

  .button:active {
    transform: scale(0.98);
  }

  .button.primary {
    background: var(--accent);
    color: var(--accent-fg);
  }

  .button.primary:focus-visible {
    outline-offset: 3px;
  }

  .button.secondary {
    background: transparent;
    color: var(--accent);
    border-color: var(--accent);
  }

  .button.danger {
    background: transparent;
    color: var(--wrong);
    border-color: var(--wrong);
  }

  .button.danger-filled {
    background: var(--wrong);
    color: var(--surface);
  }

  .button.block {
    width: 100%;
  }

  @media (hover: hover) {
    .button.primary:hover {
      background: var(--accent-hover);
    }

    .button.secondary:hover {
      background: var(--accent-soft);
    }
  }

  .icon-button {
    display: inline-grid;
    place-items: center;
    width: var(--hit);
    height: var(--hit);
    padding: 0;
    border: 0;
    border-radius: var(--r-pill);
    background: transparent;
    color: var(--fg-muted);
    cursor: pointer;
  }

  .text-button {
    min-height: var(--hit);
    padding: 0 var(--sp-2);
    border: 0;
    background: none;
    color: var(--accent);
    font: 600 var(--fs-sm) var(--font-ui);
    cursor: pointer;
  }

  kbd {
    display: inline-grid;
    place-items: center;
    min-width: 24px;
    height: 24px;
    padding: 0 var(--sp-1);
    border-radius: var(--r-sm);
    background: var(--surface-2);
    color: var(--fg-muted);
    font: 500 var(--fs-xs) var(--font-num);
  }

  @media not ((hover: hover) and (pointer: fine)) {
    kbd {
      display: none;
    }
  }
`;
