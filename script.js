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

const soundPress = () => tone(220, 0.025, 0.05);

const soundConfirm = () => {
  tone(660, 0.06, 0.06);
  tone(990, 0.07, 0.05, 0.055);
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
