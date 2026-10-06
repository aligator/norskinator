/** Screen-reader announcements, delivered to the single live region in `<app-root>`. */

export const ANNOUNCE_EVENT = 'norskinator-announce';

export function announce(source: EventTarget, text: string): void {
  source.dispatchEvent(new CustomEvent<string>(ANNOUNCE_EVENT, { detail: text, bubbles: true, composed: true }));
}
