import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRODUCTS } from '../core/products';
import { PageHero } from '../ui/page-hero';
import { Phone } from '../ui/phone';

@Component({
  selector: 'app-product',
  imports: [RouterLink, PageHero, Phone],
  template: `
    <app-page-hero eyebrow="Our apps" title="Three apps for everyday life." lede="Local answers, travel and film. Each one focused on doing one job well, with safety and privacy built in." />

    @for (p of products; track p.id; let odd = $odd) {
      <section class="section" [class.section--alt]="odd" [id]="p.id">
        <div class="wrap app" [class.flip]="odd">
          <div class="copy">
            <p class="eyebrow"><span class="dot" [style.background]="p.color"></span>{{ p.name }} · {{ p.category }}</p>
            <h2>{{ p.tagline }}</h2>
            <p class="lede">{{ p.description }}</p>
            <ul class="ticks">@for (f of p.features; track f) { <li>{{ f }}</li> }</ul>
          </div>
          <div class="art">
            @for (s of p.screens; track s.src; let i = $index) {
              <app-phone [screens]="[s]" [width]="i === 1 ? 230 : 190" [class]="'p' + i" />
            }
          </div>
        </div>
      </section>
    }

    <section class="section section--deep">
      <div class="wrap">
        <h2>Availability</h2>
        <p class="lede">Our apps for Android and iOS are being prepared for public launch. For early access, a demonstration or a partnership conversation, we would be glad to hear from you.</p>
        <div class="btn-row"><a routerLink="/contact" class="btn btn--light">Request a demonstration</a></div>
      </div>
    </section>
  `,
  styles: `
    .app { display: grid; grid-template-columns: 1fr 1.1fr; gap: clamp(28px, 5vw, 64px); align-items: center; }
    .app.flip .copy { order: 2; }
    .eyebrow { display: flex; align-items: center; gap: 10px; color: var(--ink-soft); }
    .dot { width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18); }
    .art { display: flex; justify-content: center; align-items: center; gap: 0; }
    .art .p0 { transform: rotate(-5deg) translateX(24px); }
    .art .p1 { z-index: 1; }
    .art .p2 { transform: rotate(5deg) translateX(-24px); }
    .ticks { list-style: none; padding: 0; margin: 18px 0 0; display: grid; gap: 12px; }
    .ticks li { padding-left: 30px; position: relative; }
    .ticks li::before { content: ''; position: absolute; left: 0; top: 0.5em; width: 14px; height: 8px; border-left: 2.5px solid var(--brand); border-bottom: 2.5px solid var(--brand); transform: rotate(-45deg) translateY(-3px); }
    @media (max-width: 900px) {
      .app { grid-template-columns: 1fr; }
      .app.flip .copy { order: 0; }
      .art .p0, .art .p2 { display: none; }
    }
  `,
})
export class Product {
  protected readonly products = PRODUCTS;
}
