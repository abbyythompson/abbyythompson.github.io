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

// A dry filtered noise transient — a click with no pitch to it
function burst(cutoff, dur, gain) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime;
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

// The lightbox gets weight rather than pitch — a low thump with a tick on top
// for definition, since laptop speakers roll off below about 100 Hz.
const soundOpen = () => { glide(90, 45, 0.22, 0.18); burst(4000, 0.008, 0.035); };
const soundClose = () => { glide(70, 38, 0.16, 0.13); burst(3500, 0.006, 0.025); };

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
   under full size rather than appearing, so the open has some give to it. */

const OPEN_MS = 280;
const CLOSE_MS = 200;
const EASE = 'cubic-bezier(.2, .8, .2, 1)';
const stillEnough = window.matchMedia('(prefers-reduced-motion: reduce)');

const lightbox = document.createElement('dialog');
lightbox.className = 'lightbox';
lightbox.innerHTML =
  '<button class="lightbox-close" type="button" aria-label="Close">' +
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
  'stroke-width="1.75" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
  '<div class="lightbox-inner"><img alt=""></div>';
document.body.appendChild(lightbox);

const lightboxImg = lightbox.querySelector('img');
let closeAnim = null;   // the fade out, if one is still running
let openId = 0;         // bumped per open, so a slow decode can't land late

// How small the image starts before it settles into place
const OPEN_SCALE = 0.8;

function openLightbox(thumb) {
  // A close may still be in flight. Take it over, or its finished callback
  // fires a moment later and closes the lightbox we are about to open.
  if (closeAnim) { closeAnim = null; }
  lightboxImg.getAnimations().forEach(a => a.cancel());
  lightbox.classList.remove('is-closing');
  lightbox.style.pointerEvents = '';
  if (lightbox.open) lightbox.close();

  // data-full lets a small thumbnail open at full size
  lightboxImg.src = thumb.dataset.full || thumb.currentSrc || thumb.src;
  lightboxImg.alt = thumb.alt || '';

  // One <img> serves every shot, and setting src does not wipe what is on
  // screen: the browser keeps painting the last picture until the new one
  // decodes. Opening cold would flash the shot before it, so hold the image
  // back and let the new one bring itself in.
  const id = ++openId;
  lightboxImg.style.visibility = 'hidden';

  lightbox.showModal();
  soundOpen();

  const reveal = () => {
    if (id !== openId) return;   // a newer open owns the image now
    lightboxImg.style.visibility = '';
    if (stillEnough.matches) return;
    lightboxImg.animate(
      [{ transform: `scale(${OPEN_SCALE})`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
      { duration: OPEN_MS, easing: EASE });
  };

  // decode() settles on the next microtask for anything already cached, so a
  // reopen still feels instant. It rejects on a broken image; show it anyway
  // and let the usual broken-image handling take over.
  lightboxImg.decode().then(reveal, reveal);
}

function closeLightbox() {
  if (!lightbox.open) return;
  soundClose();

  // <dialog> closes instantly, so the fade has to finish first
  if (stillEnough.matches) { lightbox.close(); return; }

  // It just fades and settles back a touch. fill: 'forwards' holds the faded
  // state until the dialog actually closes, otherwise the image snaps back to
  // full opacity for a frame in between.
  const anim = lightboxImg.animate(
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

// The work screenshots, here and in the case studies. Written as a selector on
// the slot classes so an <img> dropped into one is zoomable with no extra
// markup; data-zoom is there to opt anything else in by hand.
document.querySelectorAll('img.shot, img.shot-wide, img.shot-narrow, img[data-zoom]').forEach(img => {
  img.addEventListener('click', () => openLightbox(img));
});

lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
lightboxImg.addEventListener('click', closeLightbox);

// A click that lands on the dialog itself is a click on the backdrop
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

// Esc fires cancel; take it over so the image flies back rather than vanishing
lightbox.addEventListener('cancel', e => { e.preventDefault(); closeLightbox(); });
