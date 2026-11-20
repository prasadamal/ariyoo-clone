// Home page: the hero phones and the tabbed app showcase.
import { isPaused, onChange } from './motion.js';
import { heroStep, showcaseTick } from './lib/rotation.js';

// Hero: one phone per app, changing screen in turn.
const slots = [...document.querySelectorAll('.hero-phones .phone')];
let shown = slots.map(() => 0);
let turn = 0;
setInterval(() => {
  if (isPaused()) return;
  shown = heroStep(shown, turn++);
  slots.forEach((phone, i) => {
    phone.querySelectorAll('img').forEach((img, j) => {
      img.classList.toggle('on', j === shown[i]);
    });
  });
}, 2600);

// Showcase: advances every 7 seconds, stops for good once someone picks a tab.
const tabs = [...document.querySelectorAll('.showcase [role="tab"]')];
const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
const STEP = 100;
const INTERVAL = 7000;
let state = { current: 0, elapsed: 0, running: true };

function render() {
  tabs.forEach((tab, i) => {
    const on = i === state.current;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    panels[i].hidden = !on;
    const bar = tab.querySelector('.progress');
    bar.style.width = on && state.running ? `${(state.elapsed / INTERVAL) * 100}%` : '0';
  });
}

function choose(i, focus = false) {
  state = { current: i, elapsed: 0, running: false };
  render();
  if (focus) tabs[i].focus();
}

tabs.forEach((tab, i) => tab.addEventListener('click', () => choose(i)));
document.querySelector('.showcase [role="tablist"]')?.addEventListener('keydown', event => {
  const n = tabs.length;
  if (event.key === 'ArrowRight') choose((state.current + 1) % n, true);
  else if (event.key === 'ArrowLeft') choose((state.current + n - 1) % n, true);
  else return;
  event.preventDefault();
});

setInterval(() => {
  const next = showcaseTick(state, { step: STEP, interval: INTERVAL, count: tabs.length, paused: isPaused() });
  if (next !== state) {
    state = next;
    render();
  }
}, STEP);
onChange(render);
render();
