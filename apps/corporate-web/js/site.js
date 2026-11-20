// Runs on every page: mobile menu, current-page marker and footer year.
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
