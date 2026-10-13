/** Links to pages that modules may render; the router reads the same format. */
export const PLANT_ROUTE = 'plante';

export function plantHref(itemId: string): string {
  return `#${PLANT_ROUTE}/${encodeURIComponent(itemId)}`;
}

export const GARDEN_HREF = '#hage';

export const GARDEN_INFO_HREF = '#hage/info';

export const SHOP_HREF = '#hage/butikk';
