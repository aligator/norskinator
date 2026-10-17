/** What one answer did to an item's plant, in a few words. */
import { PLANT_STAGE_LABELS, PlantChange, PlantStage, plantChange, type Plant } from '../../../core/garden.ts';

export function plantNews(before: Plant, after: Plant): string {
  switch (plantChange(before, after)) {
    case PlantChange.Sown: {
      return 'Et nytt frø spirer!';
    }

    case PlantChange.Grown: {
      return `Vokste til ${PLANT_STAGE_LABELS[after.stage].toLocaleLowerCase('nb-NO')}!`;
    }

    case PlantChange.Wilted: {
      return before.stage === PlantStage.Seed ? 'Frøet trenger litt mer stell' : 'Planten visnet';
    }

    case PlantChange.Recovered: {
      return 'Planten kommer seg igjen';
    }

    case PlantChange.Unchanged: {
      return after.wilted ? 'Planten er fortsatt vissen' : `${PLANT_STAGE_LABELS[after.stage]} – vokser videre`;
    }
  }
}
