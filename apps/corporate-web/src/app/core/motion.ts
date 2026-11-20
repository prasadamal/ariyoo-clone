import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * One switch for everything that moves on the site. Moving content pauses for people who ask their
 * system for reduced motion, and anyone can pause it with the on-page control (WCAG 2.2.2).
 */
@Injectable({ providedIn: 'root' })
export class Motion {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly reduced = signal(this.browser && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  readonly paused = signal(this.reduced());

  toggle(): void { this.paused.update(p => !p); }
}
