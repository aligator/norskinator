import { expandAuthored, parseAuthored } from '../../core/authored.ts';
import { DataKind, ExerciseKind, type ClozeItem, type Deck } from '../../core/types.ts';

const DECK_ID = 'past-tense';

async function loadAuthored(): Promise<ClozeItem[]> {
  const raw: unknown = (await import('./authored.json')).default;

  return expandAuthored(DECK_ID, parseAuthored(raw)).map((item) => ({
    ...item,
    choiceCount: 2,
    tags: item.tags.slice(1),
    source: {
      name: 'KI-generert for Norskinator',
      id: item.id,
      translations: { de: { machine: true }, en: { machine: true } },
    },
  }));
}

export const pastTenseDeck: Deck = {
  id: DECK_ID,
  title: 'Preteritum eller perfektum?',
  shortTitle: 'Fortid',
  description: 'Velg mellom preteritum og presens perfektum. Bruk tidsuttrykkene og sammenhengen i setningen.',
  icon: '⏳',
  tagLabel: 'Verbform',
  sources: [{ dataKind: DataKind.Cloze, tasks: [ExerciseKind.MultipleChoice], load: loadAuthored }],
};
