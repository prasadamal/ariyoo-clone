import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, problemFrom } from '../core/api';

@Component({
  selector: 'app-newsletter-form',
  imports: [ReactiveFormsModule],
  template: `
    @if (state() === 'done') {
      <p class="ok" role="status">Thank you. You're on the list.</p>
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label for="nl-email" class="sr-only">Email address</label>
        <input id="nl-email" type="email" formControlName="email" placeholder="you@company.com" autocomplete="email" [attr.aria-invalid]="showError()" />
        <button type="submit" class="btn btn--light" [disabled]="state() === 'sending'">{{ state() === 'sending' ? 'Sending…' : 'Subscribe' }}</button>
      </form>
      @if (showError()) { <p class="err" role="alert">{{ message() || 'Please enter a valid email address.' }}</p> }
    }
  `,
  styles: `
    form { display: flex; gap: 10px; flex-wrap: wrap; }
    input { flex: 1 1 200px; min-width: 0; min-height: 48px; padding: 0 16px; border-radius: 999px; border: 1.5px solid rgba(234, 241, 238, 0.4); background: rgba(255, 255, 255, 0.07); color: #fff; font: inherit; }
    input::placeholder { color: var(--on-deep-soft); }
    input:focus { outline: none; border-color: var(--peach); }
    .ok { color: var(--peach); font-weight: 600; margin: 0; }
    .err { color: #ffb4ab; margin: 8px 0 0; font-size: 0.92rem; }
  `,
})
export class NewsletterForm {
  private readonly api = inject(ApiService);
  protected readonly form = inject(FormBuilder).nonNullable.group({ email: ['', [Validators.required, Validators.email]] });
  protected readonly state = signal<'idle' | 'sending' | 'done' | 'error'>('idle');
  protected readonly message = signal('');
  private touched = signal(false);

  protected showError = () => this.state() === 'error' || (this.touched() && this.form.invalid);

  submit(): void {
    this.touched.set(true);
    if (this.form.invalid || this.state() === 'sending') return;
    this.state.set('sending');
    this.message.set('');
    this.api.subscribe(this.form.getRawValue().email.trim()).subscribe({
      next: () => this.state.set('done'),
      error: e => { this.message.set(problemFrom(e).fields['email'] ?? problemFrom(e).message); this.state.set('error'); },
    });
  }
}
