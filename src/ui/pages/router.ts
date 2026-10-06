/** Hash routing: any static file server can host the app without rewrite rules. */

export type Route = 'hjem' | 'ovelse' | 'statistikk' | 'innstillinger' | 'impressum';

const ROUTES: readonly Route[] = ['hjem', 'ovelse', 'statistikk', 'innstillinger', 'impressum'];

export const ROUTE_TITLES: Readonly<Record<Route, string>> = {
  hjem: 'Hjem',
  ovelse: 'Øving',
  statistikk: 'Statistikk',
  innstillinger: 'Innstillinger',
  impressum: 'Impressum og personvern',
};

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
