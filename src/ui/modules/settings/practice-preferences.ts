/** What and how much to practise: translation hint, task mix, session size, garden pace and daily goal. */
import { LitElement, html, nothing, type TemplateResult } from 'lit';

import { DAILY_GOAL_BOUNDS } from '../../../core/gamification.ts';
import { recommendedReviewLimit } from '../../../core/daily.ts';
import { PACE_BOUNDS, type Settings, type TranslationLanguage } from '../../../core/storage.ts';
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
import '../../components/toggle-switch.ts';

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
const NEW_MAX_IN_UI = Math.min(50, PACE_BOUNDS.newPerDay.max);
const STEP = 5;
const REVIEW_STEP = 25;

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
        <h2 class="eyebrow">Vurdering</h2>
        <div class="switch-row">
          <span>Vurder riktige svar selv</span>
          <ui-switch
            label="Vurder riktige svar selv"
            .checked=${settings.manualRating}
            @change=${this.#onManualRating}
          ></ui-switch>
        </div>
        <p class="hint">
          Etter et riktig svar velger du vanskelig, bra eller lett og ser når oppgaven kommer igjen. Av: appen
          vurderer etter hvor raskt du svarer.
        </p>
      </section>

      <section>
        <h2 class="eyebrow">Hver dag</h2>
        <ui-stepper
          label="Nye oppgaver per dag"
          .value=${settings.newPerDay}
          .min=${PACE_BOUNDS.newPerDay.min}
          .max=${NEW_MAX_IN_UI}
          .step=${STEP}
          @change=${(event: Event) => this.#onNumber(event, 'newPerDay')}
        ></ui-stepper>
        <ui-stepper
          label="Repetisjoner per dag"
          .value=${settings.reviewsPerDay}
          .min=${PACE_BOUNDS.reviewsPerDay.min}
          .max=${PACE_BOUNDS.reviewsPerDay.max}
          .step=${REVIEW_STEP}
          @change=${(event: Event) => this.#onNumber(event, 'reviewsPerDay')}
        ></ui-stepper>
        ${this.#renderReviewHint(settings)}
      </section>

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
        <p class="hint">En økt tar fra det som er igjen av dagens grenser.</p>
      </section>

      <ui-segmented
        label="Dagsmål"
        .options=${DAILY_GOALS}
        .value=${String(store.state.progress.dailyGoal)}
        @change=${this.#onGoal}
      ></ui-segmented>
    `;
  }

  /** The rule of thumb for how many reviews to allow, so they do not pile up; a warning when it is not met. */
  #renderReviewHint(settings: Settings): TemplateResult {
    const recommended = recommendedReviewLimit(settings.newPerDay);
    const tooFew = settings.reviewsPerDay < recommended;

    return html`<p class=${tooFew ? 'hint warning' : 'hint'} role=${tooFew ? 'status' : 'note'}>
      Tommelregel: minst ti ganger så mange repetisjoner som nye oppgaver
      ${tooFew ? html`(her ${recommended})` : nothing}, ellers hoper repetisjonene seg opp.
    </p>`;
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

  #onNumber(event: Event, key: 'sessionSize' | 'newPerDay' | 'reviewsPerDay'): void {
    if (event instanceof CustomEvent && typeof event.detail === 'number') {
      saveSettings(this, { [key]: event.detail });
    }
  }

  #onManualRating = (event: Event): void => {
    if (event instanceof CustomEvent && typeof event.detail === 'boolean') {
      saveSettings(this, { manualRating: event.detail });
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
