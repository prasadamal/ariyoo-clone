import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <a class="skip" href="#main">Skip to content</a>
    <header class="bar">
      <div class="wrap inner">
        <a routerLink="/" class="brand" aria-label="Ariyoo home" (click)="open.set(false)">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#0e7a5f"/><path d="M16 6.5c-4.1 0-7.2 3-7.2 7 0 5.2 7.2 12 7.2 12s7.2-6.8 7.2-12c0-4-3.1-7-7.2-7Zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z" fill="#fff"/></svg>
          <span>Ariyoo</span>
        </a>
        <button type="button" class="toggle" [attr.aria-expanded]="open()" aria-controls="primary-nav" (click)="open.set(!open())">
          <span class="sr-only">Menu</span>
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <nav id="primary-nav" [class.open]="open()" aria-label="Primary">
          @for (link of links; track link.path) {
            <a [routerLink]="link.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: link.path === '/' }" (click)="open.set(false)">{{ link.label }}</a>
          }
          <a routerLink="/contact" class="btn btn--primary cta" (click)="open.set(false)">Contact us</a>
        </nav>
      </div>
    </header>
  `,
  styles: `
    .skip { position: absolute; left: -999px; top: 8px; background: #fff; color: var(--ink); padding: 10px 16px; border-radius: 8px; z-index: 100; }
    .skip:focus { left: 8px; }
    .bar { position: sticky; top: 0; z-index: 50; background: rgba(247, 244, 238, 0.94); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }
    .inner { display: flex; align-items: center; justify-content: space-between; min-height: 72px; gap: 16px; }
    .brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: var(--ink); font: 700 1.45rem/1 var(--font-display); letter-spacing: -0.02em; }
    nav { display: flex; align-items: center; gap: clamp(14px, 2vw, 28px); }
    nav a:not(.btn) { color: var(--ink-soft); text-decoration: none; font-weight: 600; font-size: 0.97rem; padding: 8px 2px; border-bottom: 2px solid transparent; }
    nav a:not(.btn):hover, nav a.active { color: var(--ink); border-bottom-color: var(--green); }
    .cta { min-height: 42px; padding: 0 20px; font-size: 0.95rem; }
    .toggle { display: none; background: none; border: 0; color: var(--ink); padding: 10px; margin-right: -10px; cursor: pointer; }
    @media (max-width: 920px) {
      .toggle { display: inline-flex; }
      nav { display: none; position: absolute; top: 72px; left: 0; right: 0; flex-direction: column; align-items: stretch; gap: 0; background: var(--paper); border-bottom: 1px solid var(--line); padding: 8px var(--gutter) 20px; }
      nav.open { display: flex; }
      nav a:not(.btn) { padding: 14px 0; border-bottom: 1px solid var(--line); font-size: 1.05rem; }
      .cta { margin-top: 16px; }
    }
  `,
})
export class SiteHeader {
  protected readonly open = signal(false);
  protected readonly links = [
    { path: '/product', label: 'Product' },
    { path: '/about', label: 'Company' },
    { path: '/trust', label: 'Trust & Safety' },
    { path: '/careers', label: 'Careers' },
    { path: '/press', label: 'Press' },
  ];
}
