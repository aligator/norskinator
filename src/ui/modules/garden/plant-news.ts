/** What one answer did to an item's plant, in a few words. */
import { PLANT_STAGE_LABELS, plantChange, type Plant } from '../../../core/garden.ts';

export function plantNews(before: Plant, after: Plant): string {
  switch (plantChange(before, after)) {
    case 'sown': {
      return 'Et nytt frø spirer!';
    }

    case 'grown': {
      return `Vokste til ${PLANT_STAGE_LABELS[after.stage].toLocaleLowerCase('nb-NO')}!`;
    }

    case 'wilted': {
      return before.stage === 'seed' ? 'Frøet trenger litt mer stell' : 'Planten visnet';
    }

    case 'recovered': {
      return 'Planten kommer seg igjen';
    }

    case 'unchanged': {
      return after.wilted ? 'Planten er fortsatt vissen' : `${PLANT_STAGE_LABELS[after.stage]} – vokser videre`;
    }
  }
}
