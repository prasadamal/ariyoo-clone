import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, problemFrom } from '../core/api';

export const TOPICS = [
  { value: 'general', label: 'General enquiry' },
  { value: 'partnership', label: 'Partnerships' },
  { value: 'investor', label: 'Investors' },
  { value: 'press', label: 'Press and media' },
  { value: 'support', label: 'Support' },
  { value: 'careers', label: 'Careers' },
] as const;

@Component({
  selector: 'app-contact-form',
  imports: [ReactiveFormsModule],
  template: `
    @if (state() === 'done') {
      <div class="notice notice--ok" role="status">Thank you. We have your message and will reply to {{ sentTo() }} as soon as we can.</div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (state() === 'error') { <div class="notice notice--bad" role="alert">{{ message() }}</div> }
        <div class="field" [class.field--error]="bad('name')">
          <label for="c-name">Your name</label>
          <input id="c-name" formControlName="name" autocomplete="name" [attr.aria-invalid]="bad('name')" />
          @if (bad('name')) { <span class="field-error">{{ err('name', 'Please tell us your name.') }}</span> }
        </div>
        <div class="field" [class.field--error]="bad('email')">
          <label for="c-email">Work email</label>
          <input id="c-email" type="email" formControlName="email" autocomplete="email" [attr.aria-invalid]="bad('email')" />
          @if (bad('email')) { <span class="field-error">{{ err('email', 'Please enter a valid email address.') }}</span> }
        </div>
        <div class="field">
          <label for="c-org">Organisation (optional)</label>
          <input id="c-org" formControlName="organisation" autocomplete="organization" />
        </div>
        <div class="field" [class.field--error]="bad('topic')">
          <label for="c-topic">What is this about?</label>
          <select id="c-topic" formControlName="topic">
            @for (t of topics; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
          </select>
        </div>
        <div class="field" [class.field--error]="bad('message')">
          <label for="c-message">Message</label>
          <textarea id="c-message" formControlName="message" [attr.aria-invalid]="bad('message')"></textarea>
          @if (bad('message')) { <span class="field-error">{{ err('message', 'Please write a few sentences (at least 10 characters).') }}</span> }
        </div>
        <div class="hp" aria-hidden="true">
          <label for="c-website">Leave this empty</label>
          <input id="c-website" formControlName="website" tabindex="-1" autocomplete="off" />
        </div>
        <button type="submit" class="btn btn--primary" [disabled]="state() === 'sending'">{{ state() === 'sending' ? 'Sending…' : 'Send message' }}</button>
        <p class="muted small">We use your details only to reply to you. See our <a href="/legal">privacy information</a>.</p>
      </form>
    }
  `,
  styles: `.small { font-size: 0.88rem; margin-top: 14px; }`,
})
export class ContactForm {
  private readonly api = inject(ApiService);
  readonly topic = input<string>('general');
  protected readonly topics = TOPICS;
  protected readonly state = signal<'idle' | 'sending' | 'done' | 'error'>('idle');
  protected readonly message = signal('');
  protected readonly sentTo = signal('');
  private readonly serverFields = signal<Record<string, string>>({});

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    organisation: ['', Validators.maxLength(160)],
    topic: ['general', Validators.required],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]],
    website: [''],
  });

  protected bad(name: 'name' | 'email' | 'topic' | 'message'): boolean {
    const c = this.form.controls[name];
    return (c.invalid && (c.touched || c.dirty)) || !!this.serverFields()[name];
  }

  protected err(name: string, fallback: string): string {
    return this.serverFields()[name] ?? fallback;
  }

  submit(): void {
    this.serverFields.set({});
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.state() === 'sending') return;
    this.state.set('sending');
    const v = this.form.getRawValue();
    this.api.contact({ ...v, name: v.name.trim(), email: v.email.trim(), message: v.message.trim(), organisation: v.organisation.trim() || undefined }).subscribe({
      next: () => { this.sentTo.set(v.email.trim()); this.state.set('done'); },
      error: e => {
        const p = problemFrom(e);
        this.serverFields.set(p.fields);
        this.message.set(p.message);
        this.state.set('error');
      },
    });
  }
}
