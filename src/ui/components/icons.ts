/** Inline SVG icons for UI chrome. Emoji are reserved for content (decks, badges). */
import { svg, type SVGTemplateResult } from 'lit';

function icon(body: SVGTemplateResult, size = 24): SVGTemplateResult {
  return svg`<svg
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >${body}</svg>`;
}

export const homeIcon = (): SVGTemplateResult =>
  icon(svg`<path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" />`);

export const statsIcon = (): SVGTemplateResult =>
  icon(svg`<path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" />`);

export const settingsIcon = (): SVGTemplateResult =>
  icon(svg`<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />`);

export const speakerIcon = (size = 20): SVGTemplateResult =>
  icon(svg`<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.5a7.5 7.5 0 0 1 0 11" />`, size);

export const closeIcon = (): SVGTemplateResult => icon(svg`<path d="M6 6l12 12" /><path d="M18 6 6 18" />`);

export const checkIcon = (size = 20): SVGTemplateResult => icon(svg`<path d="M5 12.5 10 17.5 19 7" />`, size);

export const crossIcon = (size = 20): SVGTemplateResult => icon(svg`<path d="M7 7l10 10" /><path d="M17 7 7 17" />`, size);

export const lockIcon = (size = 16): SVGTemplateResult =>
  icon(svg`<rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />`, size);

export const flameIcon = (size = 18): SVGTemplateResult =>
  icon(
    svg`<path d="M12 3c.5 3.5 4.5 5.5 4.5 10a4.5 4.5 0 0 1-9 0c0-2.2 1-3.6 2.2-4.8.3 1.6 1 2.6 2 3 .1-3.2-.5-5.6.3-8.2Z" />`,
    size,
  );

export const creditIcon = (size = 18): SVGTemplateResult =>
  icon(svg`<circle cx="12" cy="12" r="9" /><path d="M14.8 9.6a3.4 3.4 0 1 0 0 4.8" />`, size);
