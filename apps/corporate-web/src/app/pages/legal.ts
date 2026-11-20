import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { COMPANY } from '../core/company';
import { PageHero } from '../ui/page-hero';

@Component({
  selector: 'app-legal',
  imports: [RouterLink, PageHero],
  template: `
    <app-page-hero eyebrow="Legal" title="Privacy, terms and your data." lede="The documents that govern how Ariyoo is used and how your information is handled." />
    <section class="section">
      <div class="wrap">
        <div class="grid grid--2">
          <article class="card">
            <h2>Privacy Policy</h2>
            <p>What we collect, why, who can see it, how long we keep it, and how to delete your account.</p>
            <a class="btn btn--ghost" [href]="company.privacyUrl" rel="noopener">Read the Privacy Policy</a>
          </article>
          <article class="card">
            <h2>Terms of Use</h2>
            <p>The rules for using Ariyoo, including the community standards everyone agrees to.</p>
            <a class="btn btn--ghost" [href]="company.termsUrl" rel="noopener">Read the Terms of Use</a>
          </article>
        </div>
        <div class="prose note">
          <h2>Questions about these documents</h2>
          <p>Write to us through the <a routerLink="/contact">contact page</a>. These documents cover the Ariyoo mobile apps; this website uses no advertising or analytics cookies.</p>
        </div>
      </div>
    </section>
  `,
  styles: `.note { margin-top: 48px; } h2 { font-size: 1.5rem; }`,
})
export class Legal {
  protected readonly company = COMPANY;
}
