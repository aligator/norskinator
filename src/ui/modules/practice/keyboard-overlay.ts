/**
 * Lets the on-screen keyboard slide over the page instead of resizing it.
 * `interactive-widget=resizes-content` shrinks the page in one jump once the
 * keyboard is open; with the keyboard as an overlay, the page reserves
 * `env(keyboard-inset-height)` itself and can animate towards it.
 *
 * Chromium only (VirtualKeyboard API); elsewhere this does nothing and the
 * viewport meta tag applies.
 */

/** The part of the VirtualKeyboard API used here; not in TypeScript's DOM types. */
interface VirtualKeyboard {
  overlaysContent: boolean;
}

declare global {
  interface Navigator {
    readonly virtualKeyboard?: VirtualKeyboard;
  }
}

/** Switches the overlay on; the returned function restores resizing. */
export function overlayKeyboard(): () => void {
  const keyboard = navigator.virtualKeyboard;

  if (keyboard === undefined) {
    return () => {};
  }

  keyboard.overlaysContent = true;

  return () => {
    keyboard.overlaysContent = false;
  };
}
