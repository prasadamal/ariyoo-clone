import { Component } from '@angular/core';
import { COMPANY } from '../core/company';
import { ContactForm } from '../forms/contact-form';
import { PageHero } from '../ui/page-hero';

@Component({
  selector: 'app-contact',
  imports: [PageHero, ContactForm],
  template: `
    <app-page-hero eyebrow="Contact" title="Let's talk." lede="Partnerships, investment, press, support or just a question about Ariyoo: write to us and a person will reply." />
    <section class="section">
      <div class="wrap layout">
        <div class="card"><app-contact-form /></div>
        <aside>
          <h2>Our office</h2>
          <address>
            @for (line of company.address; track line) { {{ line }}<br /> }
          </address>
          <h2>Email</h2>
          <p><a [href]="'mailto:' + company.email">{{ company.email }}</a></p>
          <h2>In the Ariyoo app</h2>
          <p class="muted">To report a person or a conversation, use the menu inside the conversation, so moderators can see exactly what happened.</p>
        </aside>
      </div>
    </section>
  `,
  styles: `
    .layout { display: grid; gap: clamp(28px, 5vw, 64px); grid-template-columns: 1.4fr 1fr; align-items: start; }
    aside h2 { font-size: 1.15rem; font-family: var(--font-body); font-weight: 700; letter-spacing: 0; margin: 28px 0 8px; }
    aside h2:first-child { margin-top: 0; }
    address { font-style: normal; line-height: 1.8; }
    @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class Contact {
  protected readonly company = COMPANY;
}
