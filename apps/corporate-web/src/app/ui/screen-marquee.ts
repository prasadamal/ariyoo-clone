import { Component, inject } from '@angular/core';
import { Motion } from '../core/motion';
import { PRODUCTS } from '../core/products';

/** A continuous strip of app screens, like a live ad. Pauses on hover, on focus, or with the page control. */
@Component({
  selector: 'app-screen-marquee',
  template: `
    <div class="viewport" [class.paused]="motion.paused()" aria-label="Screens from Ariyoo, Wayfare and ReelMates" role="region">
      <ul class="track">
        @for (pass of [0, 1]; track pass) {
          @for (item of items; track item.src) {
            <li [attr.aria-hidden]="pass === 1">
              <figure>
                <div class="frame"><img [src]="item.src" [alt]="pass === 0 ? item.alt : ''" width="480" height="1039" loading="lazy" decoding="async" /></div>
                <figcaption><span class="dot" [style.background]="item.color"></span>{{ item.app }}</figcaption>
              </figure>
            </li>
          }
        }
      </ul>
    </div>
  `,
  styles: `
    .viewport { overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
    .track { display: flex; gap: 28px; list-style: none; margin: 0; padding: 12px 0 8px; width: max-content; animation: slide 60s linear infinite; }
    .viewport:hover .track, .viewport:focus-within .track, .viewport.paused .track { animation-play-state: paused; }
    @keyframes slide { from { transform: translateX(0); } to { transform: translateX(calc(-50% - 14px)); } }
    @media (prefers-reduced-motion: reduce) { .track { animation: none; } .viewport { overflow-x: auto; } }
    figure { margin: 0; width: 200px; }
    .frame { aspect-ratio: 390 / 844; border-radius: 26px; padding: 7px; background: #16101f; box-shadow: 0 18px 40px -18px rgba(12, 23, 20, 0.5); }
    img { width: 100%; height: 100%; object-fit: cover; object-position: top; border-radius: 20px; display: block; }
    figcaption { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; font-weight: 700; font-size: 0.9rem; color: var(--ink-soft); }
    .dot { width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15); }
  `,
})
export class ScreenMarquee {
  protected readonly motion = inject(Motion);
  // Interleave the apps so the strip alternates Ariyoo, Wayfare, ReelMates.
  protected readonly items = [0, 1, 2].flatMap(i => PRODUCTS.map(p => ({ ...p.screens[i], app: p.name, color: p.color })));
}
