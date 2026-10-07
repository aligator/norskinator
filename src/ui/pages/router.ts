/** Hash routing: any static file server can host the app without rewrite rules. */

export type Route =
  | 'hjem'
  | 'ovelse'
  | 'statistikk'
  | 'innstillinger'
  | 'innstillinger/ovelse'
  | 'innstillinger/visning'
  | 'innstillinger/om'
  | 'impressum';

const ROUTES: readonly Route[] = [
  'hjem',
  'ovelse',
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
  statistikk: 'Statistikk',
  innstillinger: 'Innstillinger',
  'innstillinger/ovelse': 'Øving',
  'innstillinger/visning': 'Utseende og lyd',
  'innstillinger/om': 'Om appen',
  impressum: 'Impressum og personvern',
};

/** The tab a route belongs to, so sub-pages keep their tab highlighted. */
export function tabOf(route: Route): Route {
  return route.startsWith('innstillinger/') ? 'innstillinger' : route;
}

function isRoute(value: string): value is Route {
  return ROUTES.some((route) => route === value);
}

export function currentRoute(): Route {
  const hash = globalThis.location.hash.replace(/^#/, '');

  return isRoute(hash) ? hash : 'hjem';
}

export function navigate(route: Route): void {
  if (currentRoute() === route) {
    return;
  }

  globalThis.location.hash = route;
}
