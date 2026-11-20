import { Component } from '@angular/core';
import { COMPANY } from '../core/company';
import { PageHero } from '../ui/page-hero';

@Component({
  selector: 'app-trust',
  imports: [PageHero],
  template: `
    <app-page-hero eyebrow="Trust &amp; Safety" title="Strangers should be able to help each other safely." lede="Here is what Ariyoo does today to protect the people who use it. We describe what is in the product, and nothing we have not built." />

    <section class="section">
      <div class="wrap">
        <div class="grid grid--2">
          <article class="card">
            <h2>Safety in every conversation</h2>
            <ul>
              <li><strong>Report and block.</strong> Anyone can report a conversation or block a person at any time. Blocking closes the conversation for both sides.</li>
              <li><strong>Automatic filtering.</strong> Messages containing abusive or dangerous content are stopped before they are sent.</li>
              <li><strong>Moderation.</strong> Reports reach our moderators, who can review a report and suspend an account. A suspended account cannot sign in.</li>
              <li><strong>Terms acceptance.</strong> Everyone accepts the Terms of Use and community rules before creating an account.</li>
            </ul>
          </article>
          <article class="card">
            <h2>Privacy and data</h2>
            <ul>
              <li><strong>No tracking.</strong> The Ariyoo app contains no advertising and no analytics software, and does not collect your location, contacts or advertising identifier.</li>
              <li><strong>Private photos.</strong> A photo in a conversation can be opened only by the two people in it.</li>
              <li><strong>Your data, your call.</strong> You can delete your account in the app. Your conversations, including photos, are removed.</li>
              <li><strong>Not for sale.</strong> We do not sell personal information.</li>
            </ul>
          </article>
          <article class="card">
            <h2>Security</h2>
            <ul>
              <li>All connections use HTTPS.</li>
              <li>Passwords are stored hashed, never in plain text.</li>
              <li>Sign-in and public forms are rate-limited to slow down automated abuse.</li>
              <li>Each conversation is visible only to its two participants.</li>
            </ul>
          </article>
          <article class="card">
            <h2>Accountability for experts</h2>
            <ul>
              <li>Only the person who asked can close a question, and say whether the answer helped.</li>
              <li>An expert's public record is the count of questions they saw through and how many helped.</li>
              <li>Experts can be blocked, reported and suspended like anyone else.</li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <section class="section section--alt">
      <div class="wrap prose">
        <h2>Report a concern</h2>
        <p>In the app, use the menu in a conversation to report or block. To report a safety or security concern, or to tell us about a vulnerability, write to <a [href]="'mailto:' + company.email">{{ company.email }}</a>. Please include enough detail for us to find the issue, and do not include passwords.</p>
        <p>Read our full <a [href]="company.privacyUrl" rel="noopener">Privacy Policy</a> and <a [href]="company.termsUrl" rel="noopener">Terms of Use</a>.</p>
        <p class="muted">No system is perfectly secure. We are a young company and we will keep improving; if we get something wrong, we want to hear about it.</p>
      </div>
    </section>
  `,
  styles: `
    ul { padding-left: 1.1em; display: grid; gap: 12px; margin: 16px 0 0; }
    h2 { font-size: 1.5rem; }
  `,
})
export class Trust {
  protected readonly company = COMPANY;
}
