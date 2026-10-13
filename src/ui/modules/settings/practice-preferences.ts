/** What and how much to practise: translation hint, task mix, session size, garden pace and daily goal. */
import { LitElement, html, nothing, type TemplateResult } from 'lit';

import { DAILY_GOAL_BOUNDS } from '../../../core/gamification.ts';
import {
  PACE_BOUNDS,
  YOUNG_DAY_OPTIONS,
  type Settings,
  type TranslationLanguage,
  type YoungDays,
} from '../../../core/storage.ts';
import { kindsOf, rebalance } from '../../../core/task-weights.ts';
import { TASK_TYPES } from '../../../core/tasks.ts';
import { DATA_KINDS, EXERCISE_KINDS, type DataKind, type ExerciseKind } from '../../../core/types.ts';
import type { SegmentOption } from '../../components/segmented-control.ts';
import type { Share } from '../../components/share-sliders.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { announce } from '../shared/announce.ts';
import { StoreController, store } from '../shared/store.ts';
import { preferenceStyles, saveSettings, stringDetail } from './preference-helpers.ts';

import '../../components/segmented-control.ts';
import '../../components/share-sliders.ts';
import '../../components/stepper.ts';

const TRANSLATIONS: readonly SegmentOption[] = [
  { value: 'de', label: 'Tysk' },
  { value: 'en', label: 'Engelsk' },
  { value: 'none', label: 'Av' },
];

const DATA_KIND_LABELS: Readonly<Record<DataKind, string>> = {
  cloze: 'Luke-oppgaver',
  sentence: 'Setningsoppgaver',
};

/** A task type alone in its data kind always gets 100 %, so it has nothing to adjust. */
const ADJUSTABLE_DATA_KINDS = DATA_KINDS.filter((dataKind) => kindsOf(dataKind).length >= 2);

const DAILY_GOALS: readonly SegmentOption[] = [10, 20, 30, 50]
  .filter((goal) => goal >= DAILY_GOAL_BOUNDS.min && goal <= DAILY_GOAL_BOUNDS.max)
  .map((goal) => ({ value: String(goal), label: String(goal) }));

/** The stepper stops below the stored maximum; more new items per session get tiring on a phone. */
const NEW_MAX_IN_UI = Math.min(30, PACE_BOUNDS.newPerSession.max);
const STEP = 5;

const YOUNG_DAYS: readonly SegmentOption[] = YOUNG_DAY_OPTIONS.map((days) => ({
  value: String(days),
  label: `${days} dager`,
}));

function isYoungDays(value: number): value is YoungDays {
  return YOUNG_DAY_OPTIONS.some((option) => option === value);
}

function isTranslationLanguage(value: string): value is TranslationLanguage {
  return TRANSLATIONS.some((option) => option.value === value);
}

function isExerciseKind(value: string): value is ExerciseKind {
  return EXERCISE_KINDS.some((kind) => kind === value);
}

function shareMove(event: Event): { readonly kind: ExerciseKind; readonly value: number } | null {
  if (!(event instanceof CustomEvent)) {
    return null;
  }

  const move: unknown = event.detail;

  if (typeof move !== 'object' || move === null) {
    return null;
  }

  const id: unknown = Reflect.get(move, 'id');
  const value: unknown = Reflect.get(move, 'value');

  if (typeof id !== 'string' || typeof value !== 'number' || !isExerciseKind(id)) {
    return null;
  }

  return { kind: id, value };
}

export class PracticePreferences extends LitElement {
  static override styles = [sharedStyles, preferenceStyles];

  protected readonly storeController = new StoreController(this);

  protected override render(): TemplateResult {
    const settings = store.state.settings;

    return html`
      ${this.#renderTaskShares(settings)}

      <ui-segmented
        label="Oversettelse"
        .options=${TRANSLATIONS}
        .value=${settings.translationLanguage}
        @change=${this.#onTranslation}
      ></ui-segmented>

      <section>
        <h2 class="eyebrow">Økt</h2>
        <ui-stepper
          label="Oppgaver per økt"
          .value=${settings.sessionSize}
          .min=${PACE_BOUNDS.sessionSize.min}
          .max=${PACE_BOUNDS.sessionSize.max}
          .step=${STEP}
          @change=${(event: Event) => this.#onNumber(event, 'sessionSize')}
        ></ui-stepper>
        <ui-stepper
          label="Nye oppgaver per økt"
          .value=${settings.newPerSession}
          .min=${PACE_BOUNDS.newPerSession.min}
          .max=${NEW_MAX_IN_UI}
          .step=${STEP}
          @change=${(event: Event) => this.#onNumber(event, 'newPerSession')}
        ></ui-stepper>
      </section>

      <section>
        <h2 class="eyebrow">Hagen</h2>
        <ui-stepper
          label="Maks unge planter"
          .value=${settings.maxYoungPlants}
          .min=${PACE_BOUNDS.maxYoungPlants.min}
          .max=${PACE_BOUNDS.maxYoungPlants.max}
          .step=${STEP}
          @change=${(event: Event) => this.#onNumber(event, 'maxYoungPlants')}
        ></ui-stepper>
        <ui-segmented
          label="En plante er ung i"
          .options=${YOUNG_DAYS}
          .value=${String(settings.youngIntervalDays)}
          @change=${this.#onYoungDays}
        ></ui-segmented>
        <p class="hint">
          Nye oppgaver kommer bare når færre enn ${settings.maxYoungPlants} planter er yngre enn
          ${settings.youngIntervalDays} dager. Høyere tall gir flere nye oppgaver, men også flere repetisjoner.
        </p>
      </section>

      <ui-segmented
        label="Dagsmål"
        .options=${DAILY_GOALS}
        .value=${String(store.state.progress.dailyGoal)}
        @change=${this.#onGoal}
      ></ui-segmented>
    `;
  }

  #renderTaskShares(settings: Settings): TemplateResult | typeof nothing {
    if (ADJUSTABLE_DATA_KINDS.length === 0) {
      return nothing;
    }

    return html`
      <section>
        ${ADJUSTABLE_DATA_KINDS.map(
          (dataKind) => html`<ui-share-sliders
            label=${DATA_KIND_LABELS[dataKind]}
            .shares=${this.#taskShares(settings, dataKind)}
            @share-input=${this.#onTaskShare}
            @share-change=${this.#onTaskShareDone}
          ></ui-share-sliders>`,
        )}
        <p class="hint">Til sammen alltid 100 %. Flytter du én, justeres de andre.</p>
      </section>
    `;
  }

  #taskShares(settings: Settings, dataKind: DataKind): Share[] {
    return kindsOf(dataKind).map((kind) => ({
      id: kind,
      label: TASK_TYPES[kind].label,
      value: settings.taskWeights[kind],
    }));
  }

  /** Saves silently while dragging; the release announces it once. */
  #onTaskShare = (event: Event): void => {
    const move = shareMove(event);

    if (move !== null) {
      store.updateSettings({ taskWeights: rebalance(store.state.settings.taskWeights, move.kind, move.value) });
    }
  };

  #onTaskShareDone = (event: Event): void => {
    this.#onTaskShare(event);
    announce(this, 'Lagret');
  };

  #onTranslation = (event: Event): void => {
    const value = stringDetail(event);

    if (value !== null && isTranslationLanguage(value)) {
      saveSettings(this, { translationLanguage: value });
    }
  };

  #onNumber(event: Event, key: 'sessionSize' | 'newPerSession' | 'maxYoungPlants'): void {
    if (event instanceof CustomEvent && typeof event.detail === 'number') {
      saveSettings(this, { [key]: event.detail });
    }
  }

  #onYoungDays = (event: Event): void => {
    const days = Number(stringDetail(event));

    if (isYoungDays(days)) {
      saveSettings(this, { youngIntervalDays: days });
    }
  };

  #onGoal = (event: Event): void => {
    const value = stringDetail(event);

    if (value === null) {
      return;
    }

    store.setDailyGoal(Number(value));
    announce(this, 'Lagret');
  };
}

customElements.define('practice-preferences', PracticePreferences);

declare global {
  interface HTMLElementTagNameMap {
    'practice-preferences': PracticePreferences;
  }
}
