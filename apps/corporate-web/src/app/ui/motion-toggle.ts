import { Component, inject } from '@angular/core';
import { Motion } from '../core/motion';

@Component({
  selector: 'app-motion-toggle',
  template: `
    <button type="button" (click)="motion.toggle()" [attr.aria-pressed]="motion.paused()">
      @if (motion.paused()) {
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg> Play animations
      } @else {
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg> Pause animations
      }
    </button>
  `,
  styles: `
    button { display: inline-flex; align-items: center; gap: 8px; background: transparent; border: 1px solid currentColor; color: inherit; opacity: 0.8; border-radius: 999px; padding: 7px 14px; font: 600 0.82rem/1 var(--font-body); cursor: pointer; }
    button:hover { opacity: 1; }
  `,
})
export class MotionToggle {
  protected readonly motion = inject(Motion);
}
