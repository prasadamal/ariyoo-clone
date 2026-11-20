import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMPANY } from '../core/company';
import { NewsletterForm } from '../forms/newsletter-form';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, NewsletterForm],
  template: `
    <footer>
      <div class="wrap top">
        <div class="about">
          <p class="brand"><span class="tile"><img src="brand/logo-96.png" width="28" height="28" alt="" /></span>Ariyoo</p>
          <p class="soft">{{ company.tagline }}</p>
          <address>
            @for (line of company.address; track line) { {{ line }}<br /> }
            <a [href]="'mailto:' + company.email">{{ company.email }}</a>
          </address>
        </div>
        <nav aria-label="Company">
          <h2>Company</h2>
          <a routerLink="/about">About</a>
          <a routerLink="/careers">Careers</a>
          <a routerLink="/press">Press</a>
          <a routerLink="/contact">Contact</a>
        </nav>
        <nav aria-label="Our apps and trust">
          <h2>Our apps</h2>
          <a routerLink="/product" fragment="ariyoo">Ariyoo</a>
          <a routerLink="/product" fragment="wayfare">Wayfare</a>
          <a routerLink="/product" fragment="reelmates">ReelMates</a>
          <a routerLink="/trust">Trust & Safety</a>
          <a routerLink="/legal">Legal</a>
        </nav>
        <div class="news">
          <h2>Stay in the loop</h2>
          <p class="soft">News from Ariyoo, a few times a year.</p>
          <app-newsletter-form />
        </div>
      </div>
      <div class="wrap bottom">
        <p>© {{ year }} Ariyoo. All rights reserved.</p>
        <p><a routerLink="/legal">Privacy &amp; terms</a></p>
      </div>
    </footer>
  `,
  styles: `
    footer { background: var(--deep); color: var(--on-deep); padding-top: clamp(48px, 7vw, 80px); }
    footer a { color: var(--on-deep); text-decoration: none; }
    footer a:hover { color: var(--peach); text-decoration: underline; }
    .top { display: grid; gap: 40px; grid-template-columns: 1.4fr 1fr 1fr 1.5fr; }
    .brand { display: flex; align-items: center; gap: 12px; font: 700 1.6rem/1 var(--font-display); margin: 0 0 14px; }
    .tile { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--on-deep); }
    .soft { color: var(--on-deep-soft); }
    address { font-style: normal; color: var(--on-deep-soft); line-height: 1.7; }
    address a { color: var(--peach); }
    h2 { font: 700 0.78rem/1 var(--font-body); letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-deep-soft); margin-bottom: 18px; }
    nav { display: flex; flex-direction: column; gap: 10px; }
    .bottom { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; border-top: 1px solid rgba(255, 255, 255, 0.14); margin-top: 48px; padding-top: 22px; padding-bottom: 32px; color: var(--on-deep-soft); font-size: 0.9rem; }
    .bottom p { margin: 0; }
    @media (max-width: 900px) { .top { grid-template-columns: 1fr 1fr; } .about, .news { grid-column: 1 / -1; } }
  `,
})
export class SiteFooter {
  protected readonly company = COMPANY;
  protected readonly year = new Date().getFullYear();
}
