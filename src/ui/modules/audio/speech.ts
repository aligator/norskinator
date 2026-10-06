/**
 * Norwegian text-to-speech via the Web Speech API.
 *
 * Voices come from the operating system, so many devices have no Norwegian
 * voice at all; every entry point quietly does nothing then. Browsers also
 * refuse to speak without a prior user gesture, so call `speak` from a click
 * or key handler.
 */
import { pickNorwegianVoice } from './voice-choice.ts';

const FALLBACK_LANG = 'nb-NO';
const DEFAULT_RATE = 0.95;

export interface SpeakOptions {
  /** 1 is the voice's normal pace; learners follow slightly slower speech more easily. */
  readonly rate?: number;
}

/** Missing in tests, during prerendering and in some embedded webviews. */
function synthesis(): SpeechSynthesis | null {
  if (typeof globalThis.speechSynthesis === 'undefined' || typeof globalThis.SpeechSynthesisUtterance === 'undefined') {
    return null;
  }

  return globalThis.speechSynthesis;
}

export function speechSupported(): boolean {
  return synthesis() !== null;
}

/** Chrome returns an empty list until voices have loaded; subscribe with `onVoicesReady`. */
export function findNorwegianVoice(): SpeechSynthesisVoice | null {
  const speech = synthesis();

  if (speech === null) {
    return null;
  }

  return pickNorwegianVoice(speech.getVoices());
}

/**
 * Calls `callback` whenever the browser's voice list changes. It does not fire
 * for voices that are already loaded, so check `findNorwegianVoice` right away too.
 */
export function onVoicesReady(callback: () => void): () => void {
  const speech = synthesis();

  // Older Safari has neither the event nor `addEventListener`, but loads voices synchronously.
  if (speech === null || typeof speech.addEventListener !== 'function') {
    return () => {};
  }

  speech.addEventListener('voiceschanged', callback);

  // Chrome only starts loading voices once someone asks for them.
  speech.getVoices();

  return () => {
    speech.removeEventListener('voiceschanged', callback);
  };
}

export function speak(text: string, options: SpeakOptions = {}): void {
  const speech = synthesis();
  const trimmed = text.trim();

  if (speech === null || trimmed === '') {
    return;
  }

  const voice = pickNorwegianVoice(speech.getVoices());

  if (voice === null) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(trimmed);

  utterance.voice = voice;
  utterance.lang = voice.lang.replaceAll('_', '-') || FALLBACK_LANG;
  utterance.rate = options.rate ?? DEFAULT_RATE;

  speech.cancel();

  // Chrome can get stuck paused after a long idle period and then queues silently.
  if (speech.paused) {
    speech.resume();
  }

  speech.speak(utterance);
}

export function stopSpeaking(): void {
  synthesis()?.cancel();
}
