/** What and how much to practise: translation hint, task mix, session size and daily goal. */
import { LitElement, html, nothing, type TemplateResult } from 'lit';

import { DAILY_GOAL_BOUNDS } from '../../../core/gamification.ts';
import { NEW_PER_SESSION_BOUNDS, type Settings, type TranslationLanguage } from '../../../core/storage.ts';
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

/** The stepper stops below the stored maximum; bigger sessions get tiring on a phone. */
const NEW_MAX_IN_UI = Math.min(30, NEW_PER_SESSION_BOUNDS.max);
const NEW_STEP = 5;

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
          label="Nye oppgaver per økt"
          .value=${settings.newPerSession}
          .min=${NEW_PER_SESSION_BOUNDS.min}
          .max=${NEW_MAX_IN_UI}
          .step=${NEW_STEP}
          @change=${this.#onNewPerSession}
        ></ui-stepper>
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

  #onNewPerSession = (event: Event): void => {
    if (event instanceof CustomEvent && typeof event.detail === 'number') {
      saveSettings(this, { newPerSession: event.detail });
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
