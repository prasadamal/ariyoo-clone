import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PRODUCTS } from '../core/products';
import { AppShowcase } from '../ui/app-showcase';
import { HeroPhones } from '../ui/hero-phones';
import { MotionToggle } from '../ui/motion-toggle';
import { ScreenMarquee } from '../ui/screen-marquee';

@Component({
  selector: 'app-home',
  imports: [RouterLink, HeroPhones, ScreenMarquee, AppShowcase, MotionToggle],
  template: `
    <section class="hero">
      <div class="wrap grid-hero">
        <div class="copy">
          <p class="eyebrow">Ariyoo · Bengaluru</p>
          <h1>Apps that make everyday life a little <span class="mark">easier.</span></h1>
          <p class="lede">Ariyoo is the company behind <strong>Ariyoo</strong>, <strong>Wayfare</strong> and <strong>ReelMates</strong>: three apps for local answers, travel and film, designed for safety and privacy from the first screen.</p>
          <div class="btn-row">
            <a routerLink="/product" class="btn btn--primary">Explore our apps</a>
            <a routerLink="/contact" class="btn btn--ghost">Talk to our team</a>
          </div>
          <ul class="apps" aria-label="Our apps">
            @for (p of products; track p.id) {
              <li><span class="dot" [style.background]="p.color"></span><strong>{{ p.name }}</strong> <span class="muted">{{ p.category }}</span></li>
            }
          </ul>
        </div>
        <app-hero-phones />
      </div>
    </section>

    <section class="section live">
      <div class="wrap head">
        <div>
          <p class="eyebrow">See them in action</p>
          <h2>Real screens from our apps.</h2>
        </div>
        <app-motion-toggle />
      </div>
      <app-screen-marquee />
    </section>

    <section class="section section--alt">
      <div class="wrap">
        <p class="eyebrow">Our apps</p>
        <h2>Three apps, one standard of care.</h2>
        <app-showcase />
      </div>
    </section>

    <section class="section section--deep">
      <div class="wrap">
        <p class="eyebrow">How we build</p>
        <h2>The same commitments in every app.</h2>
        <div class="grid grid--3 principles">
          <div><h3>Safety tools built in</h3><p>Every app lets people report and block. Problems reach a person who can act on them, not a dead inbox.</p></div>
          <div><h3>Your data stays yours</h3><p>Every app lets you delete your account from inside the app. No hunting through settings pages or sending emails.</p></div>
          <div><h3>Made for real life</h3><p>Answers from people who live there, a journal that works without signal, film picks that take seconds. Useful first, clever second.</p></div>
        </div>
        <div class="btn-row"><a routerLink="/trust" class="btn btn--ghost">Read about Trust &amp; Safety</a></div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <p class="eyebrow">Work with us</p>
        <h2>For partners, investors and future teammates.</h2>
        <div class="grid grid--3">
          <article class="card"><h3>Partners</h3><p>Tourism boards, venues, cinemas, travel companies: if our users would value what you offer, let's talk.</p><a routerLink="/contact">Start a conversation</a></article>
          <article class="card"><h3>Investors</h3><p>Three focused consumer products from one small team in Bengaluru. We are happy to share where we are and where we are going.</p><a routerLink="/contact">Get in touch</a></article>
          <article class="card"><h3>Careers</h3><p>We are a small team that ships. If you care about useful, trustworthy software, we would like to meet you.</p><a routerLink="/careers">See careers</a></article>
        </div>
      </div>
    </section>

    <section class="section cta-wrap">
      <div class="wrap">
        <div class="cta">
          <h2>Let's build something people rely on.</h2>
          <a routerLink="/contact" class="btn btn--light">Contact us</a>
        </div>
      </div>
    </section>
  `,
  styles: `
    .hero { padding: clamp(48px, 7vw, 96px) 0 clamp(40px, 6vw, 80px); background: radial-gradient(900px 500px at 85% 20%, rgba(106, 0, 165, 0.08), transparent 70%), var(--paper); overflow: hidden; }
    .grid-hero { display: grid; grid-template-columns: 1fr 1.05fr; gap: clamp(24px, 4vw, 56px); align-items: center; }
    .hero h1 { font-size: clamp(2.5rem, 5vw, 4.2rem); max-width: 14ch; }
    .hero .lede { color: var(--ink-soft); }
    .mark { background: linear-gradient(transparent 68%, color-mix(in srgb, var(--peach) 55%, transparent) 68%, color-mix(in srgb, var(--peach) 55%, transparent) 92%, transparent 92%); padding: 0 0.04em; }
    .hero .lede strong { color: var(--ink); }
    .apps { list-style: none; padding: 0; margin: 32px 0 0; display: flex; flex-wrap: wrap; gap: 10px 24px; }
    .apps li { display: inline-flex; align-items: center; gap: 8px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18); }
    .live { padding-bottom: clamp(40px, 6vw, 72px); }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
    .head h2 { margin: 0; }
    .head app-motion-toggle { color: var(--ink-soft); }
    .principles { margin-top: 36px; }
    .principles h3 { color: var(--on-deep); }
    .principles p { color: var(--on-deep-soft); }
    .card a { font-weight: 600; }
    .cta-wrap { padding-top: 0; }
    .cta { background: var(--deep); color: var(--on-deep); border-radius: 28px; padding: clamp(32px, 5vw, 56px); display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap; background-image: radial-gradient(600px 300px at 90% 0%, rgba(106, 0, 165, 0.45), transparent 70%); }
    .cta h2 { margin: 0; max-width: 20ch; }
    @media (max-width: 960px) { .grid-hero { grid-template-columns: 1fr; } }
  `,
})
export class Home {
  protected readonly products = PRODUCTS;
}
