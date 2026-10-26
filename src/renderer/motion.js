// ---- motion: smooth but snappy ----
// One small vocabulary for everything that appears, disappears or changes in the window:
// - reveal: what a click opens fades in and slides 4px down from its toggle (180 ms); a list's first items follow each
//   other by 30 ms;
// - conceal: what closes goes faster than it came (110 ms) — nothing waits on a fade;
// - swapIn: content replaced in place (a tab, a plan variant) fades in where the old one was — no exit for the old one;
// - flash: a number that changed glows gold for a moment.
// Only opacity and transform: no layout per frame. The window fits its content (fit, core.js) — animating heights would
// resize it every frame, so it grows at once on a reveal and shrinks once a conceal ends.
// prefers-reduced-motion: everything is instant.
const MOTION = { in: 180, out: 110, swap: 140, stagger: 30, staggered: 5 };
const EASE_OUT = 'cubic-bezier(.2, .7, .2, 1)';
const EASE_IN = 'cubic-bezier(.4, 0, 1, 1)';
const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// els — the element itself, or its parts to stagger (list items).
function reveal(els, { stagger = false } = {}) {
  if (stillMotion.matches) return;
  [].concat(els).filter(Boolean).forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }],
    { duration: MOTION.in, delay: stagger ? Math.min(i, MOTION.staggered - 1) * MOTION.stagger : 0, easing: EASE_OUT, fill: 'backwards' }));
}

// Fades els out, then done() hides them for real (and the window shrinks after it).
function conceal(els, done) {
  const list = [].concat(els).filter(Boolean);
  if (stillMotion.matches || !list.length) { done(); return; }
  const anims = list.map((el) => el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-3px)' }], { duration: MOTION.out, easing: EASE_IN, fill: 'forwards' }));
  anims[0].onfinish = () => { done(); anims.forEach((a) => a.cancel()); };
}

function swapIn(el) {
  if (stillMotion.matches || !el) return;
  el.animate([{ opacity: 0, transform: 'translateY(2px)' }, { opacity: 1, transform: 'none' }], { duration: MOTION.swap, easing: EASE_OUT });
}

function flash(el) {
  if (stillMotion.matches || !el) return;
  el.animate([{ color: '#f1d79a', textShadow: '0 0 10px rgba(255, 190, 80, .45)' }, {}], { duration: 600, easing: 'ease-out' });
}

// Every <details>: its body reveals on open; on close it fades first, then the details closes.
const detailsBody = (d) => [...d.children].filter((c) => c.tagName !== 'SUMMARY');
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.tagName === 'DETAILS' && d.open && !d.dataset.closing) reveal(detailsBody(d));
}, true);
document.addEventListener('click', (e) => {
  const s = e.target.closest('details > summary');
  if (!s || stillMotion.matches) return;
  const d = s.parentElement;
  if (!d.open || d.dataset.closing) return;
  e.preventDefault();
  d.dataset.closing = '1';
  conceal(detailsBody(d), () => { d.open = false; delete d.dataset.closing; });
}, true);
