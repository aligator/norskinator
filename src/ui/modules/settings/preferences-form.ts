/** Translation language, theme, session size and daily goal. Saves on change. */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { DAILY_GOAL_BOUNDS } from '../../../core/gamification.ts';
import { NEW_PER_SESSION_BOUNDS, type Settings, type ThemePreference, type TranslationLanguage } from '../../../core/storage.ts';
import type { SegmentOption } from '../../components/segmented-control.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { VoiceController } from '../audio/voice-controller.ts';
import { playSound } from '../audio/sound-effects.ts';
import { announce } from '../shared/announce.ts';
import { StoreController, store } from '../shared/store.ts';

import '../../components/segmented-control.ts';
import '../../components/stepper.ts';
import '../../components/toggle-switch.ts';

const TRANSLATIONS: readonly SegmentOption[] = [
  { value: 'de', label: 'Tysk' },
  { value: 'en', label: 'Engelsk' },
  { value: 'none', label: 'Av' },
];

const THEMES: readonly SegmentOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Lys' },
  { value: 'dark', label: 'Mørk' },
];

const DAILY_GOALS: readonly SegmentOption[] = [10, 20, 30, 50]
  .filter((goal) => goal >= DAILY_GOAL_BOUNDS.min && goal <= DAILY_GOAL_BOUNDS.max)
  .map((goal) => ({ value: String(goal), label: String(goal) }));

/** The stepper stops below the stored maximum; bigger sessions get tiring on a phone. */
const NEW_MAX_IN_UI = Math.min(30, NEW_PER_SESSION_BOUNDS.max);
const NEW_STEP = 5;

function stringDetail(event: Event): string | null {
  if (event instanceof CustomEvent && typeof event.detail === 'string') {
    return event.detail;
  }

  return null;
}

function isTranslationLanguage(value: string): value is TranslationLanguage {
  return TRANSLATIONS.some((option) => option.value === value);
}

function isTheme(value: string): value is ThemePreference {
  return THEMES.some((option) => option.value === value);
}

export class PreferencesForm extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: var(--sp-6);
      }

      .eyebrow {
        margin-bottom: var(--sp-3);
      }

      .switch-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-4);
      }

      .hint {
        font-size: var(--fs-sm);
        color: var(--fg-muted);
      }
    `,
  ];

  protected readonly storeController = new StoreController(this);
  readonly #voice = new VoiceController(this);

  protected override render(): TemplateResult {
    const settings = store.state.settings;

    return html`
      <ui-segmented
        label="Oversettelse"
        .options=${TRANSLATIONS}
        .value=${settings.translationLanguage}
        @change=${this.#onTranslation}
      ></ui-segmented>

      <ui-segmented
        label="Utseende"
        .options=${THEMES}
        .value=${settings.theme}
        @change=${this.#onTheme}
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

      <section>
        <h2 class="eyebrow">Lyd</h2>
        <div class="switch-row">
          <span>Lydeffekter ved svar</span>
          <ui-switch label="Lydeffekter ved svar" .checked=${settings.soundEffects} @change=${this.#onSoundEffects}></ui-switch>
        </div>
        ${this.#voice.available
          ? html`<div class="switch-row">
              <span>Les opp setningen etter svaret</span>
              <ui-switch
                label="Les opp setningen etter svaret"
                .checked=${settings.speakSolution}
                @change=${this.#onSpeakSolution}
              ></ui-switch>
            </div>`
          : nothing}
        ${this.#voice.available
          ? html`<p class="hint">På iPhone må ringebryteren være på for lydeffekter.</p>`
          : html`<p class="hint">Nettleseren har ingen norsk stemme, så opplesing er ikke tilgjengelig.</p>`}
      </section>

      <ui-segmented
        label="Dagsmål"
        .options=${DAILY_GOALS}
        .value=${String(store.state.progress.dailyGoal)}
        @change=${this.#onGoal}
      ></ui-segmented>
    `;
  }

  #onTranslation = (event: Event): void => {
    const value = stringDetail(event);

    if (value !== null && isTranslationLanguage(value)) {
      this.#save({ translationLanguage: value });
    }
  };

  #onTheme = (event: Event): void => {
    const value = stringDetail(event);

    if (value !== null && isTheme(value)) {
      this.#save({ theme: value });
    }
  };

  #onNewPerSession = (event: Event): void => {
    if (event instanceof CustomEvent && typeof event.detail === 'number') {
      this.#save({ newPerSession: event.detail });
    }
  };

  #onSoundEffects = (event: Event): void => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== 'boolean') {
      return;
    }

    this.#save({ soundEffects: event.detail });

    // A sample right away lets the learner hear what they switched on (and unlocks audio on iOS).
    if (event.detail) {
      playSound('correct');
    }
  };

  #onSpeakSolution = (event: Event): void => {
    if (event instanceof CustomEvent && typeof event.detail === 'boolean') {
      this.#save({ speakSolution: event.detail });
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

  #save(patch: Partial<Settings>): void {
    store.updateSettings(patch);
    announce(this, 'Lagret');
  }
}

customElements.define('preferences-form', PreferencesForm);

declare global {
  interface HTMLElementTagNameMap {
    'preferences-form': PreferencesForm;
  }
}
