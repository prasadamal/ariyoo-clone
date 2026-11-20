// One switch for everything that moves. Off for visitors who ask their system for reduced motion,
// and anyone can pause it with the on-page control (WCAG 2.2.2).
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused = reduced;
const listeners = new Set();

export function isPaused() {
  return paused;
}

export function onChange(fn) {
  listeners.add(fn);
}

function render() {
  document.body.classList.toggle('is-paused', paused);
  for (const button of document.querySelectorAll('[data-motion-toggle]')) {
    button.setAttribute('aria-pressed', String(paused));
    button.querySelector('[data-label]').textContent = paused ? 'Play animations' : 'Pause animations';
    button.querySelector('[data-icon-pause]').hidden = paused;
    button.querySelector('[data-icon-play]').hidden = !paused;
  }
}

export function setPaused(value) {
  paused = value;
  render();
  listeners.forEach(fn => fn(paused));
}

for (const button of document.querySelectorAll('[data-motion-toggle]')) {
  button.addEventListener('click', () => setPaused(!paused));
}
render();
