/**
 * Norwegian text-to-speech via the Web Speech API.
 *
 * Voices come from the operating system, so many devices have no Norwegian
 * voice at all; every entry point quietly does nothing then. Browsers also
 * refuse to speak without a prior user gesture, so call `speak` from a click
 * or key handler.
 */
import { pickNorwegianVoice } from './voice-choice.ts';
import { createVoiceWaiter } from './voice-waiter.ts';

const FALLBACK_LANG = 'nb-NO';

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

/** Chrome returns an empty list until voices have loaded; call `warmUpVoices` early and subscribe with `onVoicesReady`. */
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

/**
 * Chrome only starts loading voices when `getVoices` is first called, and then
 * takes a moment. Calling this at app start has them ready by the first sentence.
 */
export function warmUpVoices(): void {
  synthesis()?.getVoices();
}

const voiceWaiter = createVoiceWaiter<SpeechSynthesisVoice>({ find: findNorwegianVoice, subscribe: onVoicesReady });

function say(speech: SpeechSynthesis, voice: SpeechSynthesisVoice, text: string, rate: number): void {
  const utterance = new SpeechSynthesisUtterance(text);

  utterance.voice = voice;
  utterance.lang = voice.lang.replaceAll('_', '-') || FALLBACK_LANG;
  utterance.rate = rate;

  speech.cancel();

  // Chrome can get stuck paused after a long idle period and then queues silently.
  if (speech.paused) {
    speech.resume();
  }

  speech.speak(utterance);
}

/**
 * Reads `text` aloud. `rate` 1 is the voice's normal pace. When the browser
 * has not loaded its voices yet, the sentence is read as soon as they arrive;
 * a newer `speak` or `stopSpeaking` replaces it.
 */
export function speak(text: string, rate: number): void {
  const speech = synthesis();
  const trimmed = text.trim();

  if (speech === null || trimmed === '') {
    return;
  }

  voiceWaiter.whenReady((voice) => {
    say(speech, voice, trimmed, rate);
  });
}

export function stopSpeaking(): void {
  voiceWaiter.cancel();
  synthesis()?.cancel();
}
