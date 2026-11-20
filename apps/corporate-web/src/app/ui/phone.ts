import { Component, input } from '@angular/core';

/** A simple phone frame around an app screenshot. */
@Component({
  selector: 'app-phone',
  template: `
    <div class="phone" [style.width.px]="width()">
      <div class="screen">
        @for (s of screens(); track s.src; let i = $index) {
          <img [src]="s.src" [alt]="i === active() ? s.alt : ''" [attr.aria-hidden]="i !== active()" [class.on]="i === active()"
               width="480" height="1039" [attr.loading]="eager() ? 'eager' : 'lazy'" decoding="async" />
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .phone { aspect-ratio: 390 / 844; border-radius: 34px; padding: 9px; background: #16101f; box-shadow: 0 30px 60px -20px rgba(12, 23, 20, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06) inset; }
    .screen { position: relative; width: 100%; height: 100%; border-radius: 26px; overflow: hidden; background: #fff; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; opacity: 0; transition: opacity 0.7s ease; }
    img.on { opacity: 1; }
  `,
})
export class Phone {
  readonly screens = input.required<{ src: string; alt: string }[]>();
  readonly active = input(0);
  readonly width = input(240);
  readonly eager = input(false);
}
