import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMPANY } from '../core/company';
import { PageHero } from '../ui/page-hero';

@Component({
  selector: 'app-about',
  imports: [RouterLink, PageHero],
  template: `
    <app-page-hero eyebrow="Company" title="Making local knowledge easy to ask for and safe to trust." lede="Ariyoo is a technology company based in Bengaluru, India." />

    <section class="section">
      <div class="wrap prose">
        <h2>Why we exist</h2>
        <p>The most useful answers about a place rarely sit on a search results page. They are in the heads of people who live there: which neighbourhood is safe after dark, which clinic is honest, which shortcut is not a shortcut at all.</p>
        <p>Ariyoo makes those answers available to anyone who asks, and makes it worth the while of the people who give them. We do it with a product that treats safety and privacy as the foundation, because a platform where strangers talk has to earn trust before it can ask for it.</p>
      </div>
    </section>

    <section class="section section--alt">
      <div class="wrap">
        <p class="eyebrow">What we value</p>
        <h2>How we work.</h2>
        <div class="grid grid--3">
          <div class="card"><h3>Local first</h3><p>We start where we are. The first questions on Ariyoo are about the places our team knows best.</p></div>
          <div class="card"><h3>Trust is a feature</h3><p>Reporting, blocking, moderation and data deletion are part of the product, not an afterthought.</p></div>
          <div class="card"><h3>Plain language</h3><p>For our users and for each other. Clear writing, clear promises and no surprises.</p></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <p class="eyebrow">Leadership</p>
        <h2>The founding team.</h2>
        <div class="grid grid--3 team">
          @for (f of founders; track f.name) {
            <article class="card person">
              <div class="avatar" aria-hidden="true">{{ f.initials }}</div>
              <h3>{{ f.name }}</h3>
              <p class="muted">Co-founder</p>
            </article>
          }
        </div>
      </div>
    </section>

    <section class="section section--deep">
      <div class="wrap">
        <h2>Visit or write to us.</h2>
        <address>
          @for (line of company.address; track line) { {{ line }}<br /> }
          <a [href]="'mailto:' + company.email">{{ company.email }}</a>
        </address>
        <div class="btn-row">
          <a routerLink="/contact" class="btn btn--light">Contact us</a>
          <a routerLink="/careers" class="btn btn--ghost">Join the team</a>
        </div>
      </div>
    </section>
  `,
  styles: `
    .person { text-align: left; }
    .avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--green-wash); color: var(--green-strong); display: grid; place-items: center; font: 700 1.3rem/1 var(--font-display); margin-bottom: 18px; border: 1px solid #b6dccd; }
    address { font-style: normal; font-size: 1.15rem; line-height: 1.8; }
  `,
})
export class About {
  protected readonly company = COMPANY;
  protected readonly founders = COMPANY.founders;
}
