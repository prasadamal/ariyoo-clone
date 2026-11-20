import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { problemFrom } from './core/api';
import { COMPANY } from './core/company';
import { ContactForm } from './forms/contact-form';
import { Careers } from './pages/careers';
import { Press } from './pages/press';
import { HttpErrorResponse } from '@angular/common/http';

const setup = () => TestBed.configureTestingModule({
  providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
});

describe('App shell', () => {
  it('shows the header, a main landmark and the footer with the company address', async () => {
    await setup().compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('header')).toBeTruthy();
    expect(el.querySelector('main#main')).toBeTruthy();
    expect(el.querySelector('footer')?.textContent).toContain('Nagavarapalaya');
    expect(el.querySelector('footer')?.textContent).toContain(COMPANY.email);
  });

  it('has a skip link and a labelled primary navigation', async () => {
    await setup().compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a.skip')?.getAttribute('href')).toBe('#main');
    expect(el.querySelector('nav[aria-label="Primary"]')).toBeTruthy();
  });
});

describe('Routes', () => {
  it('give every page a title and a description, and keep the 404 out of search', () => {
    for (const r of routes) {
      expect(r.title).toBeTruthy();
      expect(r.data).toBeTruthy();
    }
    const missing = routes.find(r => r.path === '**')!;
    expect(missing.data!['noindex']).toBe(true);
    for (const r of routes.filter(r => r.path !== '**')) {
      expect((r.data!['description'] as string).length).toBeGreaterThan(40);
      expect((r.data!['description'] as string).length).toBeLessThan(200);
    }
  });
});

describe('Founders and facts', () => {
  it('lists the three co-founders', () => {
    expect(COMPANY.founders.map(f => f.name)).toEqual(['Amal Prasad', 'Akshay K Vijayan', 'Arif K']);
  });
});

describe('Contact form', () => {
  it('does not send an invalid form and shows messages for the missing fields', async () => {
    await setup().compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ContactForm);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    http.expectNone(() => true);
    expect(el.textContent).toContain('Please tell us your name.');
    expect(el.textContent).toContain('valid email');
    expect(el.textContent).toContain('at least 10 characters');
  });

  it('sends the message once, and thanks the sender', async () => {
    await setup().compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ContactForm);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const set = (id: string, value: string) => { const i = el.querySelector<HTMLInputElement>('#' + id)!; i.value = value; i.dispatchEvent(new Event('input')); };
    set('c-name', '  Priya Nair '); set('c-email', 'priya@example.com'); set('c-message', 'We would like to discuss a partnership.');
    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    form.dispatchEvent(new Event('submit')); // a double tap must not send twice
    await fixture.whenStable();
    const req = http.expectOne(r => r.url.endsWith('/contact'));
    expect(req.request.body.name).toBe('Priya Nair');
    expect(req.request.body.topic).toBe('general');
    req.flush({ received: true }, { status: 202, statusText: 'Accepted' });
    await fixture.whenStable();
    expect(el.textContent).toContain('Thank you');
    expect(el.textContent).toContain('priya@example.com');
  });

  it('keeps what was typed and shows the server message when sending fails', async () => {
    await setup().compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ContactForm);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const set = (id: string, value: string) => { const i = el.querySelector<HTMLInputElement>('#' + id)!; i.value = value; i.dispatchEvent(new Event('input')); };
    set('c-name', 'Priya'); set('c-email', 'priya@example.com'); set('c-message', 'A long enough message for the form.');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    http.expectOne(r => r.url.endsWith('/contact')).flush({ message: 'Too many requests. Please wait a minute and try again.' }, { status: 429, statusText: 'Too Many Requests' });
    await fixture.whenStable();
    expect(el.textContent).toContain('Too many requests');
    expect(el.querySelector<HTMLTextAreaElement>('#c-message')!.value).toContain('long enough');
  });
});

describe('API problems', () => {
  it('turn failures into sentences a visitor can act on', () => {
    expect(problemFrom(new HttpErrorResponse({ status: 0 })).message).toContain('could not reach');
    expect(problemFrom(new HttpErrorResponse({ status: 429 })).message).toContain('wait a minute');
    const v = problemFrom(new HttpErrorResponse({ status: 400, error: { message: 'Please check the highlighted fields.', fields: { email: 'Bad' } } }));
    expect(v.fields['email']).toBe('Bad');
    expect(problemFrom('weird').message).toContain('Something went wrong');
  });
});

describe('Careers and press pages', () => {
  it('say so plainly when there is nothing listed yet', async () => {
    await setup().compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const careers = TestBed.createComponent(Careers);
    const press = TestBed.createComponent(Press);
    await careers.whenStable(); await press.whenStable();
    http.expectOne(r => r.url.endsWith('/jobs')).flush([]);
    http.expectOne(r => r.url.endsWith('/press')).flush([]);
    await careers.whenStable(); await press.whenStable();
    expect((careers.nativeElement as HTMLElement).textContent).toContain('no open roles');
    expect((press.nativeElement as HTMLElement).textContent).toContain('no announcements yet');
  });

  it('list published roles and lead the application to the chosen role', async () => {
    await setup().compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Careers);
    await fixture.whenStable();
    http.expectOne(r => r.url.endsWith('/jobs')).flush([{ id: 1, slug: 'backend-engineer', title: 'Backend Engineer', team: 'Engineering', location: 'Bengaluru', employment: 'Full-time', summary: 'Build the services.' }]);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Backend Engineer');
    el.querySelector<HTMLButtonElement>('button.btn')!.click();
    await fixture.whenStable();
    expect(el.textContent).toContain('Apply: Backend Engineer');
  });

  it('show an apology, not a blank page, when the API is down', async () => {
    await setup().compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Careers);
    await fixture.whenStable();
    http.expectOne(r => r.url.endsWith('/jobs')).error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('could not load our open roles');
  });
});
