// Runs on every page: mobile menu, current-page marker, footer year and the newsletter form.
import { api } from './api.js';
import { isEmail } from './lib/validate.js';

const toggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('primary-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}

// Mark the current page in the menu.
const here = location.pathname.split('/').pop() || 'index.html';
for (const link of document.querySelectorAll('.nav a')) {
  if (link.getAttribute('href') === here) link.setAttribute('aria-current', 'page');
}

for (const el of document.querySelectorAll('[data-year]')) el.textContent = String(new Date().getFullYear());

// Footer newsletter.
const news = document.querySelector('.newsletter form');
if (news) {
  const input = news.querySelector('input[type="email"]');
  const button = news.querySelector('button');
  const error = document.querySelector('.newsletter .err');
  const thanks = document.querySelector('.newsletter .ok');
  let busy = false;
  news.noValidate = true;
  news.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    error.hidden = true;
    if (!isEmail(input.value)) {
      error.textContent = 'Please enter a valid email address.';
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    busy = true;
    button.disabled = true;
    try {
      await api.subscribe(input.value.trim());
      news.hidden = true;
      thanks.hidden = false;
    } catch (e) {
      error.textContent = e.problem?.fields?.email || e.message;
      error.hidden = false;
    } finally {
      busy = false;
      button.disabled = false;
    }
  });
}
