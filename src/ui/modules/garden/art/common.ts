/** Drawings several species share. */
import { svg } from 'lit';

/** Leafy young stem most broad-leaved species share. */
export const LEAFY_PLANT = svg`
  <path class="stem" d="M32 58c-1-8 1-16 0-28" />
  <path class="leaf" d="M32 50c-3-4-9-5-12-2 3 4 8 5 12 2z" />
  <path class="leaf-light" d="M32 43c3-4 9-5 12-2-3 4-8 5-12 2z" />
  <path class="leaf" d="M32 36c-3-4-8-4-10-1 3 3 7 4 10 1z" />
  <path class="leaf-light" d="M32 31c-2-4 0-7 0-7s2 3 0 7z" />
`;

export const ROUND_BUSH = svg`
  <path class="trunk" d="M30.6 58 31 48h2l.4 10z" />
  <circle class="leaf-dark" cx="23" cy="45" r="9" />
  <circle class="leaf-dark" cx="41" cy="45" r="9" />
  <circle class="leaf" cx="32" cy="39" r="11" />
  <circle class="leaf-light" cx="26" cy="35" r="5.5" />
  <circle class="leaf-light" cx="38.5" cy="34" r="4.5" />
`;
