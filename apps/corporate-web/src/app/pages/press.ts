import { DatePipe } from '@angular/common';
import { Component, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, PressSummary } from '../core/api';
import { COMPANY } from '../core/company';
import { PageHero } from '../ui/page-hero';

@Component({
  selector: 'app-press',
  imports: [DatePipe, RouterLink, PageHero],
  template: `
    <app-page-hero eyebrow="Press" title="News from Ariyoo." lede="Announcements, and how to reach us if you are writing about Ariyoo." />
    <section class="section">
      <div class="wrap">
        @switch (state()) {
          @case ('loading') { <p class="muted" role="status">Loading…</p> }
          @case ('error') { <p class="notice notice--bad" role="alert">We could not load our news just now. Please try again shortly.</p> }
          @default {
            @if (items().length) {
              <div class="list">
                @for (item of items(); track item.slug) {
                  <article class="card">
                    <p class="date">{{ item.publishedAt | date: 'd MMMM y' }}</p>
                    <h2><a [routerLink]="['/press', item.slug]">{{ item.title }}</a></h2>
                    <p>{{ item.summary }}</p>
                  </article>
                }
              </div>
            } @else {
              <p class="lede">There are no announcements yet. We will publish news here as it happens.</p>
            }
          }
        }
        <div class="card media">
          <h2>Media enquiries</h2>
          <p>For interviews, background or assets, write to <a [href]="'mailto:' + company.email + '?subject=Media%20enquiry'">{{ company.email }}</a>.</p>
        </div>
      </div>
    </section>
  `,
  styles: `
    .list { display: grid; gap: 18px; margin-bottom: 40px; }
    .list h2 { font-size: 1.6rem; }
    .list h2 a { color: var(--ink); text-decoration: none; }
    .list h2 a:hover { color: var(--green-strong); text-decoration: underline; }
    .date { color: var(--ink-faint); font-weight: 600; font-size: 0.92rem; margin-bottom: 6px; }
    .media { margin-top: 24px; }
    .media h2 { font-size: 1.4rem; }
  `,
})
export class Press {
  private readonly api = inject(ApiService);
  protected readonly company = COMPANY;
  protected readonly items = signal<PressSummary[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');

  constructor() {
    afterNextRender(() => {
      this.api.press().subscribe({
        next: items => { this.items.set(items); this.state.set('ready'); },
        error: () => this.state.set('error'),
      });
    });
  }
}
