import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <section class="section">
      <div class="wrap prose">
        <p class="eyebrow">Error 404</p>
        <h1>We couldn't find that page.</h1>
        <p class="lede">The link may be old or mistyped. Try one of these instead.</p>
        <div class="btn-row">
          <a routerLink="/" class="btn btn--primary">Home</a>
          <a routerLink="/contact" class="btn btn--ghost">Contact us</a>
        </div>
      </div>
    </section>
  `,
})
export class NotFound {}
