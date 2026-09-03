// Behaviour for the two contact pills: "Email me" puts the address on the
// clipboard rather than opening a mail client, so it has to say out loud that
// something happened — visually, and with a short sound.

const EMAIL = 'abbyythompson@gmail.com';

/* ---------- sound ----------
   Generated live rather than loaded, so there are no audio files to fetch and
   the pitch and decay can be tuned exactly. A low tick on press, a rising pair
   of notes on success, so the press and its result have separate voices. */

let ctx;

function audio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  // Browsers start the context suspended until a real gesture has happened
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, gain, delay = 0) {
  const c = audio();
  if (!c) return;

  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const amp = c.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);

  // A few ms of attack — starting a waveform instantly begins it mid-cycle,
  // which puts an audible click in front of an otherwise soft sound.
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(amp).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// A tone that slides from one frequency to another as it decays
function glide(from, to, dur, gain) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator(), amp = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// A dry filtered noise transient, a click with no pitch to it
function burst(cutoff, dur, gain, delay = 0) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = cutoff;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0); src.stop(t0 + dur + 0.01);
}

const soundPress = () => tone(220, 0.025, 0.05);

const soundConfirm = () => {
  tone(660, 0.06, 0.06);
  tone(990, 0.07, 0.05, 0.055);
};

// The lightbox gets weight rather than pitch: a low thump with a tick on top
// for definition, since laptop speakers roll off below about 100 Hz.
const soundOpen = () => { glide(90, 45, 0.22, 0.18); burst(4000, 0.008, 0.035); };
const soundClose = () => { glide(70, 38, 0.16, 0.13); burst(3500, 0.006, 0.025); };

/* Stepping across the set: a camera shutter. Two hard ticks close enough
   together to read as one mechanism rather than as two sounds, and quieter
   than the lightbox open, since this one fires over and over where the open
   fires once. Both ticks drop in pitch on the way back, so the sound says
   which way you went and not only that you went. */

/* The back arrow answers the pointer before it is even pressed, so it has to
   be the lightest thing here: half the volume of the press tick and gone in
   60ms. It falls rather than rises, which is the opposite of the confirm and
   the right shape for a retreat. */
const soundBack = () => glide(540, 420, 0.06, 0.025);

const soundStep = back => {
  burst(back ? 2000 : 3000, 0.012, 0.055);
  burst(back ? 1500 : 2300, 0.02, 0.035, 0.032);
};

/* ---------- copy ---------- */

async function copyEmail() {
  try {
    await navigator.clipboard.writeText(EMAIL);
    return true;
  } catch {
    // The async API needs a secure context and permission. Fall back to the
    // old selection trick for anything that refuses.
    const ta = document.createElement('textarea');
    ta.value = EMAIL;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/* ---------- wiring ---------- */

// Both pills tick on the way down
document.querySelectorAll('.pill').forEach(el => {
  el.addEventListener('pointerdown', soundPress);
});

// Message me leaves for LinkedIn in a new tab, so the page is still here to
// play the confirm
document.querySelectorAll('.pill[href]').forEach(el => {
  el.addEventListener('click', soundConfirm);
});

// Hover fires far more loosely than a click: a pointer crossing the corner of
// the arrow, or shaking on its edge, is one arrival rather than several. A tap
// is not a hover at all, and would only double up with the navigation.
document.querySelectorAll('.back').forEach(back => {
  let last = 0;

  back.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse') return;
    if (performance.now() - last < 250) return;
    last = performance.now();
    soundBack();
  });
});

document.querySelectorAll('.pill--copy').forEach(btn => {
  let timer;

  btn.addEventListener('click', async () => {
    // Never fail silently — if the clipboard refuses outright, hand them a
    // mail client instead so the click still does something.
    if (!(await copyEmail())) {
      window.location.href = 'mailto:' + EMAIL;
      return;
    }

    soundConfirm();
    btn.classList.add('is-copied');
    // The swap is colour and shape only, so it needs announcing
    btn.setAttribute('aria-label', 'Email address copied');

    clearTimeout(timer);
    timer = setTimeout(() => {
      btn.classList.remove('is-copied');
      btn.removeAttribute('aria-label');
    }, 1800);
  });
});

/* ---------- lightbox ----------
   Any image marked [data-zoom] opens full screen. Built on <dialog> so focus
   trapping, making the page behind inert, and Esc-to-close come from the
   browser instead of being reimplemented. The image settles up from a little
   under full size rather than appearing, so the open has some give to it.

   A shot opens as part of the set it belongs to rather than on its own, so a
   carousel or a pair can be walked through at full size by clicking the halves
   of the screen, with the arrow keys, or with a swipe. */

const OPEN_MS = 280;
const CLOSE_MS = 200;
const STEP_MS = 220;
const EASE = 'cubic-bezier(.2, .8, .2, 1)';
const stillEnough = window.matchMedia('(prefers-reduced-motion: reduce)');

/* The Mac's resize cursor: both heads at once, pointing away from each other
   with a gap down the middle. Each is the one triangle drawn twice: a fat
   stroke laying down the silhouette and rounding the three corners, then a
   thinner one inset on top of it in the other colour. That is how the system
   draws its own, and it is the only way to get a solid body, an even border
   and round corners out of a single path. */

const HEADS = {
  prev: 'M10 3 3 7 10 11Z',
  next: 'M16 3 23 7 16 11Z',
};

const resizeCursor =
  '<svg viewBox="0 0 26 14" width="26" height="14" aria-hidden="true">' +
  Object.entries(HEADS).map(([side, d]) =>
    `<g class="head-${side}"><path class="edge" d="${d}"/>` +
    `<path class="body" d="${d}"/></g>`).join('') +
  '</svg>';

const lightbox = document.createElement('dialog');
lightbox.className = 'lightbox';
// Otherwise a screen reader announces it as an unnamed dialog
lightbox.setAttribute('aria-label', 'Image viewer');
lightbox.innerHTML =
  '<button class="lightbox-close" type="button" aria-label="Close">' +
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
  'stroke-width="1.75" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
  '<div class="lightbox-inner"><img alt="">' +
  '<div class="lightbox-cycle" hidden></div></div>' +
  '<div class="lightbox-dots carousel-dots" aria-hidden="true"></div>' +
  '<p class="lightbox-said" aria-live="polite"></p>' +
  `<div class="lightbox-cursor">${resizeCursor}</div>`;
document.body.appendChild(lightbox);

const lightboxImg = lightbox.querySelector('img');
const lightboxCycle = lightbox.querySelector('.lightbox-cycle');
// A click that moves a few pixels starts dragging the picture out otherwise,
// which puts a ghost of it under the pointer mid-step
lightboxImg.draggable = false;
const lightboxDots = lightbox.querySelector('.lightbox-dots');
const lightboxSaid = lightbox.querySelector('.lightbox-said');
const lightboxCursor = lightbox.querySelector('.lightbox-cursor');

let closeAnim = null;   // the fade out, if one is still running
let openId = 0;         // bumped per shown image, so a slow decode can't land late
let shots = [];         // the set currently open
let at = 0;             // where in that set we are
let onLeave = null;     // told the closing index, so a carousel can follow

// How small the image starts before it settles into place
const OPEN_SCALE = 0.8;

const fullSrc = img => img.dataset.full || img.currentSrc || img.src;

// A cycle is one thing, not three. Everything below takes an item that is
// either an <img> or a .cycle, and a cycle is played rather than stepped.
const isCycle = item => item.classList.contains('cycle');
const framesOf = item => [...item.querySelectorAll('img')];
const leadOf = item => (isCycle(item) ? framesOf(item)[0] : item);

// The neighbours are the next thing anyone is going to ask for, so fetch them
// while the current one is being looked at and the step lands instantly.
function warm(i) {
  [i - 1, i + 1].forEach(n => {
    if (!shots[n]) return;
    const next = shots[n];
    (isCycle(next) ? framesOf(next) : [next]).forEach(img => {
      const pre = new Image();
      pre.src = fullSrc(img);
    });
  });
}

// dir is -1, 0 or 1: which way we arrived, so the image can come in from the
// side it was stepped from. 0 is the opening, which scales up instead.
function show(i, dir) {
  at = i;
  const item = shots[i];
  const cycling = isCycle(item);
  const lead = leadOf(item);

  // A cycle is rebuilt from its frames so it plays here the way it plays on
  // the page, off the same keyframes. A single shot uses the one <img>.
  lightboxCycle.hidden = !cycling;
  lightboxImg.hidden = cycling;

  // Emptied when it is not in use, so its frames are not still being animated
  // out of sight for the rest of the time the lightbox is open
  if (!cycling) lightboxCycle.replaceChildren();

  if (cycling) {
    lightboxCycle.replaceChildren(...framesOf(item).map(frame => {
      const copy = new Image();
      copy.src = fullSrc(frame);
      copy.alt = frame.alt || '';
      return copy;
    }));
  } else {
    lightboxImg.src = fullSrc(item);
    lightboxImg.alt = item.alt || '';
  }

  // A dot per shot, the same row that sits under a carousel on the page. One
  // shot is not a set, so it gets nothing.
  const many = shots.length > 1;
  lightbox.classList.toggle('is-walkable', many);

  if (lightboxDots.children.length !== (many ? shots.length : 0)) {
    lightboxDots.replaceChildren();
    if (many) shots.forEach(() => lightboxDots.appendChild(document.createElement('span')));
  }

  [...lightboxDots.children].forEach((pip, n) => pip.classList.toggle('is-current', n === i));

  // The dots are decoration, so the position is said outright as well
  lightboxSaid.textContent = many ? `Image ${i + 1} of ${shots.length}` : '';
  dressCursor();

  // One <img> serves every shot, and setting src does not wipe what is on
  // screen: the browser keeps painting the last picture until the new one
  // decodes. Showing it cold would flash the shot before it, so hold the
  // image back and let the new one bring itself in.
  const shown = cycling ? lightboxCycle : lightboxImg;
  const id = ++openId;
  shown.style.visibility = 'hidden';

  const reveal = () => {
    if (id !== openId) return;   // a newer step owns the frame now
    shown.style.visibility = '';
    warm(i);
    if (stillEnough.matches) return;

    const from = dir
      ? { transform: `translateX(${dir * 32}px)`, opacity: 0 }
      : { transform: `scale(${OPEN_SCALE})`, opacity: 0.4 };

    shown.animate([from, { transform: 'none', opacity: 1 }],
      { duration: dir ? STEP_MS : OPEN_MS, easing: EASE });
  };

  // decode() settles on the next microtask for anything already cached, so a
  // reopen still feels instant. It rejects on a broken image; show it anyway
  // and let the usual broken-image handling take over.
  lead.decode().then(reveal, reveal);
}

function step(by) {
  const next = at + by;
  if (next < 0 || next >= shots.length) return;   // an end stays silent
  soundStep(by < 0);
  show(next, Math.sign(by));
}

function openLightbox(set, index, leave) {
  // A close may still be in flight. Take it over, or its finished callback
  // fires a moment later and closes the lightbox we are about to open.
  if (closeAnim) { closeAnim = null; }
  lightboxImg.getAnimations().forEach(a => a.cancel());
  lightboxCycle.getAnimations().forEach(a => a.cancel());
  lightbox.classList.remove('is-closing');
  lightbox.style.pointerEvents = '';
  if (lightbox.open) lightbox.close();

  shots = set;
  onLeave = leave || null;

  lightbox.showModal();
  soundOpen();
  show(index, 0);

  // Straight to where the pointer already is, so there is never a moment with
  // no cursor of either kind on screen
  if (walkable() && pointerAt) {
    moveCursor(pointerAt.x, pointerAt.y);
    lightboxCursor.classList.add('is-on');
  }
}

function closeLightbox() {
  if (!lightbox.open) return;
  soundClose();
  dropCursor();

  // Whatever it was opened from follows you out, so the carousel is left on
  // the shot you were last looking at rather than the one you clicked
  if (onLeave) onLeave(at);

  // <dialog> closes instantly, so the fade has to finish first
  if (stillEnough.matches) { lightbox.close(); return; }

  // It just fades and settles back a touch. fill: 'forwards' holds the faded
  // state until the dialog actually closes, otherwise the image snaps back to
  // full opacity for a frame in between.
  const anim = (lightboxCycle.hidden ? lightboxImg : lightboxCycle).animate(
    [{ transform: 'none', opacity: 1 }, { transform: 'scale(0.97)', opacity: 0 }],
    { duration: CLOSE_MS, easing: 'ease-out', fill: 'forwards' });

  closeAnim = anim;
  lightbox.classList.add('is-closing');
  lightbox.style.pointerEvents = 'none';

  anim.finished.finally(() => {
    if (closeAnim !== anim) return;   // a re-open took this over
    closeAnim = null;
    lightbox.classList.remove('is-closing');
    lightbox.style.pointerEvents = '';
    lightbox.close();
    anim.cancel();          // drop the held transform before the next open
  });
}

lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);

/* A set you can step through is its own control. The pointer turns into a
   resize cursor and a click on either half of the screen moves the set, so
   nothing there closes on a click: the cross in the corner is the way out, and
   the arrow can stay everywhere else without a click ever ending the thing you
   are looking at by accident. Esc still works, since a modal with no keyboard
   way out is a trap.

   A single shot has no halves and nothing to step to, so it keeps what it
   always had: the zoom-out pointer, and a click on the shot to close. Same on
   a touch screen, where there is no pointer to follow and the halves are a
   pointer's idea: there the set is swiped and the shot is tapped to close. */

const noPointer = window.matchMedia('(hover: none), (pointer: coarse)');

/* Where the pointer was last seen. The lightbox hides the real cursor so it
   can draw its own, but it only ever drew it on the first move inside the
   dialog, and opening it is a click, which involves no movement at all. So
   the pointer simply vanished until you jiggled the mouse. This remembers the
   position the click already told us about, and the open puts the arrow there
   straight away. */
let pointerAt = null;

const rememberPointer = e => {
  if (e.pointerType === 'touch') return;
  pointerAt = { x: e.clientX, y: e.clientY };
};

document.addEventListener('pointermove', rememberPointer, { passive: true });
document.addEventListener('pointerdown', rememberPointer, { passive: true });

// Halves of the screen rather than of the shot, since the whole of it is live
const halfAt = x => (x < window.innerWidth / 2 ? 'prev' : 'next');

// Whether that half has anywhere left to go
const usedUp = half =>
  (half === 'prev' && at === 0) || (half === 'next' && at === shots.length - 1);

// Both heads are always there, so the one with nowhere left to go fades rather
// than the whole cursor. It is the one liberty taken with the system's
// version, and without it the ends of a set are silent.
function dressCursor() {
  lightboxCursor.dataset.spent = usedUp('prev') ? 'prev' : usedUp('next') ? 'next' : '';
}

function walkable() {
  return shots.length > 1 && !noPointer.matches;
}

let cursorFrame = 0;

function moveCursor(x, y) {
  lightboxCursor.style.setProperty('--x', `${x}px`);
  lightboxCursor.style.setProperty('--y', `${y}px`);
}

// Over the cross the pointer goes back to being a pointer, since that is the
// one thing here that is a button
const onCross = e => !!(e.target.closest && e.target.closest('.lightbox-close'));

lightbox.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' || !walkable() || onCross(e)) {
    lightboxCursor.classList.remove('is-on');
    return;
  }

  if (cursorFrame) return;
  // Pointer moves arrive faster than the screen can redraw
  const { clientX, clientY } = e;
  cursorFrame = requestAnimationFrame(() => {
    cursorFrame = 0;
    moveCursor(clientX, clientY);
    lightboxCursor.classList.add('is-on');
  });
});

const dropCursor = () => lightboxCursor.classList.remove('is-on');

lightbox.addEventListener('pointerleave', dropCursor);
window.addEventListener('blur', dropCursor);

lightbox.addEventListener('click', e => {
  if (onCross(e)) return;   // the cross has its own listener

  // With nowhere to step, the shot closes on a click the way it always did.
  // The shot itself, not the dialog around it, so the backdrop stays inert.
  if (!walkable()) {
    if (e.target === lightboxImg || lightboxCycle.contains(e.target)) closeLightbox();
    return;
  }

  const half = halfAt(e.clientX);
  if (!usedUp(half)) step(half === 'next' ? 1 : -1);
});

// Esc fires cancel; take it over so the image flies back rather than vanishing
lightbox.addEventListener('cancel', e => { e.preventDefault(); closeLightbox(); });

lightbox.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
});

// Swiping is how anyone on a phone will expect to move, and halves of an
// image are a pointer's idea. Only a mostly horizontal drag counts, so a
// scroll on a tall shot is left alone.
let touch = null;

lightbox.addEventListener('touchstart', e => {
  touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
}, { passive: true });

lightbox.addEventListener('touchend', e => {
  if (!touch) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.x;
  const dy = t.clientY - touch.y;
  touch = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
}, { passive: true });

/* ---------- What counts as a set ----------
   The work screenshots, here and in the case studies. Written as a selector on
   the slot classes so an <img> dropped into one is zoomable with no extra
   markup; data-zoom is there to opt anything else in by hand.

   A shot opens with whatever it is grouped with in the page: everything inside
   one carousel, or one [data-gallery]. Anything standing on its own opens as a
   set of one, with no dots and nowhere to step. */

const SHOTS = 'img.shot, img.shot-wide, img.carousel-shot, img.cycle-shot, img[data-zoom]';
const GROUPS = '.carousel-track, [data-gallery]';

function zoomable(img) {
  const group = img.closest(GROUPS);
  const cycle = img.closest('.cycle');
  const self = cycle || img;

  if (!group) return { set: [self], index: 0, group: null };

  // A cycle counts once, however many frames are inside it, so the set is what
  // the page shows rather than every file behind it
  const set = [...group.querySelectorAll('.cycle, ' + SHOTS)]
    .filter(el => !(el.tagName === 'IMG' && el.closest('.cycle')));

  return { set, index: set.indexOf(self), group };
}

document.querySelectorAll(SHOTS).forEach(img => {
  img.addEventListener('click', () => {
    const { set, index, group } = zoomable(img);
    // A carousel hands over a way to be scrolled to wherever you end up
    openLightbox(set, Math.max(0, index), group && group.followTo);
  });
});

/* ---------- Screen recordings ----------
   A clip loops silently with no controls, which is what makes it read as a
   moving picture rather than as something asking to be played. That is fine
   right up until somebody has asked their computer for less movement, and a
   looping video is exactly the movement they meant. So it does not start, and
   it gets its controls back, which leaves it watchable on purpose. */

if (stillEnough.matches) {
  document.querySelectorAll('.clip video').forEach(clip => {
    clip.autoplay = false;
    clip.controls = true;
    clip.pause();
  });
}

/* ---------- Carousels ----------
   A set of shots in one slot, with a quarter of the next one showing at the
   edge and dots underneath saying how many there are. The page writes a <ul>
   of images and the dots are built here, so the markup stays a list of images
   and a page that never gets its JavaScript still shows the first shot and its
   neighbour.

   Nothing on the page moves the set, on purpose. Either shot opens into the
   lightbox, at itself, and the whole set is walked through there, where the
   work is big enough to be worth walking through. */

document.querySelectorAll('.carousel').forEach(root => {
  const track = root.querySelector('.carousel-track');
  if (!track) return;

  const slides = [...track.children];
  const pics = slides.map(li => li.querySelector('img'));

  // A set of one is just an image. Leave it alone rather than putting a single
  // dot under it.
  if (slides.length < 2) return;

  let index = -1;

  /* --- the dots underneath --- */

  const dots = document.createElement('div');
  dots.className = 'carousel-dots';
  dots.setAttribute('aria-hidden', 'true');

  const pips = slides.map(() => dots.appendChild(document.createElement('span')));

  root.appendChild(dots);

  /* --- showing one of them --- */

  // How far along the row the current shot has to sit. The step between two
  // slides carries the gap with it, so it is measured rather than worked out,
  // and the end is clamped so the row never pulls a hole in behind itself:
  // on the last shot it is the one before that peeks in from the left instead.
  function place() {
    const step = slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : 0;
    const span = step * (slides.length - 1) + slides[0].clientWidth;
    const far = Math.max(0, span - track.clientWidth);

    track.style.transform = `translateX(${-Math.min(index * step, far)}px)`;
  }

  function show(i) {
    const to = Math.max(0, Math.min(slides.length - 1, i));
    if (to === index) return;
    index = to;

    place();
    pips.forEach((pip, n) => pip.classList.toggle('is-current', n === index));

    // The dots are decoration; this is the same thing said out loud
    track.setAttribute('aria-label', `Image ${index + 1} of ${slides.length}`);
  }

  // The widths are all proportions of the column, so the offset that lands on
  // them has to be worked out again when the column changes size
  window.addEventListener('resize', place);

  // Handed to the lightbox, which calls it on the way out with the shot you
  // finished on. The slot is not where you keep your place though: it goes
  // back to the start, so what anyone scrolling past arrives at is always the
  // first shot with the second one showing beside it.
  track.followTo = () => show(0);

  /* --- keyboard ---
     The shots themselves are not focusable, so without this there is no way in
     to the lightbox at all without a pointer. */

  track.tabIndex = 0;
  track.setAttribute('role', 'group');
  track.setAttribute('aria-roledescription', 'image set');

  track.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pics[index].click(); }
  });

  show(0);
});

/* ---------- Case study section nav ----------
   The nav has to say where you are, not just where you last clicked. The
   current section is the last one whose top has crossed a line a third of the
   way down the screen; at the very bottom of the page it is always the last
   one, since a short closing section may never reach that line. */

const caseNav = document.querySelector('.case-nav');

if (caseNav) {
  const items = [...caseNav.querySelectorAll('a[href^="#"]')]
    .map(link => ({ link, section: document.querySelector(link.getAttribute('href')) }))
    .filter(item => item.section);

  let queued = false;

  function markCurrent() {
    queued = false;

    const line = window.innerHeight / 3;
    const scroller = document.documentElement;
    const atBottom = window.scrollY + window.innerHeight >= scroller.scrollHeight - 2;

    let current = items[0];
    if (atBottom) {
      current = items[items.length - 1];
    } else {
      for (const item of items) {
        if (item.section.getBoundingClientRect().top <= line) current = item;
      }
    }

    items.forEach(item => item.link.classList.toggle('is-current', item === current));
  }

  // Scroll fires far more often than the page can repaint, so the work waits
  // for the next frame rather than running per event
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(markCurrent);
  };

  if (items.length) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    markCurrent();
  }
}
