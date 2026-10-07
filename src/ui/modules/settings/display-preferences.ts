/** How the app looks and sounds: theme, sound effects and reading the solution aloud. */
import { LitElement, html, nothing, type TemplateResult } from 'lit';

import type { ThemePreference } from '../../../core/storage.ts';
import type { SegmentOption } from '../../components/segmented-control.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { VoiceController } from '../audio/voice-controller.ts';
import { playSound } from '../audio/sound-effects.ts';
import { StoreController, store } from '../shared/store.ts';
import { preferenceStyles, saveSettings, stringDetail } from './preference-helpers.ts';

import '../../components/segmented-control.ts';
import '../../components/toggle-switch.ts';

const THEMES: readonly SegmentOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Lys' },
  { value: 'dark', label: 'Mørk' },
];

function isTheme(value: string): value is ThemePreference {
  return THEMES.some((option) => option.value === value);
}

export class DisplayPreferences extends LitElement {
  static override styles = [sharedStyles, preferenceStyles];

  protected readonly storeController = new StoreController(this);
  readonly #voice = new VoiceController(this);

  protected override render(): TemplateResult {
    const settings = store.state.settings;

    return html`
      <ui-segmented label="Utseende" .options=${THEMES} .value=${settings.theme} @change=${this.#onTheme}></ui-segmented>

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
    `;
  }

  #onTheme = (event: Event): void => {
    const value = stringDetail(event);

    if (value !== null && isTheme(value)) {
      saveSettings(this, { theme: value });
    }
  };

  #onSoundEffects = (event: Event): void => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== 'boolean') {
      return;
    }

    saveSettings(this, { soundEffects: event.detail });

    // A sample right away lets the learner hear what they switched on (and unlocks audio on iOS).
    if (event.detail) {
      playSound('correct');
    }
  };

  #onSpeakSolution = (event: Event): void => {
    if (event instanceof CustomEvent && typeof event.detail === 'boolean') {
      saveSettings(this, { speakSolution: event.detail });
    }
  };
}

customElements.define('display-preferences', DisplayPreferences);

declare global {
  interface HTMLElementTagNameMap {
    'display-preferences': DisplayPreferences;
  }
}
