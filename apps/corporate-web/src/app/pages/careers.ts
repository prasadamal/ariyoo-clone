import { Component, afterNextRender, inject, signal } from '@angular/core';
import { ApiService, Job } from '../core/api';
import { ApplicationForm } from '../forms/application-form';
import { PageHero } from '../ui/page-hero';

@Component({
  selector: 'app-careers',
  imports: [PageHero, ApplicationForm],
  template: `
    <app-page-hero eyebrow="Careers" title="Help people find the answers that matter." lede="We are a small team building something we want to exist. If that sounds like your kind of work, we would like to meet you." />

    <section class="section">
      <div class="wrap">
        <h2>Open roles</h2>
        @switch (state()) {
          @case ('loading') { <p class="muted" role="status">Loading roles…</p> }
          @case ('error') { <p class="notice notice--bad" role="alert">We could not load our open roles just now. You can still send an open application below.</p> }
          @default {
            @if (jobs().length) {
              <div class="roles">
                @for (job of jobs(); track job.slug) {
                  <article class="card role">
                    <div>
                      <h3>{{ job.title }}</h3>
                      <p class="meta">{{ job.team }} · {{ job.location }} · {{ job.employment }}</p>
                      <p>{{ job.summary }}</p>
                    </div>
                    <button type="button" class="btn btn--primary" (click)="select(job)">Apply for this role</button>
                  </article>
                }
              </div>
            } @else {
              <p class="lede">We have no open roles listed right now, but we are always glad to hear from capable people. Tell us what you would like to work on.</p>
            }
          }
        }
      </div>
    </section>

    <section class="section section--alt" id="apply">
      <div class="wrap narrow">
        <h2>{{ selected() ? 'Apply: ' + selected()!.title : 'Open application' }}</h2>
        @if (selected()) { <p><button type="button" class="link" (click)="selected.set(null)">Apply without a specific role instead</button></p> }
        @for (key of [selected()?.slug ?? '']; track key) {
          <app-application-form [jobSlug]="key" />
        }
      </div>
    </section>
  `,
  styles: `
    .roles { display: grid; gap: 18px; margin-top: 24px; }
    .role { display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap; }
    .meta { color: var(--ink-faint); font-weight: 600; font-size: 0.95rem; }
    .narrow { max-width: 680px; }
    .link { background: none; border: 0; padding: 0; color: var(--brand-strong); font: inherit; text-decoration: underline; cursor: pointer; }
  `,
})
export class Careers {
  private readonly api = inject(ApiService);
  protected readonly jobs = signal<Job[]>([]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly selected = signal<Job | null>(null);

  constructor() {
    // Roles load in the browser, so the page itself is prerendered and fast.
    afterNextRender(() => {
      this.api.jobs().subscribe({
        next: jobs => { this.jobs.set(jobs); this.state.set('ready'); },
        error: () => this.state.set('error'),
      });
    });
  }

  protected select(job: Job): void {
    this.selected.set(job);
    // Uses the page's own scroll-behavior setting, which respects reduced-motion preferences.
    document.getElementById('apply')?.scrollIntoView?.({ block: 'start' });
  }
}
