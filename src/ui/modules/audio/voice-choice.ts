/** Picks the best Norwegian text-to-speech voice. Pure, so it works on plain objects in tests. */

export interface VoiceLike {
  readonly lang: string;
}

/** Android has reported `nb_NO`, others `nb-NO` or `NB-no`; compare in one canonical form. */
export function normaliseLang(lang: string): string {
  return lang.trim().replaceAll('_', '-').toLowerCase();
}

/** Lower is better; `null` means the voice cannot read bokmål at all. */
function bokmaalRank(lang: string): number | null {
  const normalised = normaliseLang(lang);
  const [language] = normalised.split('-');

  if (normalised === 'nb-no') {
    return 0;
  }

  if (language === 'nb' || language === 'no') {
    return 1;
  }

  // Nynorsk voices pronounce bokmål text acceptably, which beats silence.
  if (language === 'nn') {
    return 2;
  }

  return null;
}

/** The first voice of the best rank, so the browser's own ordering breaks ties. */
export function pickNorwegianVoice<Voice extends VoiceLike>(voices: readonly Voice[]): Voice | null {
  let best: Voice | null = null;
  let bestRank = Number.POSITIVE_INFINITY;

  for (const voice of voices) {
    const rank = bokmaalRank(voice.lang);

    if (rank !== null && rank < bestRank) {
      best = voice;
      bestRank = rank;
    }
  }

  return best;
}
