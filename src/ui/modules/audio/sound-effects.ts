/**
 * Short synthesised feedback sounds (Web Audio), so the app ships no audio files.
 *
 * Every note gets a fast linear attack and an exponential release: starting or
 * stopping an oscillator at full volume is what makes the audible click.
 */

export type SoundKind = 'correct' | 'wrong' | 'level-up' | 'goal';

interface Note {
  readonly frequency: number;
  /** Seconds after the sound starts. */
  readonly offset: number;
  readonly duration: number;
  readonly wave: OscillatorType;
}

interface Sound {
  readonly peakGain: number;
  readonly notes: readonly Note[];
}

const ATTACK_SECONDS = 0.012;
/** Exponential ramps cannot reach zero; this is inaudible. */
const SILENT_GAIN = 0.0001;
/** Scheduling slightly ahead keeps the first attack from being cut off. */
const START_DELAY_SECONDS = 0.01;
/** Keeps the oscillator alive until the release ramp has fully faded out. */
const STOP_TAIL_SECONDS = 0.02;

const SOUNDS: Readonly<Record<SoundKind, Sound>> = {
  // E5 → A5, a light upward "ding-ding".
  correct: {
    peakGain: 0.15,
    notes: [
      { frequency: 659.25, offset: 0, duration: 0.09, wave: 'sine' },
      { frequency: 880, offset: 0.075, duration: 0.11, wave: 'sine' },
    ],
  },
  // A3, quiet and rounded: a nudge, not a buzzer.
  wrong: {
    peakGain: 0.12,
    notes: [{ frequency: 220, offset: 0, duration: 0.2, wave: 'triangle' }],
  },
  // C major arpeggio up to the octave.
  'level-up': {
    peakGain: 0.13,
    notes: [
      { frequency: 523.25, offset: 0, duration: 0.12, wave: 'triangle' },
      { frequency: 659.25, offset: 0.09, duration: 0.12, wave: 'triangle' },
      { frequency: 783.99, offset: 0.18, duration: 0.12, wave: 'triangle' },
      { frequency: 1046.5, offset: 0.27, duration: 0.23, wave: 'triangle' },
    ],
  },
  // G major, softer sine timbre so it is distinguishable from a level-up.
  goal: {
    peakGain: 0.14,
    notes: [
      { frequency: 392, offset: 0, duration: 0.14, wave: 'sine' },
      { frequency: 493.88, offset: 0.11, duration: 0.14, wave: 'sine' },
      { frequency: 587.33, offset: 0.22, duration: 0.14, wave: 'sine' },
      { frequency: 783.99, offset: 0.33, duration: 0.2, wave: 'sine' },
    ],
  },
};

let sharedContext: AudioContext | null = null;
let audioUnavailable = false;

function audioContext(): AudioContext | null {
  if (sharedContext !== null || audioUnavailable) {
    return sharedContext;
  }

  if (typeof globalThis.AudioContext === 'undefined') {
    audioUnavailable = true;
    return null;
  }

  try {
    sharedContext = new AudioContext();
  } catch {
    audioUnavailable = true;
  }

  return sharedContext;
}

function scheduleNote(context: AudioContext, note: Note, startTime: number, peakGain: number): void {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const noteStart = startTime + note.offset;
  const noteEnd = noteStart + note.duration;

  oscillator.type = note.wave;
  oscillator.frequency.setValueAtTime(note.frequency, noteStart);

  envelope.gain.setValueAtTime(SILENT_GAIN, noteStart);
  envelope.gain.linearRampToValueAtTime(peakGain, noteStart + ATTACK_SECONDS);
  envelope.gain.exponentialRampToValueAtTime(SILENT_GAIN, noteEnd);

  oscillator.connect(envelope);
  envelope.connect(context.destination);

  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    envelope.disconnect();
  });

  oscillator.start(noteStart);
  oscillator.stop(noteEnd + STOP_TAIL_SECONDS);
}

/** Plays a feedback sound; silently does nothing where Web Audio is unavailable. */
export function playSound(kind: SoundKind): void {
  const context = audioContext();

  if (context === null) {
    return;
  }

  // Safari starts suspended (and "interrupted" after calls); resuming needs a user gesture.
  if (context.state !== 'running') {
    context.resume().catch(() => {});
  }

  const sound = SOUNDS[kind];
  const startTime = context.currentTime + START_DELAY_SECONDS;

  try {
    for (const note of sound.notes) {
      scheduleNote(context, note, startTime, sound.peakGain);
    }
  } catch {
    // A closed or broken context must never break answering a question.
  }
}
