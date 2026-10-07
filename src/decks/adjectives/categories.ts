/**
 * Form categories of the adjective deck: the first tag of every item, so the
 * statistics group by them.
 */
export const FORM_CATEGORIES = ['en/ei-ord', 'et-ord', 'flertall', 'bestemt form', 'adverb'] as const;

export type FormCategory = (typeof FORM_CATEGORIES)[number];

export function isFormCategory(value: string): value is FormCategory {
  return FORM_CATEGORIES.some((category) => category === value);
}
