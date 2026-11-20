// Timing for the moving parts, kept pure so it can be tested without a browser.

/** Hero: phones change screen one at a time, middle first, then right, then left. */
export function heroStep(shown, turn, screensPerPhone = 3) {
  const phone = [1, 2, 0][turn % 3];
  return shown.map((v, i) => (i === phone ? (v + 1) % screensPerPhone : v));
}

/**
 * Showcase: time only counts while running and not paused, so the progress bar and the switch
 * always agree. Returns the new state.
 */
export function showcaseTick(state, { step, interval, count, paused }) {
  if (!state.running || paused) return state;
  const elapsed = state.elapsed + step;
  if (elapsed < interval) return { ...state, elapsed };
  return { ...state, elapsed: 0, current: (state.current + 1) % count };
}
