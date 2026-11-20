import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Motion } from './core/motion';
import { PRODUCTS } from './core/products';
import { AppShowcase } from './ui/app-showcase';
import { MotionToggle } from './ui/motion-toggle';
import { ScreenMarquee } from './ui/screen-marquee';

describe('Our apps', () => {
  it('lists Ariyoo, Wayfare and ReelMates, each with three screens that have descriptions', () => {
    expect(PRODUCTS.map(p => p.name)).toEqual(['Ariyoo', 'Wayfare', 'ReelMates']);
    for (const p of PRODUCTS) {
      expect(p.screens.length).toBe(3);
      for (const s of p.screens) {
        expect(s.src).toMatch(/^apps\/.+\.webp$/);
        expect(s.alt.length).toBeGreaterThan(10);
      }
      expect(p.features.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('Moving content', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('can be paused and resumed from one control', async () => {
    const fixture = TestBed.createComponent(MotionToggle);
    await fixture.whenStable();
    const motion = TestBed.inject(Motion);
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    const wasPaused = motion.paused();
    button.click(); await fixture.whenStable();
    expect(motion.paused()).toBe(!wasPaused);
    expect(button.getAttribute('aria-pressed')).toBe(String(!wasPaused));
    button.click(); await fixture.whenStable();
    expect(motion.paused()).toBe(wasPaused);
  });

  it('the screen strip hides its repeated copy from screen readers', async () => {
    const fixture = TestBed.createComponent(ScreenMarquee);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const items = el.querySelectorAll('li');
    expect(items.length).toBe(18);
    expect(el.querySelectorAll('li[aria-hidden="true"]').length).toBe(9);
    expect(el.querySelectorAll('img[alt=""]').length).toBe(9);
  });

  it('the showcase is a proper tab list that arrow keys move through', async () => {
    const fixture = TestBed.createComponent(AppShowcase);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const tabs = () => Array.from(el.querySelectorAll<HTMLElement>('[role=tab]'));
    expect(tabs().map(t => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    el.querySelector('[role=tablist]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await fixture.whenStable();
    expect(tabs()[2].getAttribute('aria-selected')).toBe('true');
    expect(el.querySelectorAll('[role=tabpanel]:not([hidden])').length).toBe(1);
    expect(el.querySelector('[role=tabpanel]:not([hidden]) h3')?.textContent).toContain('films');
  });
});
