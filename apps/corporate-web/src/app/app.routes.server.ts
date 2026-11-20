import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Articles come from the API at any time, so they are rendered in the browser.
  { path: 'press/:slug', renderMode: RenderMode.Client },
  // Everything else is fixed content and is prerendered to static HTML: fast, and readable by search engines.
  { path: '**', renderMode: RenderMode.Prerender },
];
