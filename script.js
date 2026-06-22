// ─── Clouds: parallax + drag-to-throw ────────────────────────────────────────
const heroSection = document.querySelector('.hero');
const cloudEls    = document.querySelectorAll('.cloud');

const cloudDepth = { 'cloud-1': 0.03, 'cloud-2': 0.08, 'cloud-3': 0.02,
                     'cloud-4': 0.09, 'cloud-5': 0.04, 'cloud-6': 0.07 };

// Tracks clouds currently in flight so parallax skips them
const cloudsThrowing = new Set();

// ── Mouse parallax ────────────────────────────────────────────────────────────
let cloudRaf = null;
if (heroSection) {
  heroSection.addEventListener('mousemove', e => {
    if (cloudRaf) return;
    cloudRaf = requestAnimationFrame(() => {
      const { left, top, width, height } = heroSection.getBoundingClientRect();
      const mx = (e.clientX - left - width  / 2) / (width  / 2);
      const my = (e.clientY - top  - height / 2) / (height / 2);
      cloudEls.forEach(c => {
        if (cloudsThrowing.has(c)) return;
        const d = cloudDepth[c.classList[1]] || 0.05;
        c.style.setProperty('--px', `${(mx * d * 320).toFixed(1)}px`);
        c.style.setProperty('--py', `${(my * d * 160).toFixed(1)}px`);
      });
      cloudRaf = null;
    });
  }, { passive: true });

  heroSection.addEventListener('mouseleave', () => {
    cloudEls.forEach(c => {
      if (cloudsThrowing.has(c)) return;
      c.style.setProperty('--px', '0px');
      c.style.setProperty('--py', '0px');
    });
  });
}

// ── Drag & throw ──────────────────────────────────────────────────────────────
cloudEls.forEach(cloud => {
  cloud.addEventListener('mousedown', e => { e.preventDefault(); onCloudDragStart(e, cloud); });
  cloud.addEventListener('touchstart', e => {
    e.preventDefault();
    onCloudDragStart(e.touches[0], cloud);
  }, { passive: false });
});

function onCloudDragStart(e, cloud) {
  if (cloudsThrowing.has(cloud)) return;

  const rect   = cloud.getBoundingClientRect();
  const startX = e.clientX;
  const startY = e.clientY;

  // Pin cloud to screen position using fixed, freeze its animations
  Object.assign(cloud.style, {
    position:   'fixed',
    left:       rect.left + 'px',
    top:        rect.top  + 'px',
    right:      'auto',
    bottom:     'auto',
    animation:  'none',
    translate:  '0px 0px',
    transition: 'none',
    transform:  'none',
    zIndex:     '100',
    cursor:     'grabbing',
  });
  document.body.style.cursor = 'grabbing';

  // Velocity history for throw calculation
  const history = [{ x: startX, y: startY, t: Date.now() }];

  function onMove(me) {
    const cx = me.clientX ?? me.touches?.[0]?.clientX;
    const cy = me.clientY ?? me.touches?.[0]?.clientY;
    if (cx == null) return;
    cloud.style.left = (rect.left + cx - startX) + 'px';
    cloud.style.top  = (rect.top  + cy - startY) + 'px';
    const now = Date.now();
    history.push({ x: cx, y: cy, t: now });
    // Keep only the last 100ms for a clean velocity sample
    while (history.length > 1 && now - history[0].t > 100) history.shift();
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onUp);
    document.body.style.cursor = '';

    let vx = 0, vy = 0;
    if (history.length >= 2) {
      const a = history[0], b = history[history.length - 1];
      const dt = Math.max(b.t - a.t, 1);
      vx = (b.x - a.x) / dt * 16;
      vy = (b.y - a.y) / dt * 16;
    }
    // String always yanks the cloud upward — keep horizontal drift, flip vy up
    const speed = Math.hypot(vx, vy);
    if (speed < 1.5) {
      vx = 0;
      vy = -2.5; // gentle upward float
    } else {
      vy = -(Math.abs(vy) + 2); // always upward, magnitude scales with throw speed
    }
    throwCloud(cloud, vx, vy);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend',  onUp);
}

function throwCloud(cloud, vx, vy) {
  cloudsThrowing.add(cloud);
  let x = parseFloat(cloud.style.left);
  let y = parseFloat(cloud.style.top);
  const FRICTION = 0.988;
  let coasting = false;

  function tick() {
    if (!coasting) {
      vx *= FRICTION;
      vy *= FRICTION;

      // Once nearly stopped, string pulls cloud upward
      if (Math.hypot(vx, vy) < 0.5) {
        coasting = true;
        vx *= 0.5;   // bleed off horizontal drift
        vy  = -2.5;  // yanked back up
      }
    }

    x += vx;
    y += vy;
    cloud.style.left = x + 'px';
    cloud.style.top  = y + 'px';

    const W  = window.innerWidth, H = window.innerHeight;
    const cw = cloud.offsetWidth,  ch = cloud.offsetHeight;
    if (x > W + 150 || x < -cw - 150 || y > H + 150 || y < -ch - 150) {
      cloudsThrowing.delete(cloud);
      resetCloud(cloud);
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// When hero scrolls fully out of view, immediately clear any in-flight clouds
// (fixed-position clouds would otherwise bleed over the work section)
window.addEventListener('scroll', () => {
  if (!heroSection || cloudsThrowing.size === 0) return;
  if (heroSection.getBoundingClientRect().bottom < 0) {
    cloudsThrowing.forEach(c => {
      c.style.cssText = '';
      c.style.setProperty('--px', '0px');
      c.style.setProperty('--py', '0px');
    });
    cloudsThrowing.clear();
  }
}, { passive: true });

function resetCloud(cloud) {
  // Wait off-screen, then snap back to CSS position and fade in
  setTimeout(() => {
    cloud.style.cssText = '';
    cloud.style.setProperty('--px', '0px');
    cloud.style.setProperty('--py', '0px');
    cloud.style.transition = 'opacity 1s ease';
    cloud.style.opacity = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      cloud.style.opacity = '';
      setTimeout(() => { cloud.style.transition = ''; }, 1100);
    }));
  }, 1500);
}

// ─── Dark / light mode ───────────────────────────────────────────────────────
const btnLight = document.getElementById('btn-light');
const btnDark  = document.getElementById('btn-dark');

function setMode(mode) {
  document.body.classList.toggle('dark', mode === 'dark');
  btnLight.classList.toggle('active', mode === 'light');
  btnDark.classList.toggle('active',  mode === 'dark');
  btnLight.setAttribute('aria-pressed', mode === 'light');
  btnDark.setAttribute('aria-pressed',  mode === 'dark');
  localStorage.setItem('color-mode', mode);
}

if (btnLight) btnLight.addEventListener('click', () => setMode('light'));
if (btnDark)  btnDark.addEventListener('click',  () => setMode('dark'));

// Restore saved preference, falling back to OS preference
const savedMode = localStorage.getItem('color-mode') ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
setMode(savedMode);

// ─── Ambient soundscape (Web Audio API) ──────────────────────────────────────
let audioCtx   = null;
let masterGain = null;
let isPlaying  = false;
const musicBtn = document.getElementById('music-toggle');

function buildSoundscape() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(audioCtx.destination);

  // ── Rain / wind layer: looped white noise through a low-pass filter
  const sr  = audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(1, sr * 4, sr);
  const ch  = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;

  const noise = audioCtx.createBufferSource();
  noise.buffer = buf;
  noise.loop   = true;

  const lpf = audioCtx.createBiquadFilter();
  lpf.type            = 'lowpass';
  lpf.frequency.value = 700;
  lpf.Q.value         = 0.4;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.09;
  noise.connect(lpf);
  lpf.connect(noiseGain);
  noiseGain.connect(masterGain);
  noise.start();

  // ── Depth: short feedback delay adds space without explicit reverb
  const delay    = audioCtx.createDelay(0.6);
  delay.delayTime.value = 0.35;
  const fbGain   = audioCtx.createGain();
  fbGain.gain.value = 0.28;
  delay.connect(fbGain);
  fbGain.connect(delay);
  delay.connect(masterGain);

  // ── Ambient tones: F-major spread, each breathing via its own LFO
  [
    { freq: 174.6, lfoHz: 0.040, depth: 0.025 },
    { freq: 175.3, lfoHz: 0.033, depth: 0.020 }, // slight detune → natural beating
    { freq: 261.6, lfoHz: 0.055, depth: 0.014 },
    { freq: 349.2, lfoHz: 0.045, depth: 0.009 },
    { freq: 523.2, lfoHz: 0.060, depth: 0.005 },
  ].forEach(({ freq, lfoHz, depth }) => {
    const osc     = audioCtx.createOscillator();
    osc.type            = 'sine';
    osc.frequency.value = freq;

    const oscGain = audioCtx.createGain();
    oscGain.gain.value = 0;
    osc.connect(oscGain);
    oscGain.connect(delay);
    oscGain.connect(masterGain);
    osc.start();

    const lfo     = audioCtx.createOscillator();
    lfo.frequency.value = lfoHz;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value  = depth;
    lfo.connect(lfoGain);
    lfoGain.connect(oscGain.gain);
    lfo.start();
  });
}

if (musicBtn) {
  musicBtn.addEventListener('click', () => {
    if (!audioCtx) buildSoundscape();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    isPlaying = !isPlaying;
    const now = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(isPlaying ? 0.85 : 0, now + 2);

    musicBtn.classList.toggle('playing', isPlaying);
    musicBtn.setAttribute('aria-label', isPlaying ? 'Pause ambient music' : 'Play ambient music');
  });
}

// ─── Tagline typing animation on load ────────────────────────────────────────
const tagline = document.querySelector('.hero-tagline');
if (tagline) {
  const text = tagline.textContent.trim();
  tagline.textContent = '';
  tagline.classList.add('typing');
  let i = 0;
  function typeTagline() {
    tagline.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(typeTagline, 38);
    else tagline.classList.remove('typing');
  }
  setTimeout(typeTagline, 300);
}

// Confetti explosion for squiggle links
function randomBetween(min, max) { return Math.random() * (max - min) + min; }

const confettiColors = [
  'rgba(199, 249, 253, 0.93)',
  'rgba(208, 253, 199, 0.93)',
  'rgba(246, 130, 252, 0.93)',
  getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim(),
  'rgba(230, 235, 189, 0.93)',
];

function createConfettiPiece(x, y) {
  const el = document.createElement('div');
  el.className = 'confetti-piece';
  const color = confettiColors[Math.floor(randomBetween(0, confettiColors.length))] || '#f3be8c';
  el.style.background = color;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  return {
    el,
    x,
    y,
    vx: randomBetween(-4.5, 4.5),
    vy: randomBetween(-8.5, -3.5),
    rotation: randomBetween(0, 360),
    vr: randomBetween(-18, 18),
    life: 0,
    decay: randomBetween(0.03, 0.055),
  };
}

const confettiPieces = [];

function launchConfetti(x, y) {
  const count = 20;
  for (let i = 0; i < count; i += 1) {
    confettiPieces.push(createConfettiPiece(x, y));
  }
}

function updateConfetti() {
  if (confettiPieces.length === 0) return;
  for (let i = confettiPieces.length - 1; i >= 0; i -= 1) {
    const piece = confettiPieces[i];
    piece.vy += 0.18;
    piece.vx *= 0.99;
    piece.vy *= 0.99;
    piece.x += piece.vx;
    piece.y += piece.vy;
    piece.rotation += piece.vr;
    piece.life += piece.decay;

    piece.el.style.left = `${piece.x}px`;
    piece.el.style.top = `${piece.y}px`;
    piece.el.style.transform = `rotate(${piece.rotation}deg)`;
    piece.el.style.opacity = `${Math.max(0, 1 - piece.life)}`;

    if (piece.life >= 1 || piece.y > window.innerHeight + 50) {
      piece.el.remove();
      confettiPieces.splice(i, 1);
    }
  }
  requestAnimationFrame(updateConfetti);
}

const squiggles = document.querySelectorAll('.squiggle');
if (squiggles.length > 0) {
  squiggles.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      launchConfetti(e.clientX, e.clientY);
      if (confettiPieces.length === 20) requestAnimationFrame(updateConfetti);
    });
  });
}

// Case study card navigation
document.querySelectorAll('.case-study-card').forEach(card => {
  card.addEventListener('click', () => {
    const href = card.dataset.href;
    if (href && href !== '#') window.location.href = href;
  });
});

// ─── Scroll-pinned intro stages ───────────────────────────────────────────────
//
// Each section (work, about) has:
//   .pin-wrap  — 220vh tall, gives scroll room while the stage is pinned
//   .pin-stage — sticky 100vh stage; holds watermark + typing pill
//   #*-content — the real content, fades in after typing completes
//
// As the user scrolls through the 120vh "extra" space in .pin-wrap:
//   0%–5%   → stage enters, cursor appears in pill
//   5%–65%  → typing animation plays letter by letter
//   65%–90% → content fades + slides up into view
//   90%–100%→ fully revealed, scroll continues normally

const TYPING_START  = 0.05;
const TYPING_END    = 0.65;
const REVEAL_START  = 0.68;
const REVEAL_END    = 0.90;

const stages = [
  { section: '.work',  contentId: 'work-content'  },
  { section: '.about', contentId: 'about-content' },
].map(({ section, contentId }) => {
  const wrap    = document.querySelector(`${section} .pin-wrap`);
  const pill    = document.querySelector(`${section} .floating-pill`);
  const content = document.getElementById(contentId);
  if (!wrap || !pill || !content) return null;
  return { wrap, pill, content, text: pill.dataset.text || '' };
}).filter(Boolean);

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function getPinProgress(wrap) {
  const rect       = wrap.getBoundingClientRect();
  const scrollable = wrap.offsetHeight - window.innerHeight;
  if (scrollable <= 0) return 1;
  return clamp(-rect.top / scrollable, 0, 1);
}

function update() {
  stages.forEach(({ wrap, pill, content, text }) => {
    const p = getPinProgress(wrap);

    // ── Typing ────────────────────────────────────────────────────────────────
    const typingT   = clamp((p - TYPING_START) / (TYPING_END - TYPING_START), 0, 1);
    const letters   = Math.round(typingT * text.length);
    const doneTyping = letters >= text.length;

    pill.textContent = text.slice(0, letters);
    // Show blinking cursor while in-progress (includes the empty "about to type" moment)
    pill.classList.toggle('typing', p >= TYPING_START && !doneTyping);
    pill.classList.toggle('done-typing', doneTyping);

    // ── Content reveal ────────────────────────────────────────────────────────
    const revealT = clamp((p - REVEAL_START) / (REVEAL_END - REVEAL_START), 0, 1);
    content.style.opacity   = revealT.toFixed(3);
    content.style.transform = `translateY(${((1 - revealT) * 24).toFixed(1)}px)`;
  });
}

let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }
}, { passive: true });

window.addEventListener('resize', update);
update();

// ─── Case study modals ────────────────────────────────────────────────────────
function openModal(modal) {
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  modal.querySelector('.cs-modal-close')?.focus();
}

function closeModal(modal) {
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

document.querySelectorAll('.cs-main[data-modal]').forEach(card => {
  card.addEventListener('click', () => {
    const modal = document.getElementById('modal-' + card.dataset.modal);
    if (modal) openModal(modal);
  });
});

document.querySelectorAll('.cs-modal-close').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.closest('.cs-modal')));
});

document.querySelectorAll('.cs-modal').forEach(modal => {
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.cs-modal.open').forEach(closeModal);
  }
});

