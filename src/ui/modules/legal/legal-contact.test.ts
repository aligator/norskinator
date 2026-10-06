import { describe, expect, it } from 'vitest';

import { parseLegalContact } from './legal-contact.ts';

describe('parseLegalContact', () => {
  it('splits the address into lines and keeps an optional e-mail', () => {
    const contact = parseLegalContact({ name: ' Anna Hansen ', address: 'Gate 1 | 12345 By |Tyskland', email: '' });

    expect(contact).toEqual({
      name: 'Anna Hansen',
      addressLines: ['Gate 1', '12345 By', 'Tyskland'],
      email: null,
      note: null,
    });
  });

  it('keeps an optional note', () => {
    const contact = parseLegalContact({ name: 'Anna', address: 'Gate 1', note: ' Privates Lernangebot. ' });

    expect(contact?.note).toBe('Privates Lernangebot.');
  });

  it('treats missing name or address as not configured', () => {
    expect(parseLegalContact({ name: 'Anna', address: ' | ' })).toBeNull();
    expect(parseLegalContact({ address: 'Gate 1' })).toBeNull();
    expect(parseLegalContact('Anna')).toBeNull();
    expect(parseLegalContact(null)).toBeNull();
  });
});
