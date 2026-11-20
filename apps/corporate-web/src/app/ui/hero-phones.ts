import { Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { Motion } from '../core/motion';
import { PRODUCTS } from '../core/products';
import { Phone } from './phone';

/** The home page's "live ad": one phone per app, each changing screen in turn. */
@Component({
  selector: 'app-hero-phones',
  imports: [Phone],
  template: `
    <div class="stage" role="img" aria-label="The Ariyoo, Wayfare and ReelMates apps">
      @for (p of products; track p.id; let i = $index) {
        <figure [class]="'slot slot-' + i" [style.--brand]="p.color">
          <app-phone [screens]="p.screens" [active]="shown()[i]" [width]="i === 1 ? 250 : 210" [eager]="true" />
          <figcaption><span class="chip">{{ p.name }}</span></figcaption>
        </figure>
      }
    </div>
  `,
  styles: `
    .stage { position: relative; height: 560px; }
    .slot { position: absolute; margin: 0; top: 0; }
    .slot::before { content: ''; position: absolute; inset: 15% -12% auto; height: 70%; background: radial-gradient(closest-side, color-mix(in srgb, var(--brand) 45%, transparent), transparent); filter: blur(8px); z-index: -1; }
    .slot-0 { left: 0; top: 70px; transform: rotate(-7deg); }
    .slot-1 { left: 50%; transform: translateX(-50%); z-index: 2; }
    .slot-2 { right: 0; top: 70px; transform: rotate(7deg); }
    figcaption { text-align: center; margin-top: 14px; }
    .chip { display: inline-block; background: rgba(255, 255, 255, 0.92); color: var(--ink); border-radius: 999px; padding: 6px 14px; font: 700 0.85rem/1 var(--font-body); box-shadow: 0 6px 18px -8px rgba(0, 0, 0, 0.4); }
    @media (max-width: 1100px) { .stage { height: 500px; } }
    @media (max-width: 560px) {
      .stage { height: 440px; }
      .slot-0 { left: -4%; top: 60px; } .slot-2 { right: -4%; top: 60px; }
      :host ::ng-deep .slot-0 .phone, :host ::ng-deep .slot-2 .phone { width: 150px !important; }
      :host ::ng-deep .slot-1 .phone { width: 200px !important; }
    }
  `,
})
export class HeroPhones {
  private readonly motion = inject(Motion);
  protected readonly products = PRODUCTS;
  /** Which screen each phone shows. */
  protected readonly shown = signal([0, 0, 0]);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      let turn = 0;
      const timer = setInterval(() => {
        if (this.motion.paused()) return;
        const phone = [1, 2, 0][turn++ % 3];
        this.shown.update(s => s.map((v, i) => (i === phone ? (v + 1) % 3 : v)));
      }, 2600);
      destroyRef.onDestroy(() => clearInterval(timer));
    });
  }
}
