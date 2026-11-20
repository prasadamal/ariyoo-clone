import { Component, input } from '@angular/core';

/** The opening block of every inner page. Buttons or links can be projected inside. */
@Component({
  selector: 'app-page-hero',
  template: `
    <section class="hero">
      <div class="wrap">
        <p class="eyebrow">{{ eyebrow() }}</p>
        <h1>{{ title() }}</h1>
        @if (lede()) { <p class="lede">{{ lede() }}</p> }
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    .hero { background: var(--deep); color: var(--on-deep); padding: clamp(64px, 10vw, 120px) 0 clamp(52px, 8vw, 96px); background-image: radial-gradient(900px 380px at 85% -10%, rgba(106, 0, 165, 0.35), transparent 70%); }
    .hero .eyebrow { color: var(--peach); }
    .hero h1 { max-width: 20ch; }
    .hero .lede { color: var(--on-deep-soft); }
    :host ::ng-deep .hero a:not(.btn) { color: var(--peach); }
  `,
})
export class PageHero {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly lede = input<string>('');
}
