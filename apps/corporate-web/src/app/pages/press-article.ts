import { DatePipe } from '@angular/common';
import { Component, afterNextRender, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiService, PressArticle } from '../core/api';

@Component({
  selector: 'app-press-article',
  imports: [DatePipe, RouterLink],
  template: `
    <section class="section">
      <div class="wrap prose">
        <p><a routerLink="/press">← All news</a></p>
        @switch (state()) {
          @case ('loading') { <p class="muted" role="status">Loading…</p> }
          @case ('missing') { <h1>We couldn't find that article.</h1><p>It may have been moved or removed. <a routerLink="/press">See all news</a>.</p> }
          @case ('error') { <p class="notice notice--bad" role="alert">We could not load this article. Please try again shortly.</p> }
          @default {
            @if (article(); as a) {
              <p class="date">{{ a.publishedAt | date: 'd MMMM y' }}</p>
              <h1>{{ a.title }}</h1>
              <p class="lede">{{ a.summary }}</p>
              @for (para of paragraphs(); track $index) { <p>{{ para }}</p> }
            }
          }
        }
      </div>
    </section>
  `,
  styles: `.date { color: var(--ink-faint); font-weight: 600; } h1 { font-size: clamp(2rem, 4vw, 3rem); }`,
})
export class PressArticleView {
  private readonly api = inject(ApiService);
  private readonly title = inject(Title);
  readonly slug = input.required<string>();
  protected readonly article = signal<PressArticle | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'missing' | 'error'>('loading');

  constructor() {
    afterNextRender(() => {
      this.api.article(this.slug()).subscribe({
        next: a => { this.article.set(a); this.state.set('ready'); this.title.setTitle(`${a.title} | Ariyoo`); },
        error: e => this.state.set(e?.status === 404 ? 'missing' : 'error'),
      });
    });
  }

  /** Plain text only: paragraphs are split on blank lines and never treated as HTML. */
  protected paragraphs(): string[] {
    return (this.article()?.body ?? '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  }
}
