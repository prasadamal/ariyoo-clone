import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, problemFrom } from '../core/api';

@Component({
  selector: 'app-application-form',
  imports: [ReactiveFormsModule],
  template: `
    @if (state() === 'done') {
      <div class="notice notice--ok" role="status">Thank you for applying. Our team reads every application and will be in touch.</div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (state() === 'error') { <div class="notice notice--bad" role="alert">{{ message() }}</div> }
        <div class="field" [class.field--error]="bad('name')">
          <label for="a-name">Full name</label>
          <input id="a-name" formControlName="name" autocomplete="name" />
          @if (bad('name')) { <span class="field-error">{{ err('name', 'Please tell us your name.') }}</span> }
        </div>
        <div class="field" [class.field--error]="bad('email')">
          <label for="a-email">Email</label>
          <input id="a-email" type="email" formControlName="email" autocomplete="email" />
          @if (bad('email')) { <span class="field-error">{{ err('email', 'Please enter a valid email address.') }}</span> }
        </div>
        <div class="field" [class.field--error]="bad('profileUrl')">
          <label for="a-link">Link to your work or profile (optional)</label>
          <input id="a-link" type="url" formControlName="profileUrl" placeholder="https://" />
          @if (bad('profileUrl')) { <span class="field-error">{{ err('profileUrl', 'Please enter a full link starting with https://') }}</span> }
        </div>
        <div class="field" [class.field--error]="bad('message')">
          <label for="a-message">Tell us about yourself</label>
          <textarea id="a-message" formControlName="message"></textarea>
          @if (bad('message')) { <span class="field-error">{{ err('message', 'Please write at least 20 characters.') }}</span> }
        </div>
        <div class="hp" aria-hidden="true"><label for="a-website">Leave this empty</label><input id="a-website" formControlName="website" tabindex="-1" autocomplete="off" /></div>
        <button type="submit" class="btn btn--primary" [disabled]="state() === 'sending'">{{ state() === 'sending' ? 'Sending…' : 'Send application' }}</button>
      </form>
    }
  `,
})
export class ApplicationForm {
  private readonly api = inject(ApiService);
  /** Slug of the role being applied for; empty for an open application. */
  readonly jobSlug = input<string>('');
  protected readonly state = signal<'idle' | 'sending' | 'done' | 'error'>('idle');
  protected readonly message = signal('');
  private readonly serverFields = signal<Record<string, string>>({});
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    profileUrl: ['', Validators.pattern(/^$|^https?:\/\/\S{3,480}$/)],
    message: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(4000)]],
    website: [''],
  });

  protected bad(name: 'name' | 'email' | 'profileUrl' | 'message'): boolean {
    const c = this.form.controls[name];
    return (c.invalid && (c.touched || c.dirty)) || !!this.serverFields()[name];
  }

  protected err(name: string, fallback: string): string { return this.serverFields()[name] ?? fallback; }

  submit(): void {
    this.serverFields.set({});
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.state() === 'sending') return;
    this.state.set('sending');
    const v = this.form.getRawValue();
    this.api.apply({ ...v, jobSlug: this.jobSlug() || undefined, name: v.name.trim(), email: v.email.trim(), profileUrl: v.profileUrl.trim(), message: v.message.trim() }).subscribe({
      next: () => this.state.set('done'),
      error: e => { const p = problemFrom(e); this.serverFields.set(p.fields); this.message.set(p.message); this.state.set('error'); },
    });
  }
}
