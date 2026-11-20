import { Routes } from '@angular/router';

const description = {
  product: 'How Ariyoo works: ask a question, get matched with a local expert, and keep the answers that matter. Private, safe and built for trust.',
  about: 'Ariyoo is a technology company based in Bengaluru, built by three co-founders to make local knowledge easy to ask for and safe to trust.',
  trust: 'How Ariyoo protects people: reporting and blocking, moderation, automatic filtering, private photos, no tracking and account deletion.',
  careers: 'Join Ariyoo in Bengaluru. See open roles or send an open application.',
  press: 'Announcements and news from Ariyoo, with a media contact for journalists and anyone writing about the company.',
  contact: 'Contact Ariyoo about partnerships, investment, press, support or careers.',
  legal: 'Ariyoo privacy policy, terms of use and information about your data.',
};

export const routes: Routes = [
  { path: '', title: 'Ariyoo | Local knowledge from the people who live it', data: { description: 'Ariyoo connects people who need a trustworthy answer with local experts who know a place first-hand, in conversations built for safety and privacy.' }, loadComponent: () => import('./pages/home').then(m => m.Home) },
  { path: 'product', title: 'Product | Ariyoo', data: { description: description.product }, loadComponent: () => import('./pages/product').then(m => m.Product) },
  { path: 'about', title: 'Company | Ariyoo', data: { description: description.about }, loadComponent: () => import('./pages/about').then(m => m.About) },
  { path: 'trust', title: 'Trust & Safety | Ariyoo', data: { description: description.trust }, loadComponent: () => import('./pages/trust').then(m => m.Trust) },
  { path: 'careers', title: 'Careers | Ariyoo', data: { description: description.careers }, loadComponent: () => import('./pages/careers').then(m => m.Careers) },
  { path: 'press', title: 'Press | Ariyoo', data: { description: description.press }, loadComponent: () => import('./pages/press').then(m => m.Press) },
  { path: 'press/:slug', title: 'News | Ariyoo', data: { description: description.press }, loadComponent: () => import('./pages/press-article').then(m => m.PressArticleView) },
  { path: 'contact', title: 'Contact | Ariyoo', data: { description: description.contact }, loadComponent: () => import('./pages/contact').then(m => m.Contact) },
  { path: 'legal', title: 'Legal | Ariyoo', data: { description: description.legal }, loadComponent: () => import('./pages/legal').then(m => m.Legal) },
  { path: '**', title: 'Page not found | Ariyoo', data: { noindex: true }, loadComponent: () => import('./pages/not-found').then(m => m.NotFound) },
];
