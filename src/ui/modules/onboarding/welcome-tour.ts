/**
 * First-run introduction: what the app does, how a session works, how the
 * streak and goal work, and the choices that matter up front (translation,
 * daily goal, sound). Emits `tour-closed` with `{ start: boolean }`.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { DAILY_GOAL_BOUNDS } from '../../../core/gamification.ts';
import type { TranslationLanguage } from '../../../core/storage.ts';
import { flameIcon, speakerIcon } from '../../components/icons.ts';
import type { SegmentOption } from '../../components/segmented-control.ts';
import { sharedStyles } from '../../components/styles/shared.ts';
import { playSound } from '../audio/sound-effects.ts';
import { VoiceController } from '../audio/voice-controller.ts';
import { StoreController, store } from '../shared/store.ts';
import { markTourDone } from './tour-state.ts';

import '../../components/segmented-control.ts';
import '../../components/toggle-switch.ts';

const TRANSLATIONS: readonly SegmentOption[] = [
  { value: 'de', label: 'Tysk' },
  { value: 'en', label: 'Engelsk' },
  { value: 'none', label: 'Ingen' },
];

const DAILY_GOALS: readonly SegmentOption[] = [10, 20, 30, 50]
  .filter((goal) => goal >= DAILY_GOAL_BOUNDS.min && goal <= DAILY_GOAL_BOUNDS.max)
  .map((goal) => ({ value: String(goal), label: String(goal) }));

const STEP_COUNT = 5;

function isTranslationLanguage(value: string): value is TranslationLanguage {
  return TRANSLATIONS.some((option) => option.value === value);
}

export interface TourClosedDetail {
  /** True when the learner chose to start the first session right away. */
  readonly start: boolean;
}

export class WelcomeTour extends LitElement {
  static override properties = {
    step: { state: true },
  };

  static override styles = [
    sharedStyles,
    css`
      dialog {
        width: min(100%, var(--w-practice));
        max-width: 100%;
        height: 100dvh;
        max-height: 100dvh;
        margin: 0 auto;
        padding: 0;
        border: 0;
        background: var(--bg);
        color: var(--fg);
      }

      dialog::backdrop {
        background: var(--scrim);
      }

      @media (min-width: 600px) {
        dialog {
          height: auto;
          max-height: min(90dvh, 44rem);
          margin: auto;
          border-radius: var(--r-xl);
          box-shadow: var(--shadow-2);
        }
      }

      .frame {
        display: flex;
        flex-direction: column;
        min-height: 100%;
        padding: calc(var(--sp-6) + env(safe-area-inset-top)) var(--sp-5) calc(var(--sp-4) + env(safe-area-inset-bottom));
      }

      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: var(--hit);
      }

      .dots {
        display: flex;
        gap: var(--sp-2);
      }

      .dots span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--border-strong);
      }

      .dots span.active {
        width: 24px;
        border-radius: var(--r-pill);
        background: var(--accent);
      }

      .body {
        display: grid;
        align-content: center;
        justify-items: center;
        gap: var(--sp-5);
        flex: 1;
        padding-block: var(--sp-6);
        text-align: center;
      }

      /* Lists, boxes and controls read better left-aligned and full width. */
      .body ul,
      .body .hint,
      .body .example,
      .body .switch-row,
      .body ui-segmented {
        justify-self: stretch;
        text-align: left;
      }

      .emoji {
        font-size: 48px;
        line-height: 1;
      }

      h2 {
        font-size: var(--fs-xl);
        line-height: var(--lh-tight);
      }

      p,
      li {
        line-height: var(--lh-body);
      }

      ul {
        display: grid;
        gap: var(--sp-3);
        margin: 0;
        padding-left: var(--sp-5);
      }

      .example {
        padding: var(--sp-4);
        border-radius: var(--r-lg);
        background: var(--surface);
        font: 400 var(--fs-lg) / var(--lh-prompt) var(--font-prompt);
      }

      .example .gap {
        display: inline-block;
        min-width: 3ch;
        border-bottom: 2px solid var(--border-strong);
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-1);
        padding: 0 var(--sp-2);
        border-radius: var(--r-pill);
        background: var(--flame-bg);
        color: var(--flame);
        font-weight: 700;
        vertical-align: middle;
      }

      .switch-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sp-4);
      }

      .hint {
        padding: var(--sp-3) var(--sp-4);
        border-radius: var(--r-lg);
        background: var(--surface-2);
        font-size: var(--fs-sm);
        color: var(--fg-muted);
      }

      .hint strong {
        color: var(--fg);
      }

      .hint ul {
        margin-top: var(--sp-2);
        gap: var(--sp-1);
      }

      .actions {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: var(--sp-3);
      }

      .actions.single {
        grid-template-columns: 1fr;
      }

      .finish {
        display: grid;
        gap: var(--sp-3);
      }
    `,
  ];

  declare step: number;

  protected readonly storeController = new StoreController(this);
  readonly #voice = new VoiceController(this);

  constructor() {
    super();
    this.step = 0;
  }

  protected override firstUpdated(): void {
    this.renderRoot.querySelector('dialog')?.showModal();
  }

  protected override updated(): void {
    this.renderRoot.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }

  protected override render(): TemplateResult {
    return html`
      <dialog aria-labelledby="tour-title" @cancel=${this.#onCancel}>
        <div class="frame">
          <div class="top">
            <div class="dots" role="img" aria-label=${`Steg ${this.step + 1} av ${STEP_COUNT}`}>
              ${Array.from({ length: STEP_COUNT }, (_unused, index) => html`<span class=${index === this.step ? 'active' : ''}></span>`)}
            </div>
            ${this.step < STEP_COUNT - 1
              ? html`<button class="text-button" @click=${() => this.#close(false)}>Hopp over</button>`
              : nothing}
          </div>
          <div class="body">${this.#renderStep()}</div>
          ${this.#renderActions()}
        </div>
      </dialog>
    `;
  }

  #renderStep(): TemplateResult {
    switch (this.step) {
      case 0: {
        return html`
          <span class="emoji" aria-hidden="true">🧭</span>
          <h2 id="tour-title" tabindex="-1">Velkommen til Norskinator</h2>
          <p>Her øver du på norsk grammatikk – først preposisjoner som <em>i, på, til</em> og <em>av</em>.</p>
          <p>
            Det du svarer feil på, kommer snart igjen. Det du kan godt, kommer sjeldnere. Litt hver dag gir mest.
          </p>
          <p class="hint">
            <strong>Ingen konto:</strong> fremgangen lagres bare i denne nettleseren, på denne enheten. Sletter du
            nettleserdata, forsvinner den.
          </p>
        `;
      }

      case 1: {
        return html`
          <span class="emoji" aria-hidden="true">✍️</span>
          <h2 id="tour-title" tabindex="-1">Slik øver du</h2>
          <p class="example" lang="nb">Jeg bor <span class="gap" aria-label="luke"></span> Norge.</p>
          <ul>
            <li>Trykk på preposisjonen som passer i luka. Med tastatur: <strong>1–4</strong>.</li>
            <li>Etter svaret ser du hele setningen og en kort forklaring. Trykk <strong>Fortsett</strong> (tastatur: Enter).</li>
            <li>Står du fast, trykk <strong>Vis oversettelse</strong> under setningen (tastatur: T).</li>
            <li>En økt er rundt 20 oppgaver. Du kan avslutte når som helst – fremgangen lagres.</li>
          </ul>
        `;
      }

      case 2: {
        return html`
          <span class="emoji" aria-hidden="true">🔥</span>
          <h2 id="tour-title" tabindex="-1">Rekke, dagsmål og nivå</h2>
          <ul>
            <li>
              <span class="chip">${flameIcon(16)} Rekke</span> Fullfør <strong>en hel økt</strong> hver dag for å holde
              rekka. Avbrutte økter teller ikke.
            </li>
            <li><strong>Dagsmålet</strong> er et antall svar per dag. Ringen på forsiden viser hvor langt du har kommet.</li>
            <li>Riktige svar gir <strong>XP</strong>, og mange riktige på rad gir bonus. Nok XP gir nytt nivå og merker.</li>
          </ul>
        `;
      }

      case 3: {
        return this.#renderChoices();
      }

      default: {
        return this.#renderSound();
      }
    }
  }

  #renderChoices(): TemplateResult {
    const settings = store.state.settings;

    return html`
      <span class="emoji" aria-hidden="true">⚙️</span>
      <h2 id="tour-title" tabindex="-1">Dine valg</h2>
      <ui-segmented
        label="Oversettelse som hjelp"
        .options=${TRANSLATIONS}
        .value=${settings.translationLanguage}
        @change=${this.#onTranslation}
      ></ui-segmented>
      <ui-segmented
        label="Dagsmål (svar per dag)"
        .options=${DAILY_GOALS}
        .value=${String(store.state.progress.dailyGoal)}
        @change=${this.#onGoal}
      ></ui-segmented>
      <p class="hint">Alt kan endres senere under Innstillinger.</p>
    `;
  }

  #renderSound(): TemplateResult {
    const settings = store.state.settings;

    return html`
      <span class="emoji" aria-hidden="true">🔊</span>
      <h2 id="tour-title" tabindex="-1">Lyd</h2>
      <div class="switch-row">
        <span>Lydeffekter ved riktig og feil svar</span>
        <ui-switch label="Lydeffekter" .checked=${settings.soundEffects} @change=${this.#onSoundEffects}></ui-switch>
      </div>
      ${this.#voice.available
        ? html`
            <div class="switch-row">
              <span>Les opp setningen etter svaret ${speakerIcon(16)}</span>
              <ui-switch label="Opplesing" .checked=${settings.speakSolution} @change=${this.#onSpeak}></ui-switch>
            </div>
          `
        : html`
            <div class="hint" role="note">
              <strong>Opplesing er ikke mulig i denne nettleseren.</strong> Den har ingen norsk stemme installert.
              <ul>
                <li>iPhone, iPad og Mac: norsk stemme er innebygd (Safari).</li>
                <li>Windows: installer norsk språkpakke, eller bruk Edge.</li>
                <li>Android: installer norske språkdata i Google Tekst-til-tale.</li>
                <li>Linux: krever som regel ekstra oppsett.</li>
              </ul>
            </div>
          `}
      <p class="hint">På iPhone må ringebryteren være på for at lydeffekter skal høres.</p>
    `;
  }

  #renderActions(): TemplateResult {
    if (this.step === STEP_COUNT - 1) {
      return html`
        <div class="finish">
          <button class="button primary block" @click=${() => this.#close(true)}>Start første økt</button>
          <button class="button secondary block" @click=${() => this.#close(false)}>Til forsiden</button>
        </div>
      `;
    }

    if (this.step === 0) {
      return html`
        <div class="actions single">
          <button class="button primary block" @click=${this.#next}>Kom i gang</button>
        </div>
      `;
    }

    return html`
      <div class="actions">
        <button class="button secondary" @click=${this.#back}>Tilbake</button>
        <button class="button primary" @click=${this.#next}>Neste</button>
      </div>
    `;
  }

  #next = (): void => {
    this.step = Math.min(this.step + 1, STEP_COUNT - 1);
  };

  #back = (): void => {
    this.step = Math.max(this.step - 1, 0);
  };

  #onTranslation = (event: Event): void => {
    if (event instanceof CustomEvent && typeof event.detail === 'string' && isTranslationLanguage(event.detail)) {
      store.updateSettings({ translationLanguage: event.detail });
    }
  };

  #onGoal = (event: Event): void => {
    if (event instanceof CustomEvent && typeof event.detail === 'string') {
      store.setDailyGoal(Number(event.detail));
    }
  };

  #onSoundEffects = (event: Event): void => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== 'boolean') {
      return;
    }

    store.updateSettings({ soundEffects: event.detail });

    if (event.detail) {
      playSound('correct');
    }
  };

  #onSpeak = (event: Event): void => {
    if (event instanceof CustomEvent && typeof event.detail === 'boolean') {
      store.updateSettings({ speakSolution: event.detail });
    }
  };

  /** Esc counts as "skip": the learner has seen enough to start. */
  #onCancel = (event: Event): void => {
    event.preventDefault();
    this.#close(false);
  };

  #close(start: boolean): void {
    markTourDone();
    this.renderRoot.querySelector('dialog')?.close();
    this.dispatchEvent(
      new CustomEvent<TourClosedDetail>('tour-closed', { detail: { start }, bubbles: true, composed: true }),
    );
  }
}

customElements.define('welcome-tour', WelcomeTour);

declare global {
  interface HTMLElementTagNameMap {
    'welcome-tour': WelcomeTour;
  }
}
