import { describe, expect, it } from 'vitest';

import { normaliseLang, pickNorwegianVoice } from './voice-choice.ts';

function voices(...langs: string[]): { lang: string; name: string }[] {
  return langs.map((lang, index) => ({ lang, name: `voice-${index}` }));
}

describe('pickNorwegianVoice', () => {
  it('prefers nb-NO over generic Norwegian and nynorsk', () => {
    const picked = pickNorwegianVoice(voices('en-US', 'nn-NO', 'no-NO', 'nb-NO'));

    expect(picked?.lang).toBe('nb-NO');
  });

  it('accepts generic Norwegian tags when no nb-NO voice exists', () => {
    expect(pickNorwegianVoice(voices('nn-NO', 'no-NO'))?.lang).toBe('no-NO');
    expect(pickNorwegianVoice(voices('de-DE', 'nb'))?.lang).toBe('nb');
    expect(pickNorwegianVoice(voices('no'))?.lang).toBe('no');
  });

  it('falls back to nynorsk only as a last resort', () => {
    expect(pickNorwegianVoice(voices('sv-SE', 'nn-NO'))?.lang).toBe('nn-NO');
  });

  it('understands underscore and mixed-case tags', () => {
    expect(pickNorwegianVoice(voices('nn-NO', 'NB_no'))?.lang).toBe('NB_no');
  });

  it('keeps the browser order among equally good voices', () => {
    expect(pickNorwegianVoice(voices('nb-NO', 'nb-NO'))?.name).toBe('voice-0');
  });

  it('returns null without a Norwegian voice', () => {
    expect(pickNorwegianVoice(voices('sv-SE', 'da-DK', 'en-GB'))).toBeNull();
    expect(pickNorwegianVoice([])).toBeNull();
  });
});

describe('normaliseLang', () => {
  it('turns platform variants into a lowercase BCP 47 form', () => {
    expect(normaliseLang(' nb_NO ')).toBe('nb-no');
  });
});
