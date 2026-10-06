/**
 * Operator details for the Impressum, served by the container as ./legal.json
 * (see docker/50-legal.sh). Absent file = no Impressum, and no link to it.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit';

export interface LegalContact {
  readonly name: string;
  readonly addressLines: readonly string[];
  readonly email: string | null;
  /** Optional free text below the address, e.g. that the offer is non-commercial. */
  readonly note: string | null;
}

function readText(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];

  return typeof value === 'string' ? value.trim() : '';
}

/** Validates the raw JSON; anything incomplete counts as "not configured". */
export function parseLegalContact(raw: unknown): LegalContact | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const record: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(raw));
  const name = readText(record, 'name');
  const addressLines = readText(record, 'address')
    .split('|')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const email = readText(record, 'email');
  const note = readText(record, 'note');

  if (name === '' || addressLines.length === 0) {
    return null;
  }

  return {
    name,
    addressLines,
    email: email === '' ? null : email,
    note: note === '' ? null : note,
  };
}

let request: Promise<LegalContact | null> | null = null;
let loaded: LegalContact | null = null;

/** Fetched once per page load; offline or missing simply means "no Impressum". */
export function loadLegalContact(): Promise<LegalContact | null> {
  request ??= fetch('./legal.json', { cache: 'no-cache' })
    .then(async (response) => (response.ok ? parseLegalContact(await response.json()) : null))
    .catch(() => null)
    .then((contact) => {
      loaded = contact;

      return contact;
    });

  return request;
}

/** Gives a component the contact once loaded and re-renders it then. */
export class LegalController implements ReactiveController {
  readonly #host: ReactiveControllerHost;

  constructor(host: ReactiveControllerHost) {
    this.#host = host;
    host.addController(this);
  }

  get contact(): LegalContact | null {
    return loaded;
  }

  hostConnected(): void {
    void loadLegalContact().then(() => {
      this.#host.requestUpdate();
    });
  }
}
