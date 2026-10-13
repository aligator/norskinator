/** Hash routing: any static file server can host the app without rewrite rules. */
import { PLANT_ROUTE } from '../modules/shared/links.ts';

export type Route =
  | 'hjem'
  | 'ovelse'
  | 'hage'
  | 'hage/info'
  | 'hage/butikk'
  | 'plante'
  | 'statistikk'
  | 'innstillinger'
  | 'innstillinger/ovelse'
  | 'innstillinger/visning'
  | 'innstillinger/om'
  | 'impressum';

const ROUTES: readonly Route[] = [
  'hjem',
  'ovelse',
  'hage',
  'hage/info',
  'hage/butikk',
  'statistikk',
  'innstillinger',
  'innstillinger/ovelse',
  'innstillinger/visning',
  'innstillinger/om',
  'impressum',
];

export const ROUTE_TITLES: Readonly<Record<Route, string>> = {
  hjem: 'Hjem',
  ovelse: 'Øving',
  hage: 'Hagen',
  'hage/info': 'Slik vokser hagen',
  'hage/butikk': 'Frøbutikken',
  plante: 'Plante',
  statistikk: 'Statistikk',
  innstillinger: 'Innstillinger',
  'innstillinger/ovelse': 'Øving',
  'innstillinger/visning': 'Utseende og lyd',
  'innstillinger/om': 'Om appen',
  impressum: 'Impressum og personvern',
};

/** The tab a route belongs to, so sub-pages keep their tab highlighted. */
export function tabOf(route: Route): Route {
  if (route === 'plante' || route.startsWith('hage/')) {
    return 'hage';
  }

  return route.startsWith('innstillinger/') ? 'innstillinger' : route;
}

function isRoute(value: string): value is Route {
  return ROUTES.some((route) => route === value);
}

export function currentRoute(): Route {
  const hash = globalThis.location.hash.replace(/^#/, '');

  if (currentPlantId() !== null) {
    return 'plante';
  }

  return isRoute(hash) ? hash : 'hjem';
}

/** The item id of `#plante/<id>`, or null on any other route. */
export function currentPlantId(): string | null {
  const prefix = `#${PLANT_ROUTE}/`;
  const hash = globalThis.location.hash;

  if (!hash.startsWith(prefix) || hash.length === prefix.length) {
    return null;
  }

  return decodeURIComponent(hash.slice(prefix.length));
}

export function navigate(route: Route): void {
  if (currentRoute() === route) {
    return;
  }

  globalThis.location.hash = route;
}
