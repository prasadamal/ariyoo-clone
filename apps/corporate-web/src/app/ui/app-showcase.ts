import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Motion } from '../core/motion';
import { PRODUCTS, ProductInfo } from '../core/products';
import { Phone } from './phone';

/**
 * Tabbed product showcase. It advances on its own every few seconds, stops for good once someone
 * picks a tab, and follows the page-wide pause. Arrow keys move between tabs.
 */
@Component({
  selector: 'app-showcase',
  imports: [Phone, RouterLink],
  template: `
    <div class="tabs" role="tablist" aria-label="Our apps" (keydown)="onKey($event)">
      @for (p of products; track p.id; let i = $index) {
        <button type="button" role="tab" [id]="'tab-' + p.id" [attr.aria-controls]="'panel-' + p.id" [attr.aria-selected]="i === current()"
                [attr.tabindex]="i === current() ? 0 : -1" (click)="choose(i)" [class.on]="i === current()" [style.--brand]="p.color">
          <span class="name">{{ p.name }}</span>
          <span class="cat">{{ p.category }}</span>
          @if (i === current() && running()) { <span class="progress" [style.width.%]="elapsed() / interval * 100" aria-hidden="true"></span> }
        </button>
      }
    </div>
    @for (p of products; track p.id; let i = $index) {
      <div class="panel" role="tabpanel" [id]="'panel-' + p.id" [attr.aria-labelledby]="'tab-' + p.id" [hidden]="i !== current()">
        <div class="copy">
          <p class="eyebrow" [style.color]="ink(p)">{{ p.category }}</p>
          <h3>{{ p.tagline }}</h3>
          <p class="lede">{{ p.description }}</p>
          <ul>@for (f of p.features; track f) { <li>{{ f }}</li> }</ul>
          <a routerLink="/product" [fragment]="p.id" class="btn btn--primary">More about {{ p.name }}</a>
        </div>
        <div class="art" [style.--brand]="p.color">
          <app-phone [screens]="p.screens" [active]="0" [width]="250" />
          <app-phone class="back" [screens]="p.screens" [active]="1" [width]="210" />
        </div>
      </div>
    }
  `,
  styles: `
    .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 32px 0 40px; }
    [role=tab] { position: relative; overflow: hidden; text-align: left; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; cursor: pointer; font: inherit; color: var(--ink); display: grid; gap: 2px; }
    [role=tab].on { border-color: var(--ink); box-shadow: inset 0 -4px 0 var(--brand); }
    .name { font: 700 1.2rem/1.2 var(--font-display); }
    .cat { color: var(--ink-faint); font-size: 0.9rem; font-weight: 600; }
    .progress { position: absolute; left: 0; bottom: 0; height: 4px; background: var(--ink); transition: width 0.1s linear; }
    .panel { display: grid; grid-template-columns: 1.1fr 1fr; gap: clamp(28px, 5vw, 64px); align-items: center; }
    .panel[hidden] { display: none; }
    h3 { font-size: clamp(1.8rem, 3vw, 2.4rem); }
    ul { padding-left: 1.1em; display: grid; gap: 8px; margin: 0 0 28px; color: var(--ink-soft); }
    .art { position: relative; display: flex; justify-content: center; padding: 40px 0 20px; border-radius: 28px; background: radial-gradient(closest-side, color-mix(in srgb, var(--brand) 30%, transparent), transparent); }
    .art .back { position: absolute; right: 8%; top: 70px; z-index: -1; transform: rotate(6deg); opacity: 0.9; }
    @media (max-width: 860px) {
      .panel { grid-template-columns: 1fr; }
      .art .back { display: none; }
      .tabs { grid-template-columns: 1fr; }
    }
  `,
})
export class AppShowcase {
  protected readonly motion = inject(Motion);
  protected readonly products = PRODUCTS;
  protected readonly current = signal(0);
  protected readonly running = signal(true);
  protected readonly interval = 7000;
  /** Time spent on the current tab while not paused, so the bar and the switch always agree. */
  protected readonly elapsed = signal(0);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const step = 100;
      const timer = setInterval(() => {
        if (!this.running() || this.motion.paused()) return;
        const next = this.elapsed() + step;
        if (next < this.interval) { this.elapsed.set(next); return; }
        this.elapsed.set(0);
        this.current.update(i => (i + 1) % this.products.length);
      }, step);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  /** Brand colour as text only where it is dark enough to read; lime falls back to ink. */
  protected ink(p: ProductInfo): string { return p.id === 'reelmates' ? 'var(--ink)' : p.color; }

  protected choose(i: number): void {
    this.running.set(false);
    this.current.set(i);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.products.length;
    const next = e.key === 'ArrowRight' ? (this.current() + 1) % n : e.key === 'ArrowLeft' ? (this.current() + n - 1) % n : null;
    if (next === null) return;
    e.preventDefault();
    this.choose(next);
    (document.getElementById('tab-' + this.products[next].id) as HTMLElement | null)?.focus();
  }
}
