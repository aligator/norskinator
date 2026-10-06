/**
 * Impressum (§ 18 Abs. 1 MStV) and privacy notice (GDPR). German, because the
 * obligation comes from German law; one Norwegian line explains that.
 */
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';

import { sharedStyles } from '../../components/styles/shared.ts';
import { LegalController, type LegalContact } from './legal-contact.ts';

export class LegalNotice extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: grid;
        gap: var(--sp-6);
        line-height: var(--lh-body);
      }

      section {
        display: grid;
        gap: var(--sp-3);
      }

      h2 {
        font-size: var(--fs-lg);
      }

      h3 {
        margin: var(--sp-2) 0 0;
        font-size: var(--fs-md);
      }

      ul {
        display: grid;
        gap: var(--sp-1);
        margin: 0;
        padding-left: var(--sp-5);
      }

      address {
        font-style: normal;
      }

      .legal-text {
        display: grid;
        gap: var(--sp-8);
      }

      .intro {
        padding: var(--sp-3) var(--sp-4);
        border-radius: var(--r-lg);
        background: var(--surface-2);
        font-size: var(--fs-sm);
        color: var(--fg-muted);
      }
    `,
  ];

  readonly #legal = new LegalController(this);

  protected override render(): TemplateResult {
    const contact = this.#legal.contact;

    if (contact === null) {
      return html`<p class="intro" lang="nb">Ingen kontaktinformasjon er satt opp for denne installasjonen.</p>`;
    }

    return html`
      <p class="intro" lang="nb">
        Teksten under er på tysk, fordi den følger tysk lov. Kort sagt: fremgangen lagres bare i nettleseren din, uten
        informasjonskapsler og uten sporing.
      </p>
      <div class="legal-text" lang="de">${this.#renderImpressum(contact)} ${this.#renderPrivacy(contact)}</div>
    `;
  }

  #renderImpressum(contact: LegalContact): TemplateResult {
    return html`
      <section aria-labelledby="impressum-title">
        <h2 id="impressum-title">Impressum</h2>
        <p>Angaben gemäß § 18 Abs. 1 Medienstaatsvertrag (MStV):</p>
        <address>
          ${contact.name}<br />
          ${contact.addressLines.map((line) => html`${line}<br />`)}
          ${contact.email === null ? nothing : html`E-Mail: <a href=${`mailto:${contact.email}`}>${contact.email}</a>`}
        </address>
        ${contact.note === null ? nothing : html`<p>${contact.note}</p>`}
      </section>
    `;
  }

  #renderPrivacy(contact: LegalContact): TemplateResult {
    return html`
      <section aria-labelledby="privacy-title">
        <h2 id="privacy-title">Datenschutzerklärung</h2>

        <h3>Verantwortlicher</h3>
        <p>${contact.name}, Anschrift siehe Impressum.</p>

        <h3>Server-Protokolle</h3>
        <p>
          Beim Aufruf dieser Seite verarbeitet der Webserver technisch notwendige Daten wie IP-Adresse, Datum und
          Uhrzeit sowie den aufgerufenen Pfad, um die Seite auszuliefern und vor Missbrauch zu schützen. Rechtsgrundlage
          ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren Betrieb). Die Protokolle werden nur
          so lange aufbewahrt, wie es dafür erforderlich ist.
        </p>

        <h3>Daten in der App</h3>
        <ul>
          <li>
            Lernfortschritt und Einstellungen werden ausschließlich im lokalen Speicher (localStorage) Ihres Browsers
            gespeichert und nicht an den Betreiber oder Dritte übertragen.
          </li>
          <li>
            Sie können diese Daten jederzeit unter „Innstillinger → Nullstill all fremgang“ oder über die
            Browsereinstellungen löschen.
          </li>
          <li>Es gibt keine Cookies, kein Tracking, keine Analyse-Werkzeuge und keine Werbung.</li>
          <li>Schriftarten und alle Inhalte werden von diesem Server geladen, nicht von Drittanbietern.</li>
          <li>Ein Service Worker speichert die App für die Offline-Nutzung im Browser-Cache. Er überträgt keine Daten.</li>
        </ul>

        <h3>Vorlesefunktion (optional)</h3>
        <p>
          Wenn Sie „Les opp setningen“ aktivieren, nutzt die App die Sprachausgabe Ihres Browsers bzw. Betriebssystems.
          Manche Browser verwenden dafür Online-Stimmen des Herstellers; dann wird der vorgelesene Übungssatz an diesen
          übertragen. Persönliche Daten übermittelt die App dabei nicht.
        </p>

        <h3>Externe Links</h3>
        <p>
          Links zu Tatoeba und anderen Seiten öffnen externe Angebote. Für deren Datenverarbeitung sind die jeweiligen
          Betreiber verantwortlich.
        </p>

        <h3>Ihre Rechte</h3>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Widerspruch sowie
          das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde.
        </p>
      </section>
    `;
  }
}

customElements.define('legal-notice', LegalNotice);

declare global {
  interface HTMLElementTagNameMap {
    'legal-notice': LegalNotice;
  }
}
